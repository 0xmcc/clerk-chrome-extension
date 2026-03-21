# Codebase Concerns

**Analysis Date:** 2026-03-20

## Tech Debt

**Disabled Supabase Row-Level Security (RLS):**
- Issue: `supabase/migrations/001_tweet_saver.sql` has RLS disabled globally with TODO comment indicating it should be re-enabled once Clerk auth covers Twitter tabs
- Files: `supabase/migrations/001_tweet_saver.sql` (lines 23-30), `src/lib/supabase.ts` (lines 5)
- Impact: All unauthenticated users can read/write all tweets in the database. Data exposure risk. Production deployment risk — tweets should be user-private but currently anyone can access them
- Fix approach: Complete Clerk JWT integration for Supabase (wire up JWT tokens in extension auth flow), then enable RLS policies. Current blocker: Twitter tabs don't have auth flow through Clerk

**Supabase Client Using Anon Key Only:**
- Issue: `src/lib/supabase.ts` creates client with anon key instead of Clerk JWT auth
- Files: `src/lib/supabase.ts` (lines 4, 28-39)
- Impact: Cannot enforce row-level security; all requests are unauthenticated. Blocks implementation of per-user data isolation
- Fix approach: Implement Clerk JWT token extraction in background service worker and pass as authorization header to Supabase client after RLS is enabled

**Unsafe Type Assertions and Ignores:**
- Issue: 117 instances of `any`, `@ts-ignore`, and `as any` throughout codebase
- Files: Systematic across entire `src/` directory (e.g., `src/interceptor.ts` line 240 has `as any satisfies typeof window.fetch`)
- Impact: Loss of type safety; harder to catch bugs at compile time; maintenance burden. Particularly risky in interceptor and network code
- Fix approach: Gradually type-safe critical paths (interceptor, auth, network). Start with files handling auth/security (`src/background.ts`, `src/interceptor.ts`). Consider strict tsconfig settings

**Silent Error Catches:**
- Issue: Multiple `catch() {}` blocks that swallow errors without logging
- Files:
  - `src/popup.tsx` (3 instances of `.catch(() => {})`)
  - `src/hooks/useMessageScanner/store.ts` (2 instances of `catch {}`)
- Impact: Impossible to debug failures; errors silently fail, leading to inconsistent state. Users don't know why operations failed
- Fix approach: Replace with logged error handlers: `catch(err) { debug.error('context', err) }`

**Excessive Console Logging in Production:**
- Issue: 83 console.log/error/warn statements throughout source code
- Files: Scattered across `src/` including `src/background.ts`, `src/interceptor.ts`, `src/content.tsx`
- Impact: Verbose extension logs pollute browser console; could expose sensitive debug info (auth tokens, URLs). Performance impact from logging in tight loops (e.g., interceptor)
- Fix approach: Replace console calls with debug utility (`src/utils/debug.ts`) which respects `PLASMO_PUBLIC_DEBUG` env var. Remove/gate logs not needed for users

**Network Interceptor Cloning Responses:**
- Issue: `src/interceptor.ts` uses `response.clone()` to read response body without consuming original (lines 204-227)
- Files: `src/interceptor.ts` (lines 204-227)
- Impact: Reading response body can fail for some content types (e.g., streams, large files); cloning adds memory overhead. Silent parse failures stored as `{ __parse_error: true }` without logging
- Fix approach: Implement proper response type detection; handle streams/binary data; add fallback handling for unparseable responses

**Token Extraction from DOM Scripts:**
- Issue: `src/hooks/useMessageScanner/rescan.ts` extracts ChatGPT auth tokens by regex-matching DOM script tags (lines 85-101)
- Files: `src/hooks/useMessageScanner/rescan.ts` (lines 85-101)
- Impact: Brittle parsing; if OpenAI changes script content, token extraction breaks silently. Accessing raw DOM tokens is fragile — should rely on network interception
- Fix approach: Remove DOM token extraction; rely solely on network interceptor to capture tokens from `/backend-api/` requests. Add fallback detection with warnings

**localStorage Usage Without Encryption:**
- Issue: `src/components/SelectiveExporter/hooks/usePromptContainers.ts` stores prompt containers (including system prompts) in plain localStorage
- Files: `src/components/SelectiveExporter/hooks/usePromptContainers.ts` (lines 43, 72)
- Impact: Sensitive prompt templates stored unencrypted in browser storage. Accessible to any script with DOM access. Not a direct risk but violates principle of least privilege
- Fix approach: No immediate fix required (user-created data), but document that localStorage is unencrypted. Consider chrome.storage.local if ever storing secrets

## Known Bugs

**Popup Auth State Not Syncing on Login:**
- Symptoms: After logging in via web at `momentum.ubi.studio`, popup still shows as logged out until extension is reloaded
- Files: `src/popup.tsx`, `src/background.ts`
- Trigger: User logs in on web site, then checks extension popup without reloading
- Workaround: Refresh the extension or reload popup
- Root cause: Popup only refreshes auth state when opened; Clerk JWT update in background doesn't trigger popup re-render

**Message Parser Fragility for New Chat Platforms:**
- Symptoms: If OpenAI or Anthropic changes their response format (e.g., new message field names, structure), message parsing silently returns empty messages
- Files: `src/hooks/useMessageScanner/parsers/chatgpt.ts` (212 lines), `src/hooks/useMessageScanner/parsers/claude.ts` (162 lines)
- Trigger: Platform API response format change
- Workaround: Manual conversation re-capture after format change
- Root cause: Parsers use hardcoded field selectors without validation; no version detection or fallback parsing

**Conversation List Rescan Not Reliable:**
- Symptoms: Re-fetching conversation list via `src/hooks/useMessageScanner/rescan.ts` sometimes returns incomplete data or 404s
- Files: `src/hooks/useMessageScanner/rescan.ts` (fetchWithRetry, lines 15-40)
- Trigger: Network latency, timing issues when tab refreshes during rescan
- Workaround: Manual re-capture via UI
- Root cause: fetchWithRetry has max 2 retries with 300-600ms delays; some conversations fail to fetch due to auth state race conditions

## Security Considerations

**postMessage Broadcast with Wildcard Origin:**
- Risk: Network interceptor posts messages to `window.postMessage(message, "*")` without origin verification (multiple instances in `src/interceptor.ts`)
- Files: `src/interceptor.ts` (lines 91, 355)
- Current mitigation: Messages source-checked by listener (`event.source === window`), but wildcard origin means any same-origin frame can receive them
- Recommendations:
  - Change wildcard to specific origin: `window.postMessage(message, window.location.origin)`
  - Add message signing/validation in listeners
  - Document why same-origin-only is acceptable here

**Fetch Credentials in Interceptor:**
- Risk: `src/hooks/useMessageScanner/rescan.ts` line 29 uses `credentials: "include"` when re-fetching conversations
- Files: `src/hooks/useMessageScanner/rescan.ts` (line 29)
- Current mitigation: Only used when user explicitly triggers rescan, not automatic
- Recommendations: OK for now, but add user confirmation/warning if rescan is automated in future

**localStorage Stores User-Provided Data:**
- Risk: LinkedIn prompt containers stored in localStorage include user-provided system prompts and profile JSON
- Files: `src/components/SelectiveExporter/hooks/usePromptContainers.ts`
- Current mitigation: User-created data only, no secrets
- Recommendations: Document that localStorage is unencrypted; add migration path to chrome.storage.local if prompts become sensitive

## Performance Bottlenecks

**Interceptor Cloning All Responses:**
- Problem: `response.clone()` in network interceptor is called for every captured request, including large responses
- Files: `src/interceptor.ts` (line 204)
- Cause: Clone needed to read body without consuming original; but cloning large payloads (e.g., long conversations) has memory overhead
- Improvement path: Implement selective cloning based on content-length; skip body parsing for non-JSON responses; add memory limits

**Message Parser Regex Matching on Large Conversations:**
- Problem: Regex-based message extraction in `src/hooks/useMessageScanner/parsers/chatgpt.ts` and `claude.ts` becomes slow on conversations with 100+ messages
- Files: `src/hooks/useMessageScanner/parsers/chatgpt.ts`, `src/hooks/useMessageScanner/parsers/claude.ts`
- Cause: Linear regex matching; no caching of parsed results
- Improvement path: Cache parsed conversation in sessionStorage; invalidate only on new messages. Add message count limit (e.g., warn at 500+ messages)

**Rescan Retries Block UI:**
- Problem: `fetchWithRetry` with `maxRetries=2` and `baseDelay=300ms` can block UI for 600ms+ if all retries fail
- Files: `src/hooks/useMessageScanner/rescan.ts` (lines 15-40)
- Cause: Synchronous retry loop; no async queueing
- Improvement path: Move retries to worker thread or async queue; show progress UI while retrying

## Fragile Areas

**Network Interceptor (src/interceptor.ts):**
- Files: `src/interceptor.ts` (383 lines)
- Why fragile: Patches `window.fetch` and `XMLHttpRequest.prototype` globally; relies on message queue state. If listener setup fails or timing is wrong, messages are lost. Complex state machine (listenerReady, messageQueue)
- Safe modification:
  - Always test message queueing: send messages before listener ready, verify flush
  - Verify message order and no duplicates in tests
  - Mock fetch/XHR in tests; don't rely on integration with real network
- Test coverage: Exists but incomplete — missing edge cases like failed clones, slow listeners

**Message Scanner Hook (src/hooks/useMessageScanner/):**
- Files: `src/hooks/useMessageScanner/` (240+ lines across multiple files)
- Why fragile: Combines state management (store), network interception (rescan), and message parsing (parsers). State syncs across hooks via shared Map reference. Race conditions possible if multiple tabs update simultaneously
- Safe modification:
  - Add synchronous state transitions; avoid optimistic updates
  - Test with multiple tabs sending messages
  - Use debug logging to trace state changes
- Test coverage: Has tests but coverage gaps in concurrent scenarios

**Clerk Auth Integration (src/background.ts):**
- Files: `src/background.ts` (373 lines)
- Why fragile: Manages client singleton, refresh promises, and stale client detection. Complex logic for cookie-based fallback (lines 76-86, 212-234). Race conditions if multiple refresh requests happen simultaneously
- Safe modification:
  - Add locks to prevent concurrent refreshes
  - Test refresh under network failure
  - Document refresh promise lifecycle
- Test coverage: Minimal — has basic tests but missing auth failure scenarios

**Selective Exporter Component (src/components/SelectiveExporter/):**
- Files: `src/components/SelectiveExporter/` (multiple hooks, views, 1000+ LOC)
- Why fragile: Large component tree with many hooks managing overlapping state (prompt containers, chat entries, settings). Keyboard propagation test (`__tests__/keyboardPropagation.test.tsx`) suggests history of event handling issues
- Safe modification:
  - Update one hook at a time
  - Test all keyboard shortcuts work
  - Verify state changes don't cascade unexpectedly
- Test coverage: Good for individual sections, but missing integration tests for multi-hook interactions

## Test Coverage Gaps

**Network Interceptor Edge Cases:**
- What's not tested:
  - Response clone failures (e.g., unseekable streams)
  - Message loss when listener setup is delayed
  - XHR with custom headers or unusual content types
  - Large response bodies (memory leaks?)
- Files: `src/interceptor.ts`
- Risk: Silent failures; user doesn't know if conversation was captured
- Priority: High — interceptor is core to functionality

**Parser Platform Compatibility:**
- What's not tested:
  - ChatGPT response format changes (new fields, renamed fields)
  - Claude multi-turn conversation structures
  - Edge cases: deleted messages, edited messages, system messages
  - Non-English content
- Files: `src/hooks/useMessageScanner/parsers/chatgpt.ts`, `src/hooks/useMessageScanner/parsers/claude.ts`
- Risk: Messages silently fail to parse; user exports blank conversations
- Priority: High — core feature

**Clerk Auth State Sync:**
- What's not tested:
  - Popup open/close while refresh in progress
  - Multiple background refresh requests
  - Auth token expiration handling
  - Stale client detection accuracy
- Files: `src/background.ts`, `src/popup.tsx`
- Risk: Popup shows wrong auth state; user confused
- Priority: Medium — affects UX

**LinkedIn Helper View:**
- What's not tested:
  - Prompt suggestion building with missing context
  - Chat entry persistence across page reloads
  - localStorage parse failures (corrupt data)
  - Large conversation histories (100+ messages)
- Files: `src/components/SelectiveExporter/views/LinkedInHelperView.tsx`, `src/components/SelectiveExporter/hooks/usePromptContainers.ts`
- Risk: Suggestions fail silently; user loses chat history
- Priority: Medium

## Scaling Limits

**Conversation Storage (Shared Map):**
- Current capacity: Unbounded Map in memory (`src/hooks/useMessageScanner/store.ts` line 9)
- Limit: No garbage collection; conversations accumulate until extension reloads. With 1000+ messages per conversation × 50+ conversations = 100k+ DOM objects in memory
- Scaling path: Add LRU cache with max size; periodically flush old conversations to chrome.storage.session; implement pagination for exports

**Message Parser Regex Performance:**
- Current capacity: Linear time complexity with conversation length
- Limit: 500+ messages in single conversation becomes noticeable; 1000+ messages causes ~1s+ parse time
- Scaling path: Use indexed DOM queries instead of regex where possible; implement streaming parser for large responses; add progress callbacks

**localStorage Quota:**
- Current capacity: 5-10MB per domain (browser-dependent)
- Limit: LinkedIn prompt containers are small, but if conversation history added to localStorage, 1000+ conversations × 50KB each = 50MB+ (exceeds quota)
- Scaling path: Use chrome.storage.local (10MB per extension) for larger data; implement automatic cleanup of old conversations; compress data

## Dependencies at Risk

**@clerk/chrome-extension (^2.8.4):**
- Risk: Pre-release version; API may change. Used for auth in background worker
- Impact: Breaking changes would require rewrite of `src/background.ts` auth flow
- Migration plan: Pin to stable version; monitor Clerk releases; test updates in beta first

**@supabase/supabase-js (^2.94.1):**
- Risk: Depends on JWT auth which is currently not wired up; RLS policies disabled. If Supabase API changes structure, parsing will break
- Impact: Data corruption or loss; auth failures
- Migration plan: Complete RLS setup before next major version upgrade; test with staging database

**plasmo (^0.90.5):**
- Risk: Actively maintained but extension framework; major version bump possible
- Impact: Build/manifest changes; content script injection may break
- Migration plan: Have tested build process for v1.0+; pin to stable range

## Missing Critical Features

**Per-User Data Isolation:**
- Problem: Supabase RLS disabled means no data is user-private. Any user can see all tweets saved by others
- Blocks: Safe cloud storage; sharing/collaboration; multi-user support
- Prerequisite: Complete Clerk JWT integration for Supabase

**Conversation Export Error Handling:**
- Problem: Export fails silently or with generic errors; user doesn't know what went wrong
- Blocks: Reliable user workflows; debugging failed exports
- Prerequisite: Structured error types; user-facing error messages

**Audit Logging:**
- Problem: No logging of what data was exported, when, or by whom
- Blocks: Compliance; debugging data issues; user accountability
- Prerequisite: Add audit table to Supabase with user_id, conversation_id, export_type, timestamp

---

*Concerns audit: 2026-03-20*
