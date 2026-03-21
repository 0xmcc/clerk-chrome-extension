# Feature Landscape: YouTube Transcript Sidebar

**Domain:** Browser extension transcript viewer with clip creation
**Researched:** 2026-03-20
**Overall confidence:** HIGH (patterns verified across multiple authoritative sources)

---

## Table Stakes

Features users expect from any transcript viewer. Missing = product feels broken or amateur.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clickable timestamps seek video | Every YouTube-adjacent transcript tool does this (Tactiq, Glasp, YouTube native) | Low | `video.currentTime = seconds` directly from content script |
| Active segment highlighted during playback | YouTube native, Descript, Kaltura all do this — users immediately notice absence | Medium | Requires `timeupdate` listener; DOM mutation, NOT React state (see Pitfalls) |
| Auto-scroll transcript to active segment | Standard in Language Reactor, Kaltura, video.js transcript plugin | Medium | Paired with pause-on-user-scroll; see interaction contract below |
| Pause auto-scroll when user manually scrolls | video.js transcript, Descript, Kaltura — all pause on user scroll | Medium | Detect scroll events; resume when user clicks timestamp or video seeks |
| Loading state while fetching transcript | Any data-fetching UI | Low | Skeleton rows matching segment height, not spinner |
| Error state for failed fetch | Any data-fetching UI | Low | Single clear message + retry button |
| Empty state for videos with no transcript | YouTube has many videos without transcripts | Low | Explicit message, not silence |
| Chapter headings from transcript | Defuddle extracts `### Chapter Name` — users use chapters for navigation | Low | Render as sticky or separator headers between segment groups |
| Formatted timestamps displayed | Every tool shows `0:00` or `1:23:45` format | Low | Display from `seconds`, formatted as `M:SS` or `H:MM:SS` |

---

## Differentiators

Features that make this feel meaningfully better than opening YouTube's native transcript panel.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Span selection for clip creation | No YouTube-native equivalent; Descript's text-as-timeline concept applied to reading | High | Two-click model: first click = start, second click = end; visual range highlight between |
| One-action clip save + copy | Eliminates the copy-timestamp-manually workflow | Medium | Single button on selection: saves to Supabase AND writes to clipboard in one gesture |
| Auto-generated clip title | Removes blank-title friction | Low | `"{video title} [{startTime}–{endTime}]"` pattern |
| Clipboard format with `?t=` URL | Shareable, deep-linked clips anyone can paste | Low | `{title}\n{startTime}–{endTime}\n\n{text}\n\n{url}?t={startSeconds}` |
| Sidebar co-located with video | Native panel requires scrolling down; sidebar is always visible | None (existing infrastructure) | SelectiveExporter already positions correctly |

---

## Anti-Features

Explicitly out of scope — building these would increase surface area without proportional value at this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User-editable clip titles | Adds input management, validation, persistence complexity | Auto-generate title; users can rename in the saved clips list if that feature is added later |
| Multi-language transcript switching | Requires re-fetching with language param; defuddle returns default only | Use default; add as future enhancement if requested |
| Clip playback within sidebar | Would require an embedded player or postMessage to control the page video; large scope | Users click the `?t=` link to replay |
| Search within transcript | Powerful but not core to the "read + clip" flow | Ctrl+F works on the sidebar panel via browser native find |
| Word-level timestamp granularity | Defuddle returns segment-level only; word-level would require YouTube API or DOM scraping | Segment-level (1–5 second chunks) is sufficient for clip creation |
| Live stream / real-time captions | Fundamentally different data pipeline | Explicitly out of scope per PROJECT.md |
| Saved clips list view | Second-order feature; save to Supabase so it can be built later | Show toast confirmation + clipboard copy as feedback |

---

## Feature Interaction Contracts

### Auto-Scroll Contract

The auto-scroll behavior has a specific contract used by Descript, Kaltura, and video.js transcript plugin:

```
PLAYING + user not scrolling  →  auto-scroll active (segment scrolls into view)
PLAYING + user scrolls         →  auto-scroll paused (user is browsing)
PLAYING + user clicks timestamp →  auto-scroll resumes (user re-anchored)
PLAYING + video seeks (any cause) →  auto-scroll resumes
PAUSED (any state)             →  auto-scroll inactive (no movement)
```

"User scrolls" is detected via a `scroll` event listener on the transcript container. Set a `userScrolledAt` timestamp ref; if `Date.now() - userScrolledAt < 3000ms`, suppress auto-scroll. Resume unconditionally on seek or timestamp click.

**Do not use a visible "Resume autoscroll" button** (Kaltura's approach). The 3-second timeout resume is invisible and sufficient — the button adds visual noise and implies the feature broke.

### Segment Selection Contract

Two-click range selection (confirmed pattern from BBC react-transcript-editor, Descript clip creation):

```
No selection           → click segment A      → A is "start", visually marked
Start selected         → click segment B (B ≥ A) → range A–B highlighted
Start selected         → click segment B (B < A) → A becomes new start (reset)
Range selected         → click segment C       → reset; C becomes new start
Range selected         → click "Create Clip"   → save + copy + clear selection
Range selected         → Escape key             → clear selection
```

Visual feedback during selection:
- Start segment: left border accent (e.g., `border-l-2 border-blue-500`)
- Range between: muted background tint (e.g., `bg-blue-50 dark:bg-blue-950/30`)
- Floating action bar appears above selection with segment count + "Create Clip" button

**Do not use text-drag selection** (browser's native text selection interferes; also doesn't survive timestamp click targets).

---

## Loading / Error / Empty States

### Loading State

**Pattern: Skeleton rows, not a spinner.** (Confirmed best practice: animated skeleton loaders are perceived as faster than spinners for structured content. Source: LogRocket, react-loading-skeleton docs.)

Render 8–12 skeleton rows:
- Row height matches a transcript segment (~40px including timestamp + line of text)
- Alternating widths (85%, 70%, 90%, 60%...) to mimic natural text variance
- Pulse animation (CSS `animate-pulse` via Tailwind)
- No "Loading transcript..." text — the skeleton is self-explanatory

**Timing:** Show skeleton immediately on YouTube page detect (before defuddle resolves). If transcript resolves in < 300ms, skip skeleton entirely (avoid flash). Use a 300ms delay before showing skeleton.

### Error State

Single error message, centered in the transcript pane:

```
Could not load transcript.
[Retry]
```

Do not show technical error details (defuddle stack trace, etc.). Log to console. Retry button re-calls the defuddle extraction.

### Empty State (No Transcript Available)

Distinct from error — this is a valid terminal state:

```
No transcript available for this video.

Transcripts are only available for videos with
captions enabled by the creator.
```

Do not show a retry button — retrying will produce the same result. This state is detected when defuddle returns no transcript section in `contentMarkdown`.

### Transcript Panel Hidden (Video Not Playing Yet)

On initial page load before user opens the sidebar: no special state needed. The sidebar only mounts when the user clicks the floating button, at which point the transcript fetch starts immediately.

---

## Clip Metadata Fields

Grounded in Google's Schema.org Clip type (`startOffset`, `endOffset`, `name`, `url`) plus fields needed for display and re-use.

### `clips` Supabase Table Columns

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | Yes (auto) | Primary key |
| `user_id` | text | Yes | From Clerk `requestClerkToken()` sub claim |
| `video_id` | text | Yes | YouTube video ID extracted from URL (`?v=` param) |
| `video_title` | text | Yes | Full video title (for display without re-fetching) |
| `video_url` | text | Yes | Canonical `https://youtube.com/watch?v={id}` |
| `title` | text | Yes | Auto-generated: `"{video_title} [{startTimestamp}–{endTimestamp}]"` |
| `start_seconds` | integer | Yes | Integer seconds, aligns with Schema.org `startOffset` |
| `end_seconds` | integer | Yes | Integer seconds, aligns with Schema.org `endOffset` |
| `text` | text | Yes | Concatenated transcript text for the selected range (no timestamps, plain sentences) |
| `clip_url` | text | Yes | `{video_url}?t={start_seconds}` — deep link to clip start |
| `created_at` | timestamptz | Yes (auto) | Server default `now()` |

**Note on `title` generation:** Timestamps in the title use the display format (`M:SS`), not raw seconds. Example: `"How to Build a Compiler [12:34–18:02]"`.

### Clipboard Plaintext Format

```
{title}
{startTimestamp} – {endTimestamp}

{text}

{clip_url}
```

Example:
```
How to Build a Compiler [12:34–18:02]
12:34 – 18:02

We start by defining the grammar. Each production rule maps a
non-terminal to a sequence of terminals and non-terminals.
The parser walks this tree depth-first.

https://youtube.com/watch?v=dQw4w9WgXcQ?t=754
```

---

## Feature Dependencies

```
detectPlatform() → YouTube detect
  → defuddle extraction of contentMarkdown
    → transcript markdown parser → TranscriptSegment[]
      → TranscriptView render
        → timeupdate listener → active segment sync → auto-scroll
        → click handler → video.currentTime seek
        → click-start / click-end → SelectionRange state
          → "Create Clip" → save to Supabase (requires auth)
          → "Create Clip" → copy to clipboard
```

Auth (Clerk token) is only required at clip-save time, not for viewing. Viewing is unauthenticated — lowers friction for discovery.

---

## MVP Recommendation

Prioritize in this order:

1. Transcript fetch + render with chapter headers (table stakes, prerequisite for everything)
2. Clickable timestamps seek video (highest perceived value, lowest complexity)
3. Active segment highlight + auto-scroll (makes the feature feel alive vs static)
4. Two-click span selection with visual feedback (clip creation depends on this)
5. Clip save to Supabase + clipboard copy (completes the user flow)

Defer to future milestone:
- Saved clips list/management view (Supabase data is there; build viewing later)
- Search within transcript (Ctrl+F covers it; browser native search works in Shadow DOM)
- Offset calibration control (transcript timestamps can be ~1s off; optional fine-tuning feature)

---

## Sources

- [Mux: Interactive Video Transcript with CuePoints](https://www.mux.com/blog/interactive-video-transcript) — event-driven sync pattern, HIGH confidence
- [Metaview: Syncing a Transcript with Audio in React](https://www.metaview.ai/resources/blog/syncing-a-transcript-with-audio-in-react) — `timeupdate` + DOM mutation (not state) performance pattern, HIGH confidence
- [video.js transcript plugin](https://github.com/walsh9/videojs-transcript) — `stopScrollWhenInUse`, `autoscroll`, `scrollToCenter` options, HIGH confidence
- [Google Schema.org Clip structured data](https://developers.google.com/search/docs/appearance/structured-data/video) — canonical metadata field names (`startOffset`, `endOffset`, `name`, `url`), HIGH confidence
- [Descript Auto-scrolling](https://help.descript.com/hc/en-us/articles/10164575118989-Auto-scrolling) — pause/resume pattern (403 on fetch; known behavior from product), MEDIUM confidence
- [LogRocket: React Loading Skeleton patterns](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/) — skeleton over spinner for structured content, HIGH confidence
- [Language Learning with Netflix forum](https://forum.languagelearningwithnetflix.com/t/requesting-new-feature-offset-adjustment-for-auto-highlight-scroll-on-the-youtube-screenright-transcript-browser/29521) — real user pain with auto-scroll offset, MEDIUM confidence
- [Kaltura Transcript Plugin docs](https://knowledge.kaltura.com/help/transcript) — "Resume autoscroll" button pattern (explicitly NOT recommended for this project), HIGH confidence
- [Tactiq Chrome Extension](https://tactiq.io/chrome-extension) — highlight + tag UX for transcript extensions, MEDIUM confidence
