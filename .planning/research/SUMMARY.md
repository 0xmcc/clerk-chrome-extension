# Project Research Summary

**Project:** YouTube Transcript Feature (clerk-chrome-extension milestone)
**Domain:** Chrome extension transcript viewer with clip creation
**Researched:** 2026-03-20
**Confidence:** HIGH

## Executive Summary

This is an additive feature to an existing Chrome extension. The transcript viewer, timestamp seeking, playback sync, and clip creation are all achievable without new heavy dependencies — every problem area has a clean solution using native DOM APIs, React built-ins, and the existing stack (defuddle, Supabase, Clerk). The integration surface is narrow: four existing files modified, five new files created, one Supabase migration. All research files agree on the module structure and approach.

The recommended build order is foundation-first: get transcript extraction and rendering working correctly before adding playback sync, then selection, then persistence. Two pitfalls must be addressed at foundation time rather than deferred — YouTube's SPA navigation (stale transcripts on video switch) and the isolated world seek issue (timestamps clicking but video not actually moving). Both are easy to miss in a YouTube-only test session but will surface immediately in real use.

The one genuine tech debt decision is Supabase RLS. The existing tweets table has RLS disabled due to unresolved Clerk JWT forwarding. The clips table should NOT inherit this pattern — enable RLS from day one and wire Clerk JWT at clip-save time using Supabase's native third-party auth (post-April 2025 pattern). Deferring this creates a data privacy problem that requires a migration and backfill later.

---

## Key Findings

### Recommended Stack

No new dependencies are required for core functionality. The entire feature is built on what already exists: defuddle 0.10.0 for transcript extraction (confirmed to produce `## Transcript` markdown from `ytInitialPlayerResponse`), React refs + native `timeupdate` events for playback sync, `navigator.clipboard.writeText()` (already proven working in this codebase's Shadow DOM content script), and direct `video.currentTime` writes for seeking.

`react-window` is the one optional addition worth taking — it is small (~6KB gzipped), Shadow DOM compatible, and required to avoid a 200–500ms render freeze on 2-hour videos with 2,000–4,000 segments. This qualifies as a "light dependency for a real problem" rather than a heavy dep.

**Core technologies:**
- defuddle 0.10.0: transcript extraction from live YouTube DOM — already in stack, confirmed working
- React refs + `timeupdate`: playback sync — avoids 4–66 re-renders/second from `currentTime` in state
- `navigator.clipboard.writeText()`: clip copy — proven working in existing `useExportActions.ts:249`
- `video.currentTime` write: seeking — direct DOM access from content script (isolated world caveat, see Pitfalls)
- Supabase + Clerk JWT: clip persistence — use native third-party auth pattern, NOT deprecated JWT template

### Expected Features

**Must have (table stakes):**
- Clickable timestamps that seek the video — highest perceived value, first thing users expect
- Active segment highlighted during playback — absence is immediately noticeable
- Auto-scroll transcript to active segment (with 3-second pause on user scroll)
- Chapter headings as section separators — defuddle provides these, cost is near zero
- Loading skeleton rows (not spinner), distinct error state, distinct empty/no-transcript state

**Should have (differentiators):**
- Two-click span selection for clip creation — no YouTube-native equivalent
- One-action clip save + clipboard copy in a single gesture
- Auto-generated clip title with timestamp range in `[M:SS–M:SS]` format
- Clipboard format with `?t=` deep-link URL for shareable clips

**Defer to future milestone:**
- Saved clips list/management view — Supabase data will be there; build the viewer later
- Search within transcript — browser native Ctrl+F works in Shadow DOM
- Offset calibration control for transcript sync drift
- Multi-language transcript switching

### Architecture Approach

The feature slots cleanly into the existing layered dispatch model. `content.tsx` calls a new `useYouTubeTranscript()` hook and threads its result into `useCaptureSource`, which gets a new YouTube branch that fires before the `page_markdown` fallback. `SelectiveExporter` renders a new `YouTubeTranscriptView` when `captureMode === "youtube_transcript"`. A new `clip-service.ts` handles Supabase insert and clipboard formatting. No existing code paths are deleted or restructured.

**Major components:**

1. `lib/transcript-parser.ts` — pure function: defuddle markdown → `TranscriptSegment[]`, plus `findActiveSegmentIndex` and `timestampToSeconds`. Zero dependencies, fully testable with Vitest.
2. `hooks/useYouTubeTranscript.ts` — owns transcript state, `timeupdate` listener, `seekTo`. Safe to call unconditionally on all pages (returns empty result on non-YouTube). Called once in `content.tsx`; full return value threaded to `SelectiveExporter`.
3. `components/SelectiveExporter/views/YouTubeTranscriptView.tsx` — renders segments, manages two-click selection state, triggers clip creation.
4. `components/SelectiveExporter/services/clip-service.ts` — `saveClip()` (Supabase insert) and `formatClipForClipboard()`. Calls `requestClerkToken()` fresh at save time, never caches token.
5. `supabase/migrations/002_clips.sql` — creates `clips` table with RLS enabled from day one.

**Files modified (4):** `platform.ts`, `capture.ts`, `useCaptureSource.ts`, `content.tsx`, `SelectiveExporter/index.tsx`, `SelectiveExporter/types.ts`, `SelectiveExporter/hooks/useViewState.ts`

**Files created (5):** `transcript-parser.ts`, `transcript-parser.test.ts`, `useYouTubeTranscript.ts`, `YouTubeTranscriptView.tsx`, `clip-service.ts`, `002_clips.sql`

### Critical Pitfalls

1. **YouTube SPA navigation leaves stale transcript** — `history.pushState` changes do not reinject content scripts. Listen to `yt-navigate-finish` DOM event; compare current `videoId` to a stored ref; re-run extraction on change. Also debounce 500ms after navigation before calling defuddle (new `ytInitialPlayerResponse` may not yet be injected).

2. **Isolated world seek may be ignored by YouTube's player** — `video.currentTime` writes from an isolated-world content script work on the DOM property but may bypass YouTube's internal seek queue, causing seeks to snap back. Test this on day one of implementation. Fallback: use `world: "MAIN"` in Plasmo content script config to inject into the main world instead.

3. **Supabase RLS disabled (inherited tech debt)** — the existing tweets table has RLS off because Clerk JWT forwarding is not wired. The clips table must NOT repeat this. Enable RLS in the migration from day one. Use Supabase's native third-party auth (register Clerk as third-party provider; pass Clerk session token as `Authorization: Bearer` header). The Clerk JWT `sub` claim is the user ID for RLS policies.

4. **Clipboard blocked after async `await`** — if the clip-save flow is click → await Supabase → then clipboard write, the transient activation window may have expired. Write to clipboard synchronously in the click handler first; fire the Supabase insert as a non-blocking side effect afterward. Wrap clipboard write in try/catch with user-visible error.

5. **defuddle returns null with no error** — many videos legitimately have no transcript (age-restricted, live, no captions, < 15 min old, private). Check for `## Transcript` heading presence before any parsing. Map null/missing to a distinct `NO_TRANSCRIPT` terminal state with a human-readable message. Never call string methods on defuddle output without null-checking.

---

## Implications for Roadmap

### Phase 1: Transcript Extraction and Display

**Rationale:** Everything else depends on `TranscriptSegment[]` existing and rendering. Unblocks all subsequent phases. Also the safest phase — pure parsing logic is trivially testable before any DOM interaction.

**Delivers:** `transcript-parser.ts` (with Vitest tests), `useYouTubeTranscript` (extraction only, no playback sync yet), `YouTubeTranscriptView` (static render with timestamps and chapter headings), loading/error/empty states.

**Addresses:** All table-stakes features except active-segment highlighting. Covers defuddle null handling (Pitfall 1) and SPA navigation detection (Pitfall 3) from day one.

**Critical at this phase:** SPA navigation listener (`yt-navigate-finish`) must be built into `useYouTubeTranscript` here — not deferred. Getting it wrong at display time means everything downstream is broken for multi-video sessions.

### Phase 2: Playback Sync and Seek

**Rationale:** Active segment highlighting is the feature that makes the transcript feel live vs. static. Seeking is the highest-value single interaction. Both depend on Phase 1 segments being stable.

**Delivers:** `timeupdate` listener wired into `useYouTubeTranscript`, `activeSegmentIndex` tracking via binary search, auto-scroll with 3-second user-scroll pause, clickable timestamps calling `seekTo()`.

**Critical at this phase:** Test isolated-world seek behavior on day one (Pitfall 2). If `video.currentTime` writes snap back, switch to `world: "MAIN"` immediately. Do NOT store `currentTime` in React state — use refs + direct DOM class mutation for active segment highlight (prevents 4–66 re-renders/sec).

**Performance:** If testing on a 2-hour video shows render lag, integrate `react-window` at this phase (required for the scrollable list when virtualization matters).

### Phase 3: Selection and Clip Creation

**Rationale:** Depends on Phase 2 seeking being stable (clip start/end positions must be accurate). The two-click selection model and clip action bar are self-contained within `YouTubeTranscriptView`.

**Delivers:** Two-click span selection with visual range feedback, "Create Clip" action bar, `clip-service.ts` with Supabase insert + clipboard formatter, `002_clips.sql` migration with RLS enabled.

**Critical at this phase:** Clipboard write before Supabase await (Pitfall 4). RLS enabled in migration from day one — do not copy the tweets table pattern (Pitfall 5). Call `requestClerkToken()` fresh at save time, not on panel open (Pitfall 10: token expiry).

### Phase Ordering Rationale

- Phases are strictly dependency-ordered: parsing → display → sync → interaction → persistence.
- SPA navigation (Pitfall 3) and defuddle null handling (Pitfall 1) are addressed in Phase 1 because they affect the correctness of all downstream phases, not just extraction.
- Isolated world seek (Pitfall 2) is addressed in Phase 2 because it is a test-first, fallback-if-needed pitfall — not a design decision that needs to be made upfront.
- RLS (Pitfall 5) is addressed in Phase 3 because that is when the Supabase table is created. Deferring RLS beyond table creation is the mistake to avoid.

### Research Flags

Phases with confirmed patterns (no additional research needed):
- **Phase 1 (Extraction/Display):** defuddle format confirmed from live page. Parser regex fully specified. Shadow DOM rendering follows existing SelectiveExporter patterns.
- **Phase 2 (Playback Sync):** `timeupdate` pattern verified against Metaview engineering blog and MDN. Binary search for active segment is standard.
- **Phase 3 (Clip Creation):** Supabase insert pattern follows existing `tweet-saver.ts`. Clipboard pattern follows existing `useExportActions.ts`.

Phases needing early validation (not research, just test-first):
- **Phase 2:** Isolated world seek behavior on youtube.com — test on day one, not after building the full selection UI.
- **Phase 3:** Clerk JWT forwarding to Supabase — verify the native third-party auth setup works in the extension context before building the full save flow.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tech confirmed against existing codebase and official sources. No new dependencies required for core; `react-window` optional for perf. |
| Features | HIGH | Patterns verified across Tactiq, Descript, Kaltura, video.js transcript plugin, BBC react-transcript-editor. Two-click selection confirmed over drag for Shadow DOM. |
| Architecture | HIGH | Every architectural decision traced to an existing file in the codebase. No speculative patterns. |
| Pitfalls | HIGH | Most pitfalls confirmed via official Chrome extension docs, defuddle source analysis, and the existing codebase's own tech debt (RLS TODO comments). |

**Overall confidence:** HIGH

### Conflicts and Open Questions Between Research Files

**Minor conflict — `useYouTubeTranscript` call site:** ARCHITECTURE.md explores two options: (a) call once in `content.tsx` and thread full result to `SelectiveExporter`, or (b) call in `SelectiveExporter/index.tsx` directly. It recommends option (a) as simpler. STACK.md describes the hook as living in `src/hooks/` and being called from `content.tsx`. These are consistent — the "exploration" in ARCHITECTURE.md resolves in favor of option (a). No conflict.

**Open question — isolated world seek:** STACK.md says `video.currentTime` write is confirmed working (HIGH confidence). PITFALLS.md says it "may be silently ignored or reverted by YouTube's internal state management." The resolution is: it likely works but must be verified on day one of Phase 2, with `world: "MAIN"` as a ready fallback. This is a test-first, not a design-first question.

**Open question — `react-window` dependency:** FEATURES.md lists it as "out of scope for table stakes" but PITFALLS.md says it is the standard solution to a real perf problem (2-hour videos). The resolution: include `react-window` in Phase 2 scope, gate on measured performance — if a 2-hour video shows > 200ms paint delay, add it. Document the decision point in requirements.

### Gaps to Address in Requirements

- Confirm whether `requestClerkToken()` background message works correctly when called from the content script's clip-save flow (synchronous user gesture → async message → async Supabase). This is an existing proven pattern (tweet saver), but should be validated specifically for the click → async chain.
- Confirm Supabase native third-party Clerk auth setup steps for local dev (`supabase/config.toml` changes required).
- Define the exact video title source: does defuddle's `title` field match what YouTube shows, or does the content script need to read `document.title` directly? Requirements should specify.

---

## Sources

### Primary (HIGH confidence)

- Existing codebase (`src/hooks/useCaptureSource.ts`, `src/lib/capture.ts`, `src/lib/pageCapture.ts`, `src/lib/tweet-saver.ts`, `src/components/SelectiveExporter/`, `src/content.tsx`) — architecture patterns
- defuddle source: `github.com/kepano/defuddle/blob/main/src/extractors/youtube.ts` — transcript extraction behavior
- MDN HTMLMediaElement `timeupdate` + `currentTime` — playback sync APIs
- Chrome Extensions docs: content scripts, isolated world, clipboard — `developer.chrome.com`
- Supabase + Clerk native third-party auth: `supabase.com/docs/guides/auth/third-party/clerk`
- Existing `supabase/migrations/001_tweet_saver.sql` — RLS disabled pattern (confirmed tech debt to not repeat)

### Secondary (MEDIUM confidence)

- Metaview engineering blog: syncing transcript with audio in React — `timeupdate` + refs performance pattern
- video.js transcript plugin — auto-scroll pause/resume contract
- Mux: interactive video transcript with CuePoints — event-driven sync
- YouTube `yt-navigate-finish` SPA navigation event — community-confirmed, no official docs

### Tertiary (reference only)

- Tactiq, Glasp, Descript, Kaltura, Language Reactor — feature expectation benchmarking
- LogRocket: skeleton loaders vs. spinners for structured content

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
