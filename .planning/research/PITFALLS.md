# Domain Pitfalls

**Domain:** YouTube Transcript Chrome Extension (Plasmo MV3 + defuddle + Supabase)
**Researched:** 2026-03-20
**Milestone:** YouTube transcript extraction, timestamp seeking, clip creation

---

## Critical Pitfalls

Mistakes that cause rewrites or silent feature failure.

---

### Pitfall 1: defuddle Returns No Transcript — Silent Empty State

**What goes wrong:** defuddle's YouTube extractor reads `ytInitialPlayerResponse` inline JSON and looks for `captions.playerCaptionsTracklistRenderer.captionTracks`. When this array is absent or empty, the extractor returns `null` with no error thrown. The sidebar renders with no content and the user has no explanation.

**Why it happens:** Many videos legitimately have no transcript. The full list of failure conditions:
- **No captions at all:** Creator disabled auto-captions or manually deleted them
- **Age-restricted videos:** The `ytInitialPlayerResponse` payload returned to an unauthenticated page viewer omits caption track data
- **Live streams (active):** Caption tracks only appear after the live stream concludes and YouTube processes the recording (can take hours)
- **Videos with only auto-generated captions in an unsupported language:** defuddle uses the first available track; non-Latin scripts with poor ASR may return garbled text
- **Very new videos (< ~15 minutes old):** Auto-caption processing lag means `captionTracks` is not yet populated in the initial payload
- **Private / unlisted videos viewed when not the owner:** Same as age-restricted — API returns a restricted payload

**Consequences:** If the code checks `if (transcript)` and renders nothing without a message, users assume the extension is broken. If the code throws on `transcript.split('\n')`, it crashes the sidebar.

**Prevention:**
1. Treat `null` / empty string from defuddle as a distinct `NO_TRANSCRIPT` state, not an error
2. Map the failure to a human-readable message: "No transcript available — this video may be age-restricted, a live stream, or have captions disabled"
3. Never call string/array methods on defuddle output without null-checking first
4. Test explicitly against a known no-caption video URL before shipping

**Detection:** Integrate a transcript availability check before attempting to parse — if `contentMarkdown` contains no `## Transcript` heading, treat as unavailable immediately

---

### Pitfall 2: video.currentTime Seek Fails in Isolated World Context

**What goes wrong:** Chrome MV3 content scripts run in an **isolated world** by default. While they share the DOM with the host page, they do NOT share the JavaScript execution context. Setting `document.querySelector('video').currentTime = 42` from isolated world code operates on the same DOM element, so it physically works for standard HTML5 video — but YouTube's player watches for seek events through its own JS layer. The seek may be silently ignored or reverted by YouTube's internal state management if the seek is not dispatched from the player's own JS context.

**Why it happens:** YouTube's custom player (`ytd-player`) overrides native video element behavior. The `currentTime` property setter on the player's wrapped video element may interact with YouTube's internal seek queue. From the isolated world, you write to the raw DOM property but bypass the player's JS event handlers.

**Consequences:** Clicking a timestamp appears to do nothing, or seeks briefly and immediately snaps back to the original position.

**Prevention:**
- Verify behavior early (first day of implementation) by manually testing a seek from the content script on youtube.com/watch
- If the isolated-world approach fails, the reliable fallback is injecting a small `<script>` tag into the page's main world that receives the target time via a `CustomEvent` and calls `document.querySelector('video').currentTime = t` from within the page's own JS context
- Plasmo supports `world: "MAIN"` in content script config for direct main-world injection — prefer this over injecting `<script>` tags
- Do NOT attempt to use `chrome.tabs.executeScript` from a content script; that API is not available in content script context

**Detection:** After implementing, check that seeking actually changes playback position AND that YouTube's progress bar and time display update. A visual DOM change without the player advancing is the failure signal.

---

### Pitfall 3: YouTube SPA Navigation Does Not Reinject Content Scripts

**What goes wrong:** YouTube is a full SPA. Navigating from `watch?v=A` to `watch?v=B` via the sidebar, autoplay, or homepage does not trigger a page reload. Plasmo's content script is injected once on initial load. The transcript sidebar will retain stale transcript data from video A when the user is actually watching video B.

**Why it happens:** `history.pushState` / `replaceState` changes the URL without triggering the browser's standard page lifecycle that would cause Plasmo to reinject the content script. `chrome.webNavigation.onHistoryStateUpdated` fires in the background service worker but does NOT cause content script re-execution.

**Consequences:** The sidebar shows the wrong transcript. Clicking timestamps seeks the wrong video, or seeks to correct positions in the new video but matched against the old transcript.

**Prevention:**
1. Listen to YouTube's custom `yt-navigate-finish` DOM event from inside the content script: `window.addEventListener('yt-navigate-finish', handleVideoChange)`. This fires reliably when YouTube completes an SPA navigation.
2. As a belt-and-suspenders fallback, also listen to `popstate` and a MutationObserver on `document.title` (YouTube updates the title on video change).
3. On each navigation event, check if `window.location.href` has changed from the last known URL and re-run transcript extraction if so.
4. Store the last-known `videoId` in a ref inside the React component, compare on each navigation event, and only trigger a re-fetch when the ID changes.
5. Add a `useEffect` with `[videoId]` dependency that clears transcript state on `videoId` change — preventing stale segments from flash-rendering before the new extraction completes.

**Detection:** Navigate between two YouTube videos without reloading the page. Verify the sidebar transcript switches.

---

### Pitfall 4: Clipboard Write Blocked in MV3 Content Script on http Pages

**What goes wrong:** `navigator.clipboard.writeText()` is a Secure Context API. It only works on `https://` pages. YouTube is `https://` so this is not a YouTube-specific problem, but it becomes a problem if the extension ever runs on `http://` origins, or if the call is made outside a user gesture ("transient activation").

**The Shadow DOM angle is a non-issue:** Shadow DOM does not restrict `navigator.clipboard`. The clipboard API operates on the document's security context, not the DOM tree position of the calling code. A React component rendered inside Shadow DOM still has access to the page's `navigator.clipboard` as long as the host page is HTTPS and the call originates from a user gesture.

**What IS an issue:** The call must happen synchronously within a click handler. If the clip-save flow is: click → async Supabase insert → then clipboard write — the clipboard call happens after an `await`, which voids the transient activation requirement in some browsers. Chrome is lenient here with `clipboardWrite` manifest permission, but this is a fragile assumption.

**Consequences:** "Copy to clipboard" fails silently or throws a `NotAllowedError` that is swallowed.

**Prevention:**
1. Add `"clipboardWrite"` to `permissions` in the Plasmo manifest (via `package.json` `manifest` field)
2. Perform clipboard write first (or simultaneously), before awaiting the Supabase insert. Alternatively, write to clipboard in the synchronous click handler and fire the Supabase insert as a non-blocking side effect
3. Add an explicit try/catch around `navigator.clipboard.writeText()` with user-visible fallback (e.g., select-all on a hidden textarea)
4. If Supabase save fails but clipboard write succeeded, notify the user of the partial success

**Detection:** Test clip copy with DevTools network throttled to "Slow 3G" — the transient activation window expires while Supabase is awaiting.

---

### Pitfall 5: Supabase RLS Not Wired Up — Clips Are World-Readable

**What goes wrong:** The existing codebase has RLS explicitly disabled (`CONCERNS.md`, `001_tweet_saver.sql` line 24) because Clerk JWT is not yet passed to the Supabase client. The `supabase.ts` client uses anon key only. If a `clips` table is created with the same pattern, every user's clips are readable and writable by any user.

**Why it happens:** The existing tech debt (Supabase anon-key-only client, no JWT forwarding) will be inherited by the clips table unless explicitly addressed in this milestone.

**The correct Clerk + Supabase RLS pattern (post-April 2025):**
- Clerk JWT template approach is deprecated as of April 1, 2025
- Use Supabase's native third-party auth: register Clerk as a third-party provider in the Supabase dashboard (`supabase/config.toml` for local dev: `[auth.third_party.clerk]`)
- Pass Clerk's session token as the `Authorization: Bearer <token>` header when creating the Supabase client — Supabase will validate it natively without needing the JWT secret shared with Clerk
- RLS policy pattern: `USING (user_id = (auth.jwt() ->> 'sub'))` — the `sub` claim in the Clerk JWT is the Clerk user ID
- The `user_id` column on the clips table must be populated with `auth.jwt() ->> 'sub'` at insert time or enforced via a `WITH CHECK` policy

**Consequences:** Without this, any authenticated Supabase request (even with anon key) can read all clips. Users' saved clips are not private.

**Prevention:**
1. Create the clips migration with RLS **enabled from day one** — do not repeat the `tweets` table pattern
2. The migration should include: `ALTER TABLE clips ENABLE ROW LEVEL SECURITY;` plus SELECT, INSERT, UPDATE, DELETE policies all scoped to `auth.jwt() ->> 'sub'`
3. Wire up JWT forwarding in `src/lib/supabase.ts` before implementing clip save — the Supabase client needs to receive the Clerk token via `global.headers` or `accessToken` option
4. The `requestClerkToken()` function in `src/background.ts` already exists — use it to get the token and pass it when constructing the per-request Supabase client

**Detection:** With RLS enabled, attempt to read clips from a second user account (or with no auth). Supabase should return zero rows.

---

## Moderate Pitfalls

---

### Pitfall 6: Large Transcript Render Lag (2-hour videos)

**What goes wrong:** A 2-hour video can have 2,000–4,000 transcript segments. Rendering all of them as React DOM nodes simultaneously causes a noticeable UI freeze on initial load (empirically: 2,000+ list items causes ~200–500ms paint delay).

**Why it happens:** Each segment is a `<div>` with timestamp, text, and selection state. 4,000 DOM nodes inside a Shadow DOM with Tailwind pixel-converted styles is a significant initial render.

**Prevention:**
1. Use `react-window` (`FixedSizeList` or `VariableSizeList`) for the transcript scroll container — it only renders ~30 visible rows at any time. This is the standard solution; it has been confirmed to reduce initial render from 2-3 seconds to under 100ms for 5,000+ items
2. `react-window` is small (~6KB gzipped) and compatible with Shadow DOM — the scroll container just needs an explicit `height` in pixels (not `100vh`, which doesn't resolve correctly inside Shadow DOM)
3. Alternatively, render in chunks: use `requestIdleCallback` to append segments in batches of 200 after the initial paint
4. Auto-scroll to the active segment uses `scrollToItem` from `react-window`'s list ref, not a DOM `scrollIntoView` call (which breaks with virtualization)

**Detection:** Load the extension on a known 2-hour video (e.g., a conference talk). Open sidebar, measure time from open to interactive via DevTools Performance tab.

---

### Pitfall 7: defuddle Markdown Parse Breaks on Edge-Case Timestamp Formats

**What goes wrong:** defuddle's transcript markdown format is documented as `**M:SS**` or `**H:MM:SS**`. However, the actual YouTube caption data can produce edge cases:
- Timestamps at exactly 0 seconds: `**0:00**`
- Hours > 9: `**10:01:23**` (3 digits for hours)
- Segments with no text (blank captions used as scene markers)
- The bullet `•` separator between sub-second segments can appear multiple times in one "second" block

**Prevention:**
1. Write the timestamp parser as a regex that handles 2–3 digit hours: `(\d{1,2}):(\d{2})(?::(\d{2}))?`
2. Test the parser against a timestamp converter covering all formats before the rendering component consumes it
3. Skip segments where `text.trim() === ''` rather than rendering empty timestamp rows
4. Treat `•`-joined sentences within one timestamp as a single displayable segment (concatenate them)

**Detection:** Run the parser against a long video with chapter markers and a video with hours (> 60 min) before marking the milestone complete.

---

### Pitfall 8: defuddle Called on Stale / Partially-Loaded YouTube DOM

**What goes wrong:** defuddle's YouTube extractor reads `ytInitialPlayerResponse` from the inline `<script>` tags in the page DOM. On SPA navigation (pitfall 3), the new video's `ytInitialPlayerResponse` is injected into the page by YouTube's JS — but if defuddle is called too early (e.g., immediately on `yt-navigate-finish`), the new script tag may not yet be present or may still contain the previous video's data.

**Prevention:**
1. After `yt-navigate-finish`, wait for the `<video>` element's `src` to change OR poll for the new `videoId` in the URL to appear in a `<script>` tag before calling defuddle
2. A reliable signal: the video `loadedmetadata` event fires when the new video is ready — hook into `document.querySelector('video').addEventListener('loadedmetadata', ...)` after navigation
3. Set a minimum debounce of 500ms after navigation before calling defuddle to let YouTube inject the new player response

---

## Minor Pitfalls

---

### Pitfall 9: Shadow DOM Height for Scroll Container

**What goes wrong:** `height: 100vh` inside Shadow DOM resolves to the viewport height of the host page, which may be correct, but `100%` height does not work if parent containers don't have explicit heights. `react-window` requires a fixed pixel height on its scroll container.

**Prevention:** Pass the container height as a calculated pixel value: `window.innerHeight - HEADER_HEIGHT_PX`. Update on window resize via a `ResizeObserver`.

---

### Pitfall 10: Clerk Token Expiry Mid-Session

**What goes wrong:** Clerk JWTs have short lifetimes (~1 minute). A clip save that happens after a long session without panel interaction may use a stale token, causing the Supabase RLS check to fail.

**Prevention:** Call `requestClerkToken()` fresh at clip-save time (not on panel open). The existing `requestClerkToken()` in `background.ts` handles refresh internally — just ensure it is called per-operation, not cached in component state.

---

### Pitfall 11: MV3 Service Worker Cannot Use clipboard API

**What goes wrong:** If any code path routes the "copy to clipboard" operation through `chrome.runtime.sendMessage` to the background service worker, it will fail — service workers have no access to `navigator.clipboard`.

**Prevention:** All clipboard operations must happen in the content script (in the page context), never in the background service worker. The clip copy is already in-page, so this is only a risk if someone refactors the save flow to go through background.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Transcript extraction | defuddle returns null silently | Guard with null check + empty state message before any parsing |
| YouTube SPA navigation | Stale transcript on video switch | `yt-navigate-finish` listener + videoId change detection |
| Timestamp seek | Isolated world ignores seek | Test on first day; fall back to `world: "MAIN"` or script injection |
| Clip save | Clipboard blocked after async await | Write clipboard synchronously in click handler before awaiting Supabase |
| Clips table migration | RLS disabled (inherited tech debt) | Enable RLS in migration from day one; wire Clerk JWT before implementing save |
| Large transcripts | React render freeze | Use `react-window` for the segment list; measure on a 2-hour video early |
| defuddle timing on SPA nav | Stale `ytInitialPlayerResponse` | Debounce + wait for `loadedmetadata` before calling defuddle |
| MV3 clipboard routing | Service worker clipboard failure | Clipboard stays in content script; never route through background |

---

## Sources

- defuddle YouTube extractor analysis (live): https://github.com/kepano/defuddle/blob/main/src/extractors/youtube.ts
- Chrome Extensions content scripts (isolated world, DOM sharing): https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- YouTube SPA navigation detection (`yt-navigate-finish`): https://github.com/Zren/ResizeYoutubePlayerToWindowSize/issues/72
- `chrome.webNavigation.onHistoryStateUpdated` for SPA: https://developer.chrome.com/docs/extensions/reference/api/webNavigation
- MV3 clipboard API in content scripts: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
- MV3 clipboard gotchas (service worker): https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3
- Clipboard privileged extension proposal: https://github.com/w3c/webextensions/issues/378
- Supabase + Clerk native integration (post-April 2025): https://supabase.com/docs/guides/auth/third-party/clerk
- Supabase RLS with third-party JWT: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase `auth.jwt()` ->> 'sub' pattern: existing codebase `001_tweet_saver.sql` (commented RLS policies, lines 28-30)
- react-window virtualization benchmarks: https://web.dev/virtualize-long-lists-react-window/
- Age-restricted / private video transcript limits: https://apify.com/streamers/youtube-scraper/issues/can-we-get-the-subti-g3RJcZ2Z6E8GalPJK
