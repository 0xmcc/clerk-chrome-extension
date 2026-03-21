# YouTube Transcript Feature

## What This Is

A YouTube page feature added to the existing Clerk Chrome extension. When the user is on a YouTube watch page, the sidebar overlay loads the video's full transcript (via defuddle), renders it with clickable timestamps that seek the player, and lets users select a span of segments to create a named clip — saved to Supabase and copied to clipboard.

## Core Value

Transcript segments are interactive: clicking seeks the video, selecting creates a shareable clip in one action.

## Requirements

### Validated

- ✓ Sidebar overlay (SelectiveExporter) renders inside Shadow DOM on any page — existing
- ✓ Platform detection via `detectPlatform()` / `urlMatchers.ts` — existing
- ✓ Defuddle used for page content extraction in `src/lib/pageCapture.ts` — existing
- ✓ Supabase client initialized and used for persistence — existing
- ✓ Clerk auth token available via `requestClerkToken()` — existing
- ✓ `ytInitialPlayerResponse` inline JSON parsing pattern in defuddle's YouTube extractor — existing

### Active

- [ ] Detect YouTube watch pages and activate transcript mode in the sidebar
- [ ] Call defuddle on the live YouTube document and extract the transcript markdown
- [ ] Parse defuddle's transcript markdown into typed segments: `{ seconds: number, text: string, section?: string }`
- [ ] Render transcript segments in a scrollable sidebar view with formatted timestamps
- [ ] Sync visible transcript to video playback position (auto-scroll to active segment)
- [ ] Clicking a timestamp seeks the YouTube `<video>` element via `currentTime`
- [ ] User can select a span across multiple segments (drag or click-start / click-end)
- [ ] One-click clip creation from a selected span: captures start/end seconds + transcript text
- [ ] Save clip to Supabase (`clips` table: videoId, title, url, startSeconds, endSeconds, text, userId)
- [ ] Copy clip to clipboard (formatted: title + timestamp range + text + YouTube URL with `?t=`)

### Out of Scope

- Real-time captions / live streams — transcript only available for processed videos
- Editing transcript text — read-only display
- Clip playback within the sidebar — just creation and save/copy
- Multi-language transcript switching — use default language only
- Custom clip naming by user — use video title + timestamp range as auto-name

## Context

**Existing extension architecture:**
- `src/content.tsx` — PlasmoOverlay, renders FloatingButton + SelectiveExporter in Shadow DOM
- `src/lib/pageCapture.ts` — defuddle wrapper, existing usage pattern to follow
- `src/utils/platform.ts` — `detectPlatform()` returns `"chatgpt" | "claude" | "linkedin" | "twitter" | null`
- `src/hooks/useMessageScanner/urlMatchers.ts` — URL pattern utilities
- `src/components/SelectiveExporter/` — main sidebar: views, hooks, types
- `src/hooks/useCaptureSource.ts` — decides what to show based on current URL/page
- `src/lib/supabase.ts` — initialized Supabase client

**Defuddle transcript format (confirmed from live page):**
```markdown
## Transcript
### Intro
**0:00** Text of first segment.
**0:12** • Text of next segment.
**1:01** • Text of another segment.
```
Timestamps are `M:SS` or `H:MM:SS` strings in bold. Bullet `•` separates sentences within the same second. Chapters appear as `### Chapter Name` headings.

**Seeking mechanism:** YouTube renders the `<video>` element directly in the page DOM (not sandboxed). Content scripts can access `document.querySelector('video').currentTime` directly.

**Supabase clips table** needs to be created (migration required).

## Constraints

- **Tech stack**: TypeScript, React 18, Plasmo, Tailwind (`plasmo-` prefix), no new heavy dependencies
- **Shadow DOM**: All UI in Shadow DOM — no direct `document.body` style injection from new components
- **Defuddle version**: `^0.10.0` — YouTube extractor confirmed to provide `contentMarkdown` with transcript
- **Auth**: Clip saves require Clerk auth token via `requestClerkToken()` to associate userId
- **MV3**: No persistent background connections; use one-shot `chrome.runtime.sendMessage` for cross-context needs

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use defuddle for transcript extraction | Already in the stack, confirmed to return transcript markdown for YouTube pages | — Pending |
| Parse transcript from contentMarkdown (not DOM scraping) | More reliable than DOM scraping which breaks with YouTube redesigns | — Pending |
| Seek via `video.currentTime` from content script | Simplest; content script has direct DOM access to YouTube's `<video>` element | — Pending |
| New `YouTubeTranscriptView` inside SelectiveExporter | Follows existing view pattern; reuses auth, layout, Shadow DOM setup | — Pending |
| `useCaptureSource` detects YouTube and returns transcript capture type | Single dispatch point for all platform-specific sidebar behavior | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-20 after initialization*
