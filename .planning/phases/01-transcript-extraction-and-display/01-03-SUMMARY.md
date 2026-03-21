---
phase: 01-transcript-extraction-and-display
plan: 03
subsystem: ui
tags: [react, typescript, plasmo, youtube, transcript, chrome-extension]

# Dependency graph
requires:
  - phase: 01-02
    provides: useYouTubeTranscript hook, YouTubeTranscriptCapture type, isYouTubeWatchPage, TranscriptSegment, TranscriptStatus
  - phase: 01-01
    provides: parseTranscriptMarkdown, TranscriptSegment, formatTimestamp
provides:
  - YouTubeTranscriptView component with loading skeleton, error, no_transcript, and ready states
  - youtube_transcript added to ViewMode union and SelectiveExporterProps
  - goToYouTubeTranscript added to useViewState hook
  - youtube_transcript label in SubHeader VIEW_LABELS
  - useCaptureSource YouTube guard returning YouTubeTranscriptCapture
  - Full data flow from content.tsx -> useYouTubeTranscript -> useCaptureSource -> SelectiveExporter -> YouTubeTranscriptView
affects: [phase-02-clips, phase-03-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "View dispatch with youtube_transcript as first branch before analysis/export"
    - "YouTube capture auto-nav: useEffect watches capture.captureMode and calls setView"
    - "Skeleton shimmer via CSS @keyframes yt-skeleton-shimmer with animationDelay per row"
    - "!capture guard modified to exclude youtube_transcript view (view handles its own empty/loading states)"

key-files:
  created:
    - clerk-chrome-extension/src/components/SelectiveExporter/views/YouTubeTranscriptView.tsx
  modified:
    - clerk-chrome-extension/src/components/SelectiveExporter/types.ts
    - clerk-chrome-extension/src/components/SelectiveExporter/hooks/useViewState.ts
    - clerk-chrome-extension/src/components/SelectiveExporter/views/SubHeader.tsx
    - clerk-chrome-extension/src/hooks/useCaptureSource.ts
    - clerk-chrome-extension/src/content.tsx
    - clerk-chrome-extension/src/components/SelectiveExporter/index.tsx

key-decisions:
  - "YouTube guard placed first in useCaptureSource useMemo before structured_conversation check — YouTube pages should never fall through to page_markdown"
  - "YouTubeTranscriptView handles all its own states (loading/error/no_transcript/ready) — parent never needs to render empty state for youtube_transcript view"
  - "Auto-navigate useEffect watches capture.captureMode (not youtubeStatus) so navigation triggers only when capture is actually ready"

patterns-established:
  - "New view modes require: types.ts union update, VIEW_LABELS entry, useViewState goTo function, view dispatch branch"
  - "useCaptureSource YouTube guard pattern: check isYouTubeWatchPage first, return capture or null with appropriate emptyStateMessage"

requirements-completed: [DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 01 Plan 03: YouTubeTranscriptView Component and Full Data Flow Wiring Summary

**YouTubeTranscriptView with animated skeleton loading, section headings, and formatted timestamps wired end-to-end from content.tsx through useCaptureSource into SelectiveExporter sidebar**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-21T07:19:17Z
- **Completed:** 2026-03-21T07:23:52Z
- **Tasks:** 2 of 3 (Task 3 is human verification checkpoint)
- **Files modified:** 7

## Accomplishments
- Created `YouTubeTranscriptView` with 4 display states: animated skeleton (8 rows with staggered delay), error message, no-transcript message, and ready state with segment list plus chapter headings
- Extended `ViewMode` union, `SelectiveExporterProps`, `useViewState`, and `SubHeader` for the new `youtube_transcript` view
- Wired full data pipeline: `content.tsx` calls `useYouTubeTranscript`, passes segments/status/title to `useCaptureSource` and `youtubeStatus`/`youtubeErrorMessage` to `SelectiveExporter`
- Added YouTube guard in `useCaptureSource` that short-circuits before structured/page branches, returning `YouTubeTranscriptCapture` when ready or null during loading/error/no_transcript
- Auto-navigation `useEffect` in `SelectiveExporter/index.tsx` switches to `youtube_transcript` view when capture mode becomes `youtube_transcript`

## Task Commits

1. **Task 1: Extend types, view state, and create YouTubeTranscriptView** - `de3ab9e` (feat)
2. **Task 2: Wire useCaptureSource, content.tsx, and SelectiveExporter view dispatch** - `e507e46` (feat)

**Plan metadata:** (pending — at checkpoint)

## Files Created/Modified
- `clerk-chrome-extension/src/components/SelectiveExporter/views/YouTubeTranscriptView.tsx` - New component: loading skeleton, error/no-transcript states, segment list with chapter headings and timestamps
- `clerk-chrome-extension/src/components/SelectiveExporter/types.ts` - Added `youtube_transcript` to ViewMode, `YouTubeTranscriptViewProps`, extended `SelectiveExporterProps` with YouTube fields
- `clerk-chrome-extension/src/components/SelectiveExporter/hooks/useViewState.ts` - Added `goToYouTubeTranscript` callback
- `clerk-chrome-extension/src/components/SelectiveExporter/views/SubHeader.tsx` - Added `youtube_transcript: "Transcript"` to VIEW_LABELS
- `clerk-chrome-extension/src/hooks/useCaptureSource.ts` - YouTube guard returning `YouTubeTranscriptCapture`, extended params with YouTube fields
- `clerk-chrome-extension/src/content.tsx` - Added `useYouTubeTranscript` call and passed results to `useCaptureSource` and `SelectiveExporter`
- `clerk-chrome-extension/src/components/SelectiveExporter/index.tsx` - Imported `YouTubeTranscriptView`, added auto-nav `useEffect`, added view dispatch branch, modified `!capture` guard

## Decisions Made
- YouTube guard placed first in `useCaptureSource` useMemo before the `structured_conversation` check — YouTube pages should never fall through to the page_markdown branch
- `YouTubeTranscriptView` manages all its own states internally so the parent's `!capture` guard is bypassed with `view !== "youtube_transcript"` — this lets the skeleton render during loading without needing a capture object
- Auto-navigate `useEffect` watches `capture?.captureMode` (not `youtubeStatus`) so navigation triggers only when a real capture has been resolved

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in test files (`ingestion.test.ts`, `pageCapture.test.ts`, `useExportActions.test.tsx`) are unrelated to these changes — source files compile cleanly

## Next Phase Readiness
- Complete transcript display pipeline ready for human browser verification (Task 3 checkpoint)
- After verification passes, Phase 1 is complete
- Phase 2 (timestamp clicking to seek video, segment selection) can build directly on `YouTubeTranscriptView` segment rows

---
*Phase: 01-transcript-extraction-and-display*
*Completed: 2026-03-21*
