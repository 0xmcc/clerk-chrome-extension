# Per-User VPS Architecture Conversation

Saved on 2026-03-26.

This document preserves the conversation verbatim.

## User

```text
I really want to make it a backend that allows the provisioning of VPS programmatically for every user, so every user has their own VPS. It doesn't need to work for millions of users in a scale in that sense, but it should work for like a hundred users, right? Even 50 to start.You know we just need to know enough that we can programmatically do it in a deterministic way.Safely. Especially now that we're saving our data to GitHub repos and a vault, this becomes more useful.
```

## Assistant

```text
Yes. For `50-100` users, a per-user VPS model is absolutely viable if you build it as a small control plane with deterministic provisioning, not as a pile of shell scripts.

What makes this especially reasonable in your case is that your system already has the right shape: the extension sends authenticated data to a backend, and the backend already performs per-user persistence and GitHub-side actions. The extension is already posting conversation exports to the backend here:

```454:465:clerk-chrome-extension/src/components/SelectiveExporter/hooks/useExportActions.ts
      const token = await requestClerkToken()
      const payload = buildCaptureExportPayload(capture, "chrome_extension")

      const response = await fetch(`${API_BASE_URL}/v1/conversations/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
```

And the backend already does authenticated, per-user post-persist GitHub sync here:

```56:109:../promptmarket-backend/src/services/conversations/postCommitOrchestrator.js
  const githubSync = { attempted: false, ok: false };

  if (userId) {
    const connection = await githubService.getConnection(userId);

    if (connection) {
      const selectedRepos = await githubService.getConversationGitHubRepos(
        userId,
        conversationId
      );
      const syncTargets = new Map();

      if (connection.repoFullName) {
        syncTargets.set(connection.repoFullName, {
          name: connection.repoName,
          fullName: connection.repoFullName,
          url: connection.repoUrl
        });
      }

      for (const repo of selectedRepos) {
        syncTargets.set(repo.fullName, repo);
      }

      if (syncTargets.size > 0) {
        githubSync.attempted = true;
      }

      const syncErrors = [];

      for (const repo of syncTargets.values()) {
        try {
          await githubService.writeConversationToRepo(
            {
              ...connection,
              repoName: repo.name,
              repoFullName: repo.fullName,
              repoUrl: repo.url
            },
            conversationId,
            title,
            messages || []
          );
        } catch (error) {
          syncErrors.push(`${repo.fullName}: ${error.message}`);
          console.warn('GitHub sync failed (non-fatal):', `${repo.fullName}: ${error.message}`);
        }
      }
```

## Recommendation

Do it as a `backend-managed control plane` with one VPS provider first. Do not let the extension know anything about infrastructure. Do not give users provider credentials. Do not make the VM itself the system of record.

The right mental model is:

- `Postgres/Supabase` is your control-plane state.
- `GitHub repo + vault` are the durable user assets/config/secrets.
- `Per-user VPS` is disposable execution infrastructure that can be recreated deterministically.

That last point is the one that makes this sane. If the VM dies, you should be able to recreate it from:
- a fixed image or snapshot
- cloud-init or bootstrap script
- user repo reference
- short-lived vault bootstrap credential
- desired state stored in your backend DB

If you build it that way, `50-100` users is not scary.

## The Architecture I’d Use

Add a new backend slice next to your existing `github` and `conversations` plugins:

- `plugins/runtimes.js`
- `controllers/runtimeController.js`
- `services/runtimeService.js`
- `services/runtimeProvisioningService.js`
- `services/providers/digitalocean.js` or `services/providers/hetzner.js`
- `workers/runtimeProvisioningWorker.js`

Use your existing backend as the control plane, not a separate new backend.

For orchestration, use a Postgres-backed job queue like `pg-boss`, not Redis. You already have Postgres wired up in `src/lib/postgres.js`, so adding Redis would be needless complexity for this scale.

Core tables I’d expect:

- `user_runtimes`
  - `user_id`
  - `provider`
  - `provider_instance_id`
  - `status` (`requested`, `provisioning`, `active`, `failed`, `rebuilding`, `destroyed`)
  - `public_ip`
  - `region`
  - `image_version`
  - `last_health_check_at`
  - `failure_reason`
- `runtime_jobs`
  - job id, type, idempotency key, payload, status, attempts
- `runtime_events`
  - append-only audit log for provisioning lifecycle
- `runtime_bootstrap_tokens`
  - one-time or wrapped tokens, short TTL only

## Provisioning Flow

This is the deterministic flow I’d actually trust:

1. User becomes eligible for a runtime.
2. Backend inserts or updates `user_runtimes` with desired state `requested`.
3. Backend enqueues a provisioning job with idempotency key like `provision:${userId}`.
4. Worker checks whether an active runtime already exists for that user.
5. If not, worker calls provider API to create a VM from a fixed image/template.
6. VM boots with `cloud-init`.
7. `cloud-init` installs your runtime agent and fetches a short-lived bootstrap token.
8. Agent exchanges that token for narrowly scoped secrets from vault.
9. Agent pulls user config or workload definition from the user’s GitHub repo.
10. Agent reports health back to backend.
11. Backend marks runtime `active` only after health check succeeds.

That gives you idempotency, auditability, and safe retries.

## Safety Rules That Matter

These are non-negotiable if you want this to stay sane:

- Use exactly one infrastructure provider at first.
- Use immutable templates, not ad hoc SSH provisioning.
- Never store root passwords.
- Never store long-lived SSH private keys per VM in the DB.
- Give each VM only the minimum secret access it needs.
- Use short-lived bootstrap credentials for vault access.
- Treat every VM as rebuildable.
- Keep durable user state out of the VM whenever possible.
- Add a kill switch and a destroy/rebuild path from day one.
- Provision lazily, not for every signup.

That last one matters. Don’t create 100 VPSs because 100 people signed up. Create them when a user actually crosses the line where dedicated compute is needed.

## Why This Fits Your Current Codebase

Your backend already has the right auth and service boundaries:
- Clerk-authenticated routes in `src/plugins/auth.js`
- Fastify plugins for feature slices in `src/index.js`
- Per-user GitHub connection state in `src/services/githubService.js`

You’re already encrypting GitHub OAuth tokens before storing them:

```442:485:../promptmarket-backend/src/services/githubService.js
  const accessToken = await exchangeCodeForToken(code);
  const githubUser = await getAuthenticatedGitHubUser(accessToken);
  const repository = await provisionRepository(accessToken, githubUser);
  const pool = await getPool('supabase');
  const encryptedToken = encryptAccessToken(accessToken);

  await pool.query(
    `INSERT INTO public.users (id, created_at, updated_at)
     VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [userId]
  );

  await pool.query(
    `INSERT INTO github_connections (
      user_id,
      github_user_id,
      github_username,
      access_token,
      repo_name,
      repo_full_name,
      repo_url,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
```

That is the correct general pattern for provider credentials too, except for VPS provisioning I would use a platform-owned provider token, not a per-user token.

One important warning: before you build infra automation, fix your auth logging. Right now the auth plugin is logging authorization headers and tokens, which is unacceptable once you start dealing with infra and vault bootstrap flows:

```19:29:../promptmarket-backend/src/plugins/auth.js
  fastify.decorate('authenticate', async function (request, reply) {
    fastify.log.info(`Authenticate called for route: ${request.url}`);
    const auth = getAuth(request);  // Use getAuth here
    // Debug: Log the auth object structure
    fastify.log.info('header:', request.headers)
    const authHeader = request.headers.authorization;
    console.log('Raw Authorization header:', authHeader ? `Bearer ${authHeader.substring(7, 17)}... (full length: ${authHeader.length - 7})` : 'No Authorization header present');
    console.log('header:', request.auth)
    console.log('auth:', auth)
    console.log('token:', await auth.getToken())
    fastify.log.info('Auth object:', JSON.stringify(auth, null, 2));  // Stringify for full details
```

If you keep anything from this answer, keep that.

## Provider Choice

Be decisive here: start with one of these.

- `DigitalOcean` if you want the more conservative, boring, straightforward API choice.
- `Hetzner` if cost matters more and you’re comfortable with a slightly more bare-metal feel.

For your current scale, either is fine. I would not do multi-cloud now. That is fake sophistication.

## Reality Check

This is practical if:
- the VM size is small
- users don’t all need constant heavy workloads
- you can rebuild VMs from repo + vault + template

Roughly, `50 x $5-8/month` is still manageable. `100` is manageable too. The ops burden is the real constraint, not the raw count.

What would make this a bad idea is if:
- you need strong multi-tenant efficiency immediately
- users don’t actually need dedicated machines
- your workloads are bursty enough that job runners or containers would do

If your real need is isolation plus deterministic tooling, a full VPS per user is acceptable. If your real need is just “safe remote execution,” containers on shared hosts are cheaper. But based on your description, I think per-user VPS is justified for the first serious version.

## Bottom Line

You should build this.

Not as “users get random VPSs,” but as:
- a `control plane` in your existing backend
- a `single-provider provisioning worker`
- `immutable VM templates`
- `vault-backed bootstrap`
- `GitHub repo as user-owned durable config/state`
- `rebuildable per-user runtimes`

That is the clean version of this idea, and it is well within reason for `50-100` users.

If you want, I can next sketch the exact backend API, DB schema, and provisioning state machine I’d add on top of your current Fastify/Postgres code.
```

## User

```text
We're eventually going to deprecate Supabase. We want to fully adopt the Obsidian capano file over app ideology. We want complete security, and I think there's no reason that we also want the users to feel like they're renting their access to their data layer, but that they own their own data layer and we're just managing it for them. We're just starting; we're just setting it up for them, but they can port it however they want. We don't want to create one VPS for all users and do some ridiculous security work. I think a cleaner way is just completely different VPS per user. They can take the keys and do whatever they want, or they can just leave it with us.It would be as if they were doing it themselves, but we were doing it for them.
```

## Assistant

```text
Your instinct is directionally right, but I’m going to be blunt about the part that matters most:

If “the user owns their data layer” is a core product principle, then `one VPS per user` is the right isolation model, but `a VPS in your cloud account` is not true ownership. It’s only better tenancy.

Real ownership means the user can take over the machine, the keys, the backups, and ideally the cloud account relationship itself. If you provision the box in your provider account and hand them SSH access, they still don’t fully own the substrate. They’re still downstream of you.

## The Cleanest Model

You should separate `control plane` from `data plane`.

- `Control plane`: your backend, billing, Clerk identity mapping, provisioning orchestration, health checks, job retries.
- `Data plane`: each user’s own VPS, their own repo, their own vault, their own files.

That is the clean architecture for your ideology. Your platform manages the setup and ongoing automation, but the durable user state does not live in your shared database.

Right now your backend still treats Supabase/Postgres as the primary conversation store. For example, conversation export persists directly into `conversations` and `messages` tables:

```10:16:../promptmarket-backend/src/services/conversations/persistenceService.js
    const userResult = await client.query(
      `INSERT INTO public.users (id, created_at, updated_at)
       VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [userId]
    );
```

```80:88:../promptmarket-backend/src/services/conversations/persistenceService.js
      const insertResult = await client.query(
        `INSERT INTO conversations
         (user_id, title, model, metadata)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId, title, payload.model, metadata]
      );
```

And a lot of the backend still hardcodes Supabase as the main storage target:

```21:25:../promptmarket-backend/src/lib/postgres.js
  if (databaseType === 'supabase') {
    if (!supabaseDatabaseUrl) {
      throw new Error('SUPABASE_DATABASE_URL environment variable is required for Supabase database operations');
    }
```

So the architecture shift you’re talking about is not “add VPS provisioning.” It’s a deeper move:

`Supabase/Postgres stops being the user data layer and becomes, at most, your product control-plane metadata store.`

That’s the right move if your philosophy is genuinely file-over-app.

## My Opinionated Recommendation

Do not build shared multi-tenant infrastructure for user data.

Do not build one giant app server with per-user namespaces and convince yourself you’ll out-security everyone later.

Do build `one runtime per user`.

But do it in one of these two ways, in order of ideological purity:

1. `Customer-owned infrastructure`
2. `Platform-owned but transferable infrastructure`

If you really mean ownership, aim for `customer-owned infrastructure`.

That means:
- the VM is created in the user’s own DigitalOcean/Hetzner/etc account
- the user owns the provider relationship and billing
- your app gets delegated access to provision/manage it
- the user can revoke you at any time
- your app can optionally remain the operator, but not the owner

If that is too much UX friction for the first version, then start with `platform-owned but transferable`, but be honest that it is transitional, not philosophically complete.

## What “Ownership” Actually Requires

If you want this to feel like “we set it up for them, but it’s really theirs,” the system needs all of these:

- User-specific VPS, never shared compute for private data workloads.
- User-specific SSH/admin credentials.
- User-specific vault namespace or vault instance.
- User-specific Git repo as source of durable files.
- Reproducible machine bootstrap from code, not snowflake boxes.
- Export/handoff path so the user can leave without begging support.
- Minimal central metadata in your backend, with no private user corpus stored there.

The key insight is this:

`The VM should be replaceable. The repo + vault + config manifest should be the durable source of truth.`

That matches your Obsidian-like philosophy much better than “the machine is the product.”

## The Best Practical Architecture For You

I would design it like this:

### 1. User repo is the canonical content layer

Each user gets a repo with a deterministic structure, something like:

- `knowledge/`
- `conversations/`
- `attachments/`
- `config/manifest.json`
- `automation/`
- `backups/`

That repo is theirs. Your app writes to it, reads from it, and can rebuild the VPS from it.

### 2. User vault is the canonical secret layer

Each user gets either:
- a vault namespace in a dedicated secrets system you run, or
- their own managed vault instance, if you want maximum purity later.

Store:
- API keys
- SSH private material if they opt into platform management
- provider tokens if using customer-owned infrastructure
- bootstrap tokens for the VPS agent

### 3. VPS runs a thin local agent

The VPS should run a small agent that:
- pulls config from repo
- fetches secrets from vault
- applies local desired state
- exposes heartbeat/health status
- rotates credentials
- can rebuild itself from manifest

Your backend should not SSH in manually for normal operations. That becomes an unmaintainable mess very fast.

### 4. Your backend becomes the orchestration plane

Your backend should store only things like:
- `user_id`
- `provider`
- `provider_instance_id`
- `runtime_status`
- `last_heartbeat_at`
- `region`
- `image_version`
- `billing/subscription state`
- `repo URL / vault locator`

That is product metadata, not user data. This is where your remaining Postgres belongs after Supabase is deprecated.

### 5. Bootstrap must be deterministic

Provisioning flow should be:

1. Create VM from fixed image or cloud-init template.
2. Inject user public key and one-time bootstrap token.
3. VM agent starts.
4. Agent exchanges bootstrap token for scoped vault access.
5. Agent clones/pulls repo.
6. Agent applies config manifest.
7. Agent reports healthy.
8. Backend marks runtime active.

That is deterministic. That is rebuildable. That is safe enough for your scale.

## One Important Truth

“Complete security” is not real. Don’t architect around fantasy language.

What you can achieve is:
- dramatically smaller blast radius
- simpler trust boundaries
- fewer shared-tenant failure modes
- clearer user ownership
- easier portability

Per-user VPS absolutely helps with all of that. It does not make you invulnerable.

## What I Would Not Do

I would not do these:

- No multi-cloud from day one.
- No Kubernetes.
- No shared database as the long-term source of user content.
- No “we’ll just SSH in and run setup scripts.”
- No provider abstraction layer over five VPS vendors.
- No storing long-lived root credentials centrally unless the user explicitly opts into full management.

That is all fake sophistication at your stage.

## Best First Provider Strategy

Pick exactly one provider.

Use either:
- `Hetzner` for cost efficiency
- `DigitalOcean` for very boring DX and acceptable simplicity

For your size, either works. The wrong move is abstraction too early.

## The Crucial Product Decision

You need to decide which of these products you are actually building:

### Option A: Managed sovereign workspace
You provision and manage the user’s VPS, repo, and vault.
The user can export and migrate later.
This is easier to launch.

### Option B: Customer-owned sovereign workspace
The user connects their own provider account and repo/vault.
You orchestrate setup and operations on top of their infrastructure.
This is more aligned with your philosophy.

If you really believe the thing you wrote, `Option B` is the endgame. I would design the system so Option A can evolve into B without rewriting the whole backend.

That means your internal model should already assume:
- provider account may be yours or the customer’s
- repo may be platform-created or customer-linked
- vault may be platform-managed or customer-managed
- runtime is always user-dedicated

## My Direct Recommendation

Build this as:

- one dedicated VPS per user
- repo + vault as the durable user-owned layer
- your backend as orchestration only
- a tiny central Postgres for control-plane metadata only
- a path toward customer-owned cloud accounts

That is the clean architecture.

The only thing I would push back on is pretending that “per-user VPS in our account” equals ownership. It doesn’t. It’s a strong intermediate step, but not the final philosophical shape.

## Migration Direction From Your Current Backend

From the codebase as it exists today, the migration path is:

1. Stop treating Postgres/Supabase as the canonical conversation store.
2. Start writing canonical conversation files to the user repo first.
3. Keep a slim control-plane DB for identity, provisioning, jobs, and billing.
4. Move per-user runtime state behind a `runtimeService`.
5. Introduce a VM agent that can reconstruct local state from repo + vault.
6. Gradually demote current `conversations` DB tables from primary store to cache/index, then remove them.

That is the order I’d do it in.

The maintainability upside is strong: your user data model becomes portable and inspectable instead of being trapped in backend tables. The main technical risk is provisioning and lifecycle complexity, which is exactly why the control-plane/data-plane split matters. If you keep central state thin and make the VPS rebuildable from repo plus vault, the system stays coherent instead of turning into an ops swamp.

If you want, I can next lay out the exact target data model and API surface for a `user-owned runtime control plane`, including the minimal tables you still need after Supabase is gone.
```

## User

```text
I think platform owned but transferable is great, and I agree that it is transitional. I agree with the rest of it.
```

## Assistant

```text
Then that should be the explicit product posture:

`Managed sovereign infrastructure, with a guaranteed handoff path.`

That is a strong transitional model because it gives you the cleaner security boundary now, while keeping you honest about eventual user ownership.

## What that means in practice

Your promise to users should effectively be:

- every user gets a dedicated VPS
- the VPS is provisioned and managed by you at first
- the durable state lives in their repo and vault-oriented setup, not in your shared app database
- the machine, credentials, backups, and config can be transferred to them later without a rewrite
- if they leave, they are exporting ownership, not exporting a data dump

That is materially different from normal SaaS, and it is a much better fit for the ideology you described.

## The design constraint you should lock in now

Even if the VPS starts in your account, build everything as if ownership transfer will happen.

That means:
- no hidden dependencies on your internal network
- no user runtime requiring access to your private shared database
- no snowflake manual setup
- no secrets that only exist in your backend
- no app logic that assumes the runtime can never move providers or accounts

If you violate those now, “transferable later” becomes a lie.

## The 4 things I would lock first

1. `Canonical state model`
The user repo and vault structure need to become the source of truth. The VPS is a runner, not the permanent truth.

2. `Provisioning contract`
Define exactly what a new runtime receives at bootstrap:
- machine image version
- cloud-init payload
- one-time bootstrap token
- repo URL
- vault locator
- user public key(s)

3. `Transfer contract`
Define what “handoff” means before you build:
- transfer SSH/admin access
- rotate platform credentials out
- export machine manifest
- rebind provider account ownership or recreate in customer account
- verify the runtime still comes up from repo + vault

4. `Thin control plane`
Keep your central backend limited to:
- identity mapping
- billing/subscription
- provisioning jobs
- runtime health
- audit trail
- repo/vault/runtime pointers

Not user corpus.

## My blunt recommendation

You should treat this as a first-class product primitive, not a later infra improvement.

If you believe in the file-over-app model, then “dedicated, transferable user runtime” is not just deployment strategy. It is the product.

So the next architectural move should be:
- central backend becomes orchestration only
- user runtime becomes the execution environment
- repo + vault become the durable user layer

That is the clean line.

If you want, I can next turn this into a concrete v1 spec with:
- exact runtime lifecycle states
- transfer workflow
- minimal backend tables
- provisioning API endpoints
- what should live in repo vs vault vs control-plane DB
```

## User

```text
Externalize this conversation verbatim into a document so it doesn't get lost.
```
