# Technology Stack: YouTube Transcript Feature

**Project:** YouTube Transcript Feature (clerk-chrome-extension milestone)
**Researched:** 2026-03-20
**Overall confidence:** HIGH (all four problem areas verified against official sources and existing codebase)

---

## Existing Stack (Inherited, Do Not Change)

This feature is additive. All tech below slots into the existing setup without new heavy dependencies.

| Technology | Version | Notes |
|------------|---------|-------|
| React | 18.2.0 | Hook-based components, existing pattern to follow |
| TypeScript | 5.3.3 | Strict typing required throughout |
| Plasmo | 0.90.5 | MV3 content script framework; Shadow DOM via `plasmo-csui` |
| Tailwind CSS | 3.4.1 | `plasmo-` prefix; avoid raw `rem` in inline styles (see content.tsx `getStyle`) |
| defuddle | 0.10.0 | Already extracts transcript markdown from YouTube pages |
| @supabase/supabase-js | 2.94.1 | Persistence for clip saves |
| @clerk/chrome-extension | 2.8.4 | Auth token via `requestClerkToken()` |

---

## Problem 1: Parsing Timestamp Markdown into Typed Segments

### The Format (confirmed from live YouTube + defuddle output)

```markdown
## Transcript
### Chapter Name
**0:00** First segment text.
**0:12** • Another segment.
**1:01** • Yet another.
**1:23:45** Hour-long video segment.
```

Rules confirmed from PROJECT.md:
- Timestamps are `**M:SS**` or `**H:MM:SS**` (bold, at line start)
- Bullet `•` is a within-second sentence separator (collapse into same segment)
- `###` headings are chapter/section markers

### Recommended Pattern: Plain Regex Parser, Zero Dependencies

**Do not use a markdown parsing library** (marked, remark, unified) for this task. The transcript section is a narrow, well-defined format. Full markdown parsing adds ~100-200KB and introduces unpredictable behavior if defuddle's output format ever drifts slightly. The existing codebase already uses `marked` for rendering but a dedicated parser is cleaner and testable.

**Confidence: HIGH** — The format is fully specified in PROJECT.md. Regex covers it completely.

```typescript
export interface TranscriptSegment {
  seconds: number
  text: string
  section?: string
}

// Converts "H:MM:SS" or "M:SS" to total seconds
export function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

// Parses defuddle's contentMarkdown transcript section
export function parseTranscriptMarkdown(markdown: string): TranscriptSegment[] {
  const lines = markdown.split("\n")
  const segments: TranscriptSegment[] = []
  let currentSection: string | undefined

  // Match: **H:MM:SS** or **M:SS** at line start
  const timestampRe = /^\*\*(\d+:\d{2}(?::\d{2})?)\*\*\s*(?:•\s*)?(.*)$/

  for (const line of lines) {
    const trimmed = line.trim()

    // Chapter heading: ### Section Name
    if (trimmed.startsWith("###")) {
      currentSection = trimmed.replace(/^#+\s*/, "").trim() || undefined
      continue
    }

    // Skip top-level heading (## Transcript)
    if (trimmed.startsWith("##")) continue

    const match = timestampRe.exec(trimmed)
    if (match) {
      const seconds = parseTimestampToSeconds(match[1])
      const text = match[2].trim()
      segments.push({ seconds, text, section: currentSection })
    }
  }

  return segments
}
```

**What to watch for:** defuddle may include the transcript under a `## Transcript` heading mid-document. Pass only the transcript section to `parseTranscriptMarkdown`, or filter to lines after `## Transcript` appears. The regex is intentionally anchored to `^` to reject any bold text that is not a timestamp at line start.

**Testing:** This function is pure (no DOM, no async). Write unit tests directly in Vitest with sample markdown strings. Cover: M:SS, H:MM:SS, bullet variants, missing section headers, empty input.

---

## Problem 2: Seeking the YouTube `<video>` Element from a Content Script

### Verdict: Direct `document.querySelector('video').currentTime` — No API Needed

**Confidence: HIGH** — Confirmed by PROJECT.md ("YouTube renders the `<video>` element directly in the page DOM (not sandboxed)") and by multiple open-source YouTube extensions using this exact pattern (e.g., youtube-extension, ad-skip extensions).

YouTube watch pages (`youtube.com/watch`) render the native `<video>` element directly in the page DOM. It is NOT inside a cross-origin iframe. MV3 content scripts have full `document` access and can read and write `video.currentTime` synchronously.

```typescript
export function seekYouTubeVideo(seconds: number): boolean {
  const video = document.querySelector<HTMLVideoElement>("video")
  if (!video) return false
  video.currentTime = seconds
  return true
}
```

**Do NOT use:**
- YouTube Data API — requires OAuth, quotas, and only provides metadata (not seek control)
- YouTube iframe API (`YT.Player`) — designed for embedded iframes you own, not YouTube's own watch page player
- `postMessage` to the player — unnecessary when you have direct DOM access
- `chrome.scripting.executeScript` — unnecessary, content script already has page DOM access

**Fallback:** If `document.querySelector('video')` returns null (e.g., before the player loads), retry with `MutationObserver` or a brief `setTimeout`. The player is always present once the watch page is active; a one-time retry on null is sufficient.

### Playback Position Sync (timeupdate → active segment highlight)

**Confidence: HIGH** — Pattern verified via Metaview engineering blog and standard MDN `timeupdate` docs.

`timeupdate` fires at 4–66 Hz depending on browser. **Do not put `currentTime` in React state.** This causes re-renders on every tick, degrading to >400ms per frame in complex trees.

Correct pattern:
```typescript
// In the transcript view hook
const videoRef = useRef<HTMLVideoElement | null>(null)
const currentTimeRef = useRef(0)

useEffect(() => {
  const video = document.querySelector<HTMLVideoElement>("video")
  if (!video) return
  videoRef.current = video

  const handler = () => {
    currentTimeRef.current = video.currentTime
    // Find active segment index (binary search on sorted seconds array)
    // Update DOM class directly via ref, do NOT call setState
    updateActiveSegmentDom(video.currentTime)
  }

  video.addEventListener("timeupdate", handler)
  return () => video.removeEventListener("timeupdate", handler)
}, [])
```

For auto-scroll to the active segment: use `element.scrollIntoView({ behavior: "smooth", block: "nearest" })` called from inside the `timeupdate` handler via a ref to the active DOM node. Smooth scrolling on every tick (66Hz) will jank — debounce by only scrolling when the active segment index changes.

---

## Problem 3: Cross-Segment Text Selection UX

### Recommended Pattern: Two-Click Range Selection with Drag Fallback

**Confidence: HIGH** — Derived from the constraint that Shadow DOM blocks native browser text selection from crossing element boundaries cleanly, and the feature spec requires "drag or click-start / click-end" (PROJECT.md).

Native browser text selection (`window.getSelection()`) works poorly across structured list items with React event handlers — it returns raw text nodes without semantic segment boundaries, making it impossible to reliably map a selection back to `{ startSeconds, endSeconds }`.

Use a **custom two-click range selection** implemented purely in React state:

```typescript
type SelectionState =
  | { phase: "idle" }
  | { phase: "selecting"; startIndex: number }
  | { phase: "selected"; startIndex: number; endIndex: number }

// Segment click handler
function handleSegmentClick(index: number) {
  if (selection.phase === "idle") {
    setSelection({ phase: "selecting", startIndex: index })
  } else if (selection.phase === "selecting") {
    const start = Math.min(selection.startIndex, index)
    const end = Math.max(selection.startIndex, index)
    setSelection({ phase: "selected", startIndex: start, endIndex: end })
  } else {
    // Third click resets to new start
    setSelection({ phase: "selecting", startIndex: index })
  }
}
```

Visual feedback:
- `phase: "selecting"` → dim all segments, highlight start segment with "click end" affordance
- `phase: "selected"` → highlight range with filled background, show clip action bar below the list
- Escape key resets to idle (attach `onKeyDown` on the container, which already has `e.stopPropagation()` in SelectiveExporter)

**Do NOT use:**
- `mousedown` / `mousemove` drag tracking — unreliable in Shadow DOM because `mousemove` events stop firing when cursor leaves the Shadow DOM boundary during fast drags
- Native `window.getSelection()` — gives raw text ranges without seconds metadata; would require expensive reverse-lookup
- A third-party selection library (e.g., react-selecto) — heavy dependency, not designed for this use case, conflicts with the no-heavy-deps constraint

**Why two-click beats drag in this context:** The sidebar is 420px wide and segments are typically 1-3 lines. Drag selection requires precise mouse-down-hold-and-release across a scrollable list inside a Shadow DOM — this is fragile. Two-click is faster for keyboard-adjacent workflows and does not require `useCaptureEvents` or document-level listeners that would leak outside the Shadow DOM.

---

## Problem 4: Clipboard Write in Shadow DOM Context

### Verdict: `navigator.clipboard.writeText()` Works Directly in Content Scripts

**Confidence: MEDIUM** — Confirmed by MDN Web Extensions docs (Chrome + Firefox grant clipboardWrite to content scripts), with caveats noted below.

The existing `handleCopy` in `useExportActions.ts` already uses `navigator.clipboard.writeText(content)` from inside the SelectiveExporter component, which runs in the Plasmo Shadow DOM content script. This confirms the pattern works in this codebase today.

```typescript
// Existing pattern (useExportActions.ts:249) — proven working
await navigator.clipboard.writeText(content)
```

The YouTube clip copy should follow the identical pattern. No offscreen document is needed.

**Critical caveat — Shadow DOM does NOT affect `navigator.clipboard`:** The Clipboard API is accessed via `navigator`, which is the global object — it has no relationship to Shadow DOM boundaries. The Shadow DOM only isolates CSS and DOM tree queries. `navigator.clipboard.writeText()` called from anywhere in a content script (including inside Shadow DOM event handlers) writes to the system clipboard directly.

**What DOES matter:**
1. The call must originate from a user gesture (click handler). This is satisfied because the copy action is always button-click-triggered.
2. The `clipboardWrite` permission in manifest.json removes the transient activation requirement on HTTPS pages. YouTube is always HTTPS, so no issues there.
3. Do NOT call `navigator.clipboard.writeText()` from a service worker — it will fail. The existing architecture never does this; the call lives in a React component hook inside the content script.

### YouTube URL Fragment Format for Clip Links

```typescript
// Produces: https://www.youtube.com/watch?v=VIDEO_ID&t=90s
function buildYouTubeTimestampUrl(videoId: string, startSeconds: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${startSeconds}s`
}
```

Use `&t=NNs` (integer seconds + "s" suffix) — this is the canonical format YouTube uses in its own "Share at current time" feature. `&t=NN` without the "s" suffix also works but is less canonical. Avoid `#t=Nm0Ss` (fragment format) — it is inconsistently supported and does not survive URL normalization by clipboard managers.

### Clip Copy Format

```typescript
function buildClipCopyText(params: {
  title: string
  startSeconds: number
  endSeconds: number
  text: string
  videoUrl: string
  videoId: string
}): string {
  const startUrl = buildYouTubeTimestampUrl(params.videoId, params.startSeconds)
  const startLabel = formatSeconds(params.startSeconds)  // e.g. "1:23"
  const endLabel = formatSeconds(params.endSeconds)
  return [
    `${params.title} [${startLabel}–${endLabel}]`,
    startUrl,
    "",
    params.text
  ].join("\n")
}
```

---

## New Files Needed

| File | Purpose |
|------|---------|
| `src/lib/transcriptParser.ts` | `parseTranscriptMarkdown()`, `parseTimestampToSeconds()`, `formatSeconds()` |
| `src/lib/transcriptParser.test.ts` | Vitest unit tests for the parser (pure function, easy to test) |
| `src/lib/youtubePlayer.ts` | `seekYouTubeVideo()`, `buildYouTubeTimestampUrl()`, `getYouTubeVideoId()` |
| `src/components/SelectiveExporter/views/YouTubeTranscriptView.tsx` | Transcript list + selection UI |
| `src/hooks/useTranscriptSync.ts` | `timeupdate` listener, active segment tracking via refs |

## No New Dependencies Required

All four problem areas are solvable with:
- Native DOM APIs (`video.currentTime`, `video.addEventListener`, `navigator.clipboard`)
- React built-ins (`useRef`, `useState`, `useEffect`, `useCallback`)
- Plain TypeScript (regex parser, timestamp formatter)

The constraint "no new heavy dependencies" (PROJECT.md) is fully satisfiable.

---

## What Not to Use

| Option | Why Not |
|--------|---------|
| YouTube Data API | Requires OAuth, API key, quota management — overkill for seeking a video element you already have DOM access to |
| YouTube iframe API (`YT.Player`) | Designed for iframes you embed; irrelevant on YouTube's own watch page |
| `marked` / `remark` for transcript parsing | Full markdown parsing is overkill for a fixed-format segment list; adds parse ambiguity |
| `react-selecto` or drag-selection libraries | Heavy, not designed for Shadow DOM, conflicts with no-new-deps constraint |
| `document.execCommand('copy')` | Deprecated; navigator.clipboard already proven working in this codebase |
| Offscreen document for clipboard | Only needed in service workers; content scripts use navigator.clipboard directly |
| Storing `video.currentTime` in React state | Causes 4–66 re-renders per second; use refs + direct DOM mutation |

---

## Sources

- PROJECT.md (confirmed transcript format, seeking mechanism, Shadow DOM constraints)
- [MDN Interact with the Clipboard — Web Extensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard) — clipboardWrite permission in content scripts
- [Chrome Offscreen Documents blog post](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3) — offscreen is for service workers, not content scripts
- [Metaview: Syncing a Transcript with Audio in React](https://www.metaview.ai/resources/blog/syncing-a-transcript-with-audio-in-react) — timeupdate performance: refs over state
- [MDN HTMLMediaElement: timeupdate event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event) — event frequency documentation
- [MDN HTMLMediaElement: currentTime](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime) — write-to-seek behavior
- [YouTube timestamp URL format — Sendible](https://www.sendible.com/insights/youtube-timestamp-link) — `&t=NNs` canonical format
- Existing codebase: `useExportActions.ts:249` — navigator.clipboard.writeText already working in Shadow DOM content script
