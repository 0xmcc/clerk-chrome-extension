---
phase: 01-transcript-extraction-and-display
plan: 02
subsystem: ui
tags: [react, typescript, defuddle, youtube, hooks, chrome-extension]

# Dependency graph
requires:
  - phase: 01-01
    provides: parseTranscriptMarkdown, TranscriptSegment, transcript-parser.ts
provides:
  - Platform union includes "youtube" with detectPlatform recognition
  - CaptureMode "youtube_transcript" and CaptureSurface "youtube_watch"
  - YouTubeTranscriptCapture interface in ExportCapture union
  - isYouTubeWatchPage helper
  - useYouTubeTranscript hook with defuddle extraction, SPA navigation, status management
affects:
  - 01-03 (TranscriptView will consume useYouTubeTranscript and TranscriptStatus)
  - useCaptureSource (will dispatch to youtube_transcript mode)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All React hooks declared unconditionally before conditional early return"
    - "SPA navigation via yt-navigate-finish with 500ms debounce + video ID guard"
    - "defuddle invoked on cloned document (not live DOM) to avoid mutation side effects"
    - "null parse result maps to no_transcript, not error"

key-files:
  created:
    - clerk-chrome-extension/src/hooks/useYouTubeTranscript.ts
  modified:
    - clerk-chrome-extension/src/utils/platform.ts
    - clerk-chrome-extension/src/lib/capture.ts
    - clerk-chrome-extension/src/components/SelectiveExporter/hooks/useExportActions.ts
    - clerk-chrome-extension/src/components/SelectiveExporter/index.tsx

key-decisions:
  - "youtube detection placed first in detectPlatform() — youtube.com is unambiguous, no collision risk"
  - "YouTubeTranscriptCapture added to ExportCapture union requires guards in existing export code (useExportActions, captureTitle)"
  - "Hook uses isYouTube guard inside callbacks/effects rather than conditional hook calls to preserve React ordering"

patterns-established:
  - "New platform variants require: 1) Platform union update, 2) CaptureMode/Surface types, 3) capture interface, 4) ExportCapture union guard in existing consumers"

requirements-completed: [EXTR-01, EXTR-06, EXTR-07, EXTR-08]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 01 Plan 02: Platform/Capture Types + useYouTubeTranscript Hook Summary

**YouTube platform detection, YouTubeTranscriptCapture type, and useYouTubeTranscript hook with defuddle extraction, SPA navigation debounce, and no_transcript/error status distinction**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-21T07:14:16Z
- **Completed:** 2026-03-21T07:16:50Z
- **Tasks:** 2
- **Files modified:** 5 (2 updated types + 1 new hook + 2 consumer fixes)

## Accomplishments

- Added "youtube" to Platform union with detectPlatform recognition of youtube.com (first check, unambiguous)
- Extended capture type system: YouTubeTranscriptCapture interface, youtube_transcript CaptureMode, youtube_watch CaptureSurface, isYouTubeWatchPage helper
- Created useYouTubeTranscript hook: defuddle extraction on cloned document, 500ms debounced SPA navigation via yt-navigate-finish, video ID guard against redundant re-extraction, null parse result maps to no_transcript (not error)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend platform and capture type system** - `d851187` (feat)
2. **Task 2: Create useYouTubeTranscript hook** - `ac6f95c` (feat)

## Files Created/Modified

- `clerk-chrome-extension/src/utils/platform.ts` - Added "youtube" to Platform union, detectPlatform, getPlatformLabel
- `clerk-chrome-extension/src/lib/capture.ts` - Added YouTubeTranscriptCapture, youtube_transcript mode, youtube_watch surface, isYouTubeWatchPage
- `clerk-chrome-extension/src/hooks/useYouTubeTranscript.ts` - New hook: extraction, SPA nav, status management
- `clerk-chrome-extension/src/components/SelectiveExporter/hooks/useExportActions.ts` - Added youtube_transcript guard in generateMarkdown
- `clerk-chrome-extension/src/components/SelectiveExporter/index.tsx` - Fixed captureTitle to read videoTitle for youtube captures

## Decisions Made

- Placed youtube detection first in detectPlatform() — before linkedin/claude/chatgpt — because youtube.com has no overlap with other platforms
- YouTubeTranscriptCapture lacks a `title` property (uses `videoTitle`) which required updating captureTitle in SelectiveExporter/index.tsx
- Hook uses `isYouTube` boolean computed at hook body top, passed as dependency to callbacks/effects — avoids conditional hook calls while still short-circuiting side effects

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript union narrowing failures in existing ExportCapture consumers**
- **Found during:** Task 1 (extend platform and capture type system)
- **Issue:** Adding YouTubeTranscriptCapture to ExportCapture union caused TS2345 in useExportActions.ts (capture.messages access after only filtering out page_markdown) and TS2339 in SelectiveExporter/index.tsx (capture?.title doesn't exist on YouTubeTranscriptCapture)
- **Fix:** Added `capture.captureMode === "youtube_transcript"` early return in generateMarkdown; updated captureTitle to branch on youtube_transcript and read videoTitle
- **Files modified:** useExportActions.ts, SelectiveExporter/index.tsx
- **Verification:** tsc --noEmit shows no errors in these files
- **Committed in:** d851187 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type narrowing bug in union consumers)
**Impact on plan:** Necessary correctness fix — adding a new union member requires updating all exhaustive-style consumers. No scope creep.

## Issues Encountered

Pre-existing TypeScript errors in `ingestion.test.ts` and `pageCapture.test.ts` (unrelated to this plan's changes, present before work began). Logged to deferred items per deviation scope boundary rules.

## Next Phase Readiness

- useYouTubeTranscript hook ready for consumption in Plan 03 (TranscriptView component)
- TranscriptStatus type exported for view state mapping
- isYouTubeWatchPage and YouTubeTranscriptCapture available for useCaptureSource integration

---
*Phase: 01-transcript-extraction-and-display*
*Completed: 2026-03-21*

## Self-Check: PASSED

- FOUND: clerk-chrome-extension/src/utils/platform.ts
- FOUND: clerk-chrome-extension/src/lib/capture.ts
- FOUND: clerk-chrome-extension/src/hooks/useYouTubeTranscript.ts
- FOUND: clerk-chrome-extension/src/components/SelectiveExporter/hooks/useExportActions.ts
- FOUND: clerk-chrome-extension/src/components/SelectiveExporter/index.tsx
- FOUND: .planning/phases/01-transcript-extraction-and-display/01-02-SUMMARY.md
- FOUND commit: d851187 (Task 1)
- FOUND commit: ac6f95c (Task 2)
