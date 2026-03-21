# Roadmap: YouTube Transcript Feature

## Overview

Three phases deliver a fully interactive transcript sidebar from scratch: Phase 1 extracts and renders the static transcript, Phase 2 wires it to live video playback so it follows the viewer, and Phase 3 turns selections into saveable, shareable clips. Each phase is shippable and testable on its own; each one unblocks the next.

## Phases

- [ ] **Phase 1: Transcript Extraction and Display** - Parse and render the full transcript in the sidebar with loading, error, and empty states
- [ ] **Phase 2: Playback Sync and Seek** - Highlight the active segment during playback and seek the video on timestamp click
- [ ] **Phase 3: Selection and Clip Creation** - Two-click span selection with one-action clip save to Supabase and clipboard

## Phase Details

### Phase 1: Transcript Extraction and Display
**Goal**: Users can open the sidebar on any YouTube watch page and read the full transcript with chapter headings, formatted timestamps, and appropriate loading/empty/error states.
**Depends on**: Nothing (first phase)
**Requirements**: EXTR-01, EXTR-02, EXTR-03, EXTR-04, EXTR-05, EXTR-06, EXTR-07, EXTR-08, DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Opening the sidebar on a YouTube watch page shows the transcript — formatted timestamps left-aligned, chapter headings as section separators, segment text readable
  2. Navigating from one video to another within YouTube (SPA navigation) replaces the transcript with the new video's content without a page reload
  3. A video with no transcript shows a distinct human-readable empty state (not a blank panel, not an error)
  4. A defuddle extraction failure shows a distinct error state (not the empty state, not a spinner stuck forever)
  5. Skeleton rows appear while the transcript is loading (not a spinner)
**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md — TDD transcript parser (TranscriptSegment type, parseTranscriptMarkdown, timestampToSeconds, formatTimestamp, findActiveSegmentIndex)
- [ ] 01-02-PLAN.md — Platform/capture type extensions + useYouTubeTranscript hook (defuddle extraction, SPA nav listener, status management)
- [ ] 01-03-PLAN.md — YouTubeTranscriptView component + full wiring (useCaptureSource, content.tsx, SelectiveExporter view dispatch)

**Files created:**
- `src/lib/transcript-parser.ts` — pure fn: defuddle markdown → `TranscriptSegment[]`, `timestampToSeconds`, `findActiveSegmentIndex`
- `src/lib/transcript-parser.test.ts` — Vitest unit tests for parser (all timestamp formats, chapter headings, NO_TRANSCRIPT state, null input)
- `src/hooks/useYouTubeTranscript.ts` — transcript state, SPA navigation listener, defuddle invocation; playback sync added in Phase 2
- `src/components/SelectiveExporter/views/YouTubeTranscriptView.tsx` — static segment list, loading/error/empty states; seek + selection added in later phases

**Files modified:**
- `src/utils/platform.ts` — add `"youtube"` to `Platform` union and `detectPlatform()`
- `src/lib/capture.ts` — add `YouTubeTranscriptCapture`, `CaptureMode: "youtube_transcript"`, `CaptureSurface: "youtube_watch"`
- `src/hooks/useCaptureSource.ts` — add youtube branch before `page_markdown` fallback; accept `youtubeSegments` param
- `src/content.tsx` — call `useYouTubeTranscript()` unconditionally, thread result to `SelectiveExporter`
- `src/components/SelectiveExporter/index.tsx` — render `YouTubeTranscriptView` when `captureMode === "youtube_transcript"`
- `src/components/SelectiveExporter/types.ts` — add `"youtube_transcript"` to `ViewMode`; extend `SelectiveExporterProps`

**Critical notes:**
- Wire `yt-navigate-finish` listener and 500ms debounce in `useYouTubeTranscript` at this phase — stale transcripts on SPA nav will corrupt all downstream phases if deferred
- Write parser tests BEFORE implementing the parser — `M:SS` / `H:MM:SS` / bullet-stripped text / chapter headings / absent `## Transcript` heading are all edge cases that need coverage first
- Never call string methods on defuddle output without null-checking; map null/missing to `NO_TRANSCRIPT` terminal state before parsing
- Video title source: use defuddle `title` field, fall back to `document.title` if empty (INFRA-04)
- `useYouTubeTranscript` must return empty result on non-YouTube pages — it is called unconditionally in `content.tsx` to satisfy React hook ordering rules

### Phase 2: Playback Sync and Seek
**Goal**: The active transcript segment is highlighted and the panel auto-scrolls to it during playback; clicking any timestamp seeks the video to that position.
**Depends on**: Phase 1
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SEEK-01, SEEK-02, SEEK-03, DISP-07
**Success Criteria** (what must be TRUE):
  1. While the video plays, the current segment is visually highlighted and the transcript panel scrolls to keep it visible
  2. Manually scrolling the transcript pauses auto-scroll for 3 seconds, then auto-scroll resumes automatically
  3. Clicking a timestamp seeks the video to that position and resumes auto-scroll immediately (even within the 3-second pause)
  4. Seeking clears any active clip selection (no stale selection after the user jumps position)
  5. A 2-hour video (2,000-4,000 segments) renders without a visible paint freeze — virtualization added via `react-window` if manual testing shows > 200ms initial paint delay
**Plans**: TBD

**Files extended:**
- `src/hooks/useYouTubeTranscript.ts` — add `timeupdate` listener (via ref, not state), `findActiveSegmentIndex` binary search, `seekTo()`, `MutationObserver` guard for late `<video>` mount
- `src/components/SelectiveExporter/views/YouTubeTranscriptView.tsx` — active segment highlight (DOM class mutation, not React state re-render), auto-scroll with pause/resume contract, timestamp click handler calling `seekTo`

**Conditional:**
- Add `react-window` dependency and virtualize segment list if a 2-hour video shows > 200ms initial paint delay in manual testing — decision point is explicit, not automatic

**Critical notes:**
- Test isolated-world `video.currentTime` write on day one of this phase — if YouTube player reverts the seek, switch the content script to `world: "MAIN"` in Plasmo config immediately; do NOT build the full selection UI before validating this
- Do NOT store `currentTime` in React state — use refs + direct DOM class mutation for active segment highlight; `timeupdate` fires 4-66 times/second and React state would cause proportional re-renders
- Auto-scroll must target the sidebar panel's scrollable container ref — NOT `document.querySelector(...)` on the host page; everything is inside Shadow DOM

### Phase 3: Selection and Clip Creation
**Goal**: Users can select a span of transcript segments with two clicks and create a named clip — saved to Supabase and copied to clipboard — in a single action.
**Depends on**: Phase 2
**Requirements**: CLIP-01, CLIP-02, CLIP-03, CLIP-04, CLIP-05, CLIP-06, CLIP-07, CLIP-08, CLIP-09, CLIP-10, CLIP-11, CLIP-12, INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. First click on a segment starts a selection; second click on a different segment highlights the span between them and shows a "Create Clip" action bar
  2. Pressing Escape or clicking outside the transcript container clears the selection without any other side effect
  3. Clicking "Create Clip" writes the formatted clip text to the clipboard synchronously (no permission error, no async gap), then saves to Supabase as a non-blocking side effect
  4. The clipboard text includes: auto-generated title with timestamp range, selected transcript text, and a YouTube deep-link URL with `?t=` start time
  5. A row appears in the Supabase `clips` table with correct `video_id`, `start_seconds`, `end_seconds`, `text`, and `user_id` bound to the Clerk session
**Plans**: TBD

**Files created:**
- `src/components/SelectiveExporter/services/clip-service.ts` — `saveClip()` (Supabase insert), `formatClipForClipboard()` (title + timestamp range + text + deep-link URL)
- `supabase/migrations/002_clips.sql` — `clips` table with RLS enabled from day one; three policies: insert/select/delete scoped to `auth.jwt() ->> 'sub' = user_id`

**Files extended:**
- `src/components/SelectiveExporter/views/YouTubeTranscriptView.tsx` — two-click selection state machine (`idle | selecting | selected`), visual range highlight, "Create Clip" action bar, Escape/outside-click handlers

**Critical notes:**
- Clipboard write MUST happen synchronously in the click handler BEFORE any `await` — writing after `await saveClip()` loses the transient activation window and the browser will block it; wrap in try/catch with a visible user-facing error
- Do NOT copy the tweets table RLS pattern — `001_tweet_saver.sql` has RLS disabled; `002_clips.sql` must enable RLS from the first line of the migration, not as a deferred TODO
- Use Supabase native third-party auth (post-April 2025 Clerk pattern) — register Clerk as a third-party provider, pass Clerk session token as `Authorization: Bearer` header; do NOT use the deprecated Clerk JWT template approach
- Call `requestClerkToken()` fresh at save time — do not cache the token on panel open; tokens expire and a stale cached token will cause silent Supabase auth failures
- Validate Clerk JWT forwarding to Supabase works in the extension context on day one of this phase — before building the full save flow; the click -> async message -> async Supabase chain has not been tested end-to-end for this feature

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Transcript Extraction and Display | 0/3 | Planning complete | - |
| 2. Playback Sync and Seek | 0/TBD | Not started | - |
| 3. Selection and Clip Creation | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-20*
*Milestone: YouTube Transcript Feature*
*Coverage: 36/36 v1 requirements mapped*
