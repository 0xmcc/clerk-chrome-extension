# Tweet Saver — Chrome Extension Feature

Add a "Save" button to each tweet's action row in the X/Twitter UI. On click, upsert the tweet into Supabase so it's portable and transformable (summaries, video, etc.).

## Existing Schema (context only — do not run)

```sql
CREATE TABLE public.tweets (
  id bigint NOT NULL DEFAULT nextval('tweets_id_seq'::regclass),
  tweet_id text NOT NULL UNIQUE,
  tweet_text text,
  author_handle text,
  timestamp timestamp with time zone,
  media_urls ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tweets_pkey PRIMARY KEY (id)
);
```

## Migration

Evolve the `tweets` table. Add these columns (preserve existing data):

- `source_url text` — permalink to the tweet
- `media jsonb DEFAULT '[]'` — array of `{ type, url }` objects (image, video, gif)
- `link_cards jsonb DEFAULT '[]'` — array of `{ url, title, description, image, site_name }` for embedded links
- `quoted_tweet_id text REFERENCES tweets(tweet_id)` — FK to the quoted tweet's row
- `in_reply_to_tweet_id text` — parent tweet id (if this tweet is a reply)
- `conversation_id text` — Twitter's conversation/thread id for future expansion
- `raw_json jsonb` — full tweet object as returned by the DOM/API, insurance for future extraction
- `tags text[] DEFAULT '{}'` — user-applied tags
- `notes text` — freeform user annotation
- `saved_at timestamptz DEFAULT now()` — when the user clicked Save
- `user_id text NOT NULL` — Clerk user id (text, not uuid)

Drop reliance on the old `media_urls` column once migrated (or keep for backward compat — your call).

## Auth

- Clerk authentication — `user_id` is a text string from Clerk
- Extension authenticates via Clerk session token → Supabase RLS policies scoped to `user_id`
- Use Supabase anon key + RLS (no service role key in the extension)

## Save Behavior

1. **Upsert on `tweet_id`** — if already saved, update `saved_at` and `raw_json`.
2. **Quote tweets** — if the tweet quotes another, save the quoted tweet as its own row first, then link via `quoted_tweet_id`.
3. **Replies** — if the tweet is a reply, attempt to fetch and save the parent tweet. If the parent is unavailable (deleted, protected), save what you have and set `in_reply_to_tweet_id` anyway — don't fail the whole save.
4. **Threads** — save only the clicked tweet. Store `conversation_id` for future thread-expansion features, but don't crawl the thread.
5. **Media** — store `type` + `url` only. No dimensions/duration/thumbnails at save time (extractable from `raw_json` later if needed).
6. **Link cards** — extract from tweet DOM if present. Best-effort, not blocking.

## UI

- Inject a save icon/button into Twitter's action row (like, retweet, reply, share area).
- **Default state:** outline/unfilled icon.
- **Saving state:** brief spinner or pulse animation.
- **Saved state:** filled/highlighted icon. Persists if tweet is already in DB.
- **Error state:** icon flashes red briefly, then returns to default. No modal, no toast — keep it silent and unobtrusive. Log errors to console for debugging.
- Non-blocking — fire the upsert async, don't freeze the timeline.
- On page load, batch-check visible tweet IDs against Supabase to show "already saved" state.

## Constraints

- Minimal DOM manipulation — follow existing extension patterns.
- No new dependencies unless essential.
- Keep the content script lightweight; heavy logic in background worker if needed.
