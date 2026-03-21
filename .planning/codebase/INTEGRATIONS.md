# External Integrations

**Analysis Date:** 2026-03-20

## APIs & External Services

**AI Chat Platforms (Intercepted):**
- ChatGPT / OpenAI - Chat interface for capturing conversations
  - API endpoints: `/backend-api/conversations` (list), `/backend-api/conversation/{id}` (detail)
  - Host permissions: `https://chat.openai.com/*`, `https://chatgpt.com/*`
  - Authentication: Bearer token from request headers

- Claude / Anthropic - Chat interface for capturing conversations
  - API endpoints: `/api/organizations/{orgId}/conversations` or `/api/organizations/{orgId}/chat_conversations` (both formats supported)
  - Host permissions: `https://claude.ai/*`, `https://*.claude.ai/*`
  - Authentication: API key-based (via Clerk JWT - see auth below)

**Social Media:**
- X/Twitter - Tweet capture and social context
  - Host permissions: `https://x.com/*`, `https://twitter.com/*`
  - Integration: Tweet saver stores tweets to Supabase

**Email Service:**
- AgentMail - Send messages as email from captured chat content
  - Endpoint: `https://api.agentmail.to/v0/inboxes/{address}/messages/send`
  - SDK/Client: Custom HTTP client via `proxyFetch` utility
  - Auth: Bearer token (API key)
  - Implementation: `src/components/SelectiveExporter/services/agentmail.ts`
  - Note: Development-only in current build (proxy fetch disabled in production)

## Data Storage

**Databases:**
- Supabase (PostgreSQL)
  - Connection: `PLASMO_PUBLIC_SUPABASE_URL` environment variable
  - Client: `@supabase/supabase-js` 2.94.1
  - Tables: `tweets` (tweet capture), migrations in `supabase/migrations/`
  - Key table columns: `tweet_id`, `author_display_name`, `user_id`, `conversation_id`, `created_at`, `saved_at`
  - Authentication: Anonymous key (`PLASMO_PUBLIC_SUPABASE_ANON_KEY`), RLS currently disabled

**File Storage:**
- Local filesystem only - No cloud file storage
- Supports export to JSON/Markdown formats

**Caching:**
- Chrome storage API (`chrome.storage.local`) - Stores settings and session tokens
- Supabase client-side caching (default, no explicit cache layer)

## Authentication & Identity

**Auth Provider:**
- Clerk
  - SDK: `@clerk/chrome-extension` 2.8.4
  - Sync host: `PLASMO_PUBLIC_CLERK_SYNC_HOST` environment variable
  - Publishable key: `PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - Implementation: `src/background.ts` (background service worker initialization)
  - Token retrieval: `src/utils/clerk.ts` with `requestClerkToken()` RPC call
  - Session management: Stores JWT tokens in `chrome.storage.local` with key fragment `__clerk_client_jwt`
  - Sync mechanism: Reads Clerk cookies from sync host, maintains singleton client with auto-refresh every 60 seconds

**Session Flow:**
1. Background script initializes Clerk client with sync host
2. Content scripts request session token via `chrome.runtime.sendMessage({ action: "getClerkToken" })`
3. Background script retrieves token from Clerk JWT storage
4. Tokens used for authenticated API calls to ChatGPT/Claude capture endpoints

**Authorization:**
- User-scoped access via Clerk JWT
- Future: Row-level security (RLS) policies planned for Supabase (currently disabled)

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, DataDog, etc.)

**Logs:**
- Browser console logging via `src/utils/debug.ts` utility
- Debug flag: `PLASMO_PUBLIC_DEBUG` environment variable
- Debug output: Categories like `["auth", "clerk", "background"]`
- Storage: Chrome extension console only (ephemeral)

**Performance:**
- No APM or performance monitoring detected

## CI/CD & Deployment

**Hosting:**
- Chrome Web Store (target distribution platform)
- Production manifest prepared by `scripts/prepare-prod-manifest.js`

**CI Pipeline:**
- None detected (no GitHub Actions, etc., visible in config)
- Build scripting in `package.json`: `build:store` for release builds

**Artifact Output:**
- Extension build: `build/chrome-mv3-prod/` (production) and `build/chrome-mv3-dev/` (development)
- Web app build: `build/web/` (Vite output)

## Environment Configuration

**Required env vars:**
- `PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk authentication
- `PLASMO_PUBLIC_CLERK_SYNC_HOST` - Clerk session sync origin
- `PLASMO_PUBLIC_API_BASE_URL` - Backend API (defaults to `http://localhost:3000`)
- `PLASMO_PUBLIC_SUPABASE_URL` - Supabase database URL
- `PLASMO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous access key
- `PLASMO_PUBLIC_DEBUG` (optional) - Enable debug logging

**Secrets location:**
- `.env.chrome` - Development extension secrets
- `.env.development` - Development API secrets
- `.env.production` - Production secrets (not committed, created during deploy)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- AgentMail message send: POST to `https://api.agentmail.to/v0/inboxes/{address}/messages/send`
- Supabase insert/upsert operations: Automatic API calls to configured Supabase instance

**Chrome Extension Messages:**
- Runtime message passing between background script and content scripts
- Messages: `getClerkToken`, `clerkSignOut`, `refreshClerkAuth`, `openOptionsPage`, `openAuthTab`, `proxyFetch`

## Network Interception

**Background Service Worker Interceptor:**
- Captures and caches API responses from ChatGPT and Claude
- Implemented in `src/interceptor.ts`
- Injects into content scripts at runtime via `chrome.scripting.executeScript()`
- Intercepts conversation list and detail endpoints (see endpoints config)

**Endpoint Matchers:**
- Single source of truth: `src/config/endpoints.ts`
- Detects platform by URL patterns, extracts org IDs, builds fetch URLs
- Guards against capturing sub-paths (e.g., `/stream_status` not captured)

---

*Integration audit: 2026-03-20*
