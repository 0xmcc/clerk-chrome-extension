# Requirements: YouTube Transcript Feature

**Defined:** 2026-03-20
**Core Value:** Transcript segments are interactive — clicking seeks the video, selecting creates a shareable clip in one action.

## v1 Requirements

### Transcript Extraction

- [ ] **EXTR-01**: On YouTube watch pages (`youtube.com/watch?v=*`), call defuddle on the live document and extract `contentMarkdown`
- [ ] **EXTR-02**: Parse defuddle transcript markdown into typed `TranscriptSegment[]` — each segment has `seconds: number`, `text: string`, and optional `section?: string`
- [ ] **EXTR-03**: Support `M:SS` and `H:MM:SS` timestamp formats in the parser
- [ ] **EXTR-04**: Parse `### Chapter Name` headings as section labels on subsequent segments
- [ ] **EXTR-05**: Return a distinct `NO_TRANSCRIPT` state (not null/error) when `## Transcript` heading is absent from defuddle output
- [ ] **EXTR-06**: Listen to `yt-navigate-finish` DOM event and re-extract transcript when the video ID changes (YouTube SPA navigation)
- [ ] **EXTR-07**: Debounce extraction 500ms after `yt-navigate-finish` to wait for fresh `ytInitialPlayerResponse` injection
- [ ] **EXTR-08**: Add `"youtube"` to `detectPlatform()` return type and URL matching

### Sidebar Display

- [ ] **DISP-01**: Render transcript segments in a scrollable list inside the SelectiveExporter sidebar when `captureMode === "youtube_transcript"`
- [ ] **DISP-02**: Display formatted timestamps (e.g., `0:31`, `1:01`) left-aligned beside segment text
- [ ] **DISP-03**: Render chapter headings as visual section separators above the first segment in each chapter
- [ ] **DISP-04**: Show animated skeleton rows (not a spinner) while transcript is loading
- [ ] **DISP-05**: Show a distinct error state when defuddle extraction fails
- [ ] **DISP-06**: Show a distinct empty state with a human-readable message when video has no transcript (`NO_TRANSCRIPT`)
- [ ] **DISP-07**: Virtualize the segment list (react-window) if a 2-hour video causes > 200ms initial paint delay in manual testing

### Playback Sync

- [ ] **SYNC-01**: Highlight the active transcript segment based on current video playback position
- [ ] **SYNC-02**: Track `video.currentTime` via `timeupdate` event listener — NOT React state — to avoid 4–66 re-renders/sec
- [ ] **SYNC-03**: Use binary search to find the active segment index from `currentTime`
- [ ] **SYNC-04**: Auto-scroll the transcript list to keep the active segment visible during playback
- [ ] **SYNC-05**: Pause auto-scroll for 3 seconds when the user manually scrolls the transcript list
- [ ] **SYNC-06**: Resume auto-scroll on timestamp click (even within the 3-second pause window)

### Timestamp Seeking

- [ ] **SEEK-01**: Clicking a timestamp seeks the YouTube `<video>` element to that segment's start time
- [ ] **SEEK-02**: Test isolated-world `video.currentTime` write on day one of Phase 2 — if YouTube player reverts the seek, switch content script to `world: "MAIN"` in Plasmo config
- [ ] **SEEK-03**: Seeking clears any active clip selection

### Clip Selection

- [ ] **CLIP-01**: User can select a span with two clicks: first click = selection start, second click = selection end
- [ ] **CLIP-02**: Selected segments are visually highlighted between start and end indices
- [ ] **CLIP-03**: Pressing Escape or clicking outside the transcript container clears the selection
- [ ] **CLIP-04**: Selection state machine: `{ phase: "idle" | "selecting" | "selected", startIndex: number | null, endIndex: number | null }`

### Clip Creation

- [ ] **CLIP-05**: A "Create Clip" action bar appears when a valid selection exists (start < end)
- [ ] **CLIP-06**: Clip creation writes to clipboard synchronously in the click handler BEFORE any async operations
- [ ] **CLIP-07**: Clipboard format: `[Video Title] [M:SS–M:SS]\n\n{transcript text}\n\nhttps://youtube.com/watch?v=ID&t=Ns`
- [ ] **CLIP-08**: Clip is saved to Supabase `clips` table: `video_id`, `title`, `url`, `start_seconds`, `end_seconds`, `text`, `user_id`, `created_at`
- [ ] **CLIP-09**: Supabase insert fires as non-blocking side effect after clipboard write (do not await before clipboard)
- [ ] **CLIP-10**: Auto-generated clip title format: `Video Title [M:SS–M:SS]`
- [ ] **CLIP-11**: Call `requestClerkToken()` fresh at save time — do not cache token on panel open
- [ ] **CLIP-12**: Wrap clipboard write in try/catch; show visible error if permission is denied

### Infrastructure

- [ ] **INFRA-01**: Create `supabase/migrations/002_clips.sql` with RLS enabled from day one — do NOT copy the tweets table (RLS disabled) pattern
- [ ] **INFRA-02**: Supabase RLS policy: users can only insert/select their own clips (`auth.jwt() ->> 'sub' = user_id`)
- [ ] **INFRA-03**: Use Supabase native third-party auth (post-April 2025 Clerk pattern) — NOT the deprecated Clerk JWT template approach
- [ ] **INFRA-04**: Video title source: use defuddle's `title` field; fall back to `document.title` if defuddle title is empty

## v2 Requirements

### Clips Management

- **MGMT-01**: User can view a list of their saved clips
- **MGMT-02**: User can delete a saved clip
- **MGMT-03**: Clips are accessible from the extension popup

### Enhanced Transcript UX

- **ENH-01**: Search/filter within transcript
- **ENH-02**: Multi-language transcript switching
- **ENH-03**: Transcript sync offset calibration (for drift)
- **ENH-04**: Copy individual segment text without creating a clip

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time captions / live streams | Transcript only available for fully processed videos with captions |
| Editing transcript text | Read-only display; would need a full edit/save flow |
| Clip playback within the sidebar | Just creation and save/copy — player is on the main page |
| Multi-language transcript switching | Use default language only; language switching is complex UI scope |
| Custom clip naming by user | Auto-generated names are sufficient for v1 |
| YouTube Data API integration | Overkill — defuddle extracts transcript from DOM directly |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXTR-01 | Phase 1 | Pending |
| EXTR-02 | Phase 1 | Pending |
| EXTR-03 | Phase 1 | Pending |
| EXTR-04 | Phase 1 | Pending |
| EXTR-05 | Phase 1 | Pending |
| EXTR-06 | Phase 1 | Pending |
| EXTR-07 | Phase 1 | Pending |
| EXTR-08 | Phase 1 | Pending |
| DISP-01 | Phase 1 | Pending |
| DISP-02 | Phase 1 | Pending |
| DISP-03 | Phase 1 | Pending |
| DISP-04 | Phase 1 | Pending |
| DISP-05 | Phase 1 | Pending |
| DISP-06 | Phase 1 | Pending |
| DISP-07 | Phase 2 | Pending |
| SYNC-01 | Phase 2 | Pending |
| SYNC-02 | Phase 2 | Pending |
| SYNC-03 | Phase 2 | Pending |
| SYNC-04 | Phase 2 | Pending |
| SYNC-05 | Phase 2 | Pending |
| SYNC-06 | Phase 2 | Pending |
| SEEK-01 | Phase 2 | Pending |
| SEEK-02 | Phase 2 | Pending |
| SEEK-03 | Phase 2 | Pending |
| CLIP-01 | Phase 3 | Pending |
| CLIP-02 | Phase 3 | Pending |
| CLIP-03 | Phase 3 | Pending |
| CLIP-04 | Phase 3 | Pending |
| CLIP-05 | Phase 3 | Pending |
| CLIP-06 | Phase 3 | Pending |
| CLIP-07 | Phase 3 | Pending |
| CLIP-08 | Phase 3 | Pending |
| CLIP-09 | Phase 3 | Pending |
| CLIP-10 | Phase 3 | Pending |
| CLIP-11 | Phase 3 | Pending |
| CLIP-12 | Phase 3 | Pending |
| INFRA-01 | Phase 3 | Pending |
| INFRA-02 | Phase 3 | Pending |
| INFRA-03 | Phase 3 | Pending |
| INFRA-04 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after initial definition*
