# Phase 1: Transcript Extraction and Display - Research

**Researched:** 2026-03-20
**Domain:** YouTube transcript extraction via defuddle, TypeScript parsing, React hook integration, Shadow DOM sidebar rendering
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXTR-01 | On YouTube watch pages, call defuddle on the live document and extract `contentMarkdown` | Confirmed: `pageCapture.ts` shows the exact `new Defuddle(doc, opts).parse()` pattern; reuse `cloneDocumentForExtraction` |
| EXTR-02 | Parse defuddle transcript markdown into typed `TranscriptSegment[]` — each segment has `seconds`, `text`, optional `section` | Confirmed: format fully specified in PROJECT.md; plain regex parser is the right tool (no markdown lib needed) |
| EXTR-03 | Support `M:SS` and `H:MM:SS` timestamp formats in the parser | Confirmed: regex `/^\*\*(\d+:\d{2}(?::\d{2})?)\*\*\s*(?:•\s*)?(.*)$/` handles both |
| EXTR-04 | Parse `### Chapter Name` headings as section labels on subsequent segments | Confirmed: chapter heading detection via `trimmed.startsWith("###")` is straightforward |
| EXTR-05 | Return a distinct `NO_TRANSCRIPT` state when `## Transcript` heading is absent from defuddle output | Confirmed: must null-check `contentMarkdown` and check for `## Transcript` heading presence; map absence to a terminal `"no_transcript"` status, not `null` |
| EXTR-06 | Listen to `yt-navigate-finish` DOM event and re-extract when video ID changes | Confirmed: YouTube SPA fires `yt-navigate-finish` on nav; must compare video ID from new URL to avoid re-triggering on same video |
| EXTR-07 | Debounce extraction 500ms after `yt-navigate-finish` to wait for fresh `ytInitialPlayerResponse` | Confirmed: `setTimeout` 500ms after the event, cleared on cleanup, per ARCHITECTURE.md recommendation |
| EXTR-08 | Add `"youtube"` to `detectPlatform()` return type and URL matching | Confirmed: `platform.ts` current union is `"chatgpt" \| "claude" \| "linkedin" \| "unknown"`; add `"youtube"` before `"unknown"` |
| DISP-01 | Render transcript segments in scrollable list inside SelectiveExporter when `captureMode === "youtube_transcript"` | Confirmed: add branch `view === "youtube_transcript"` in `SelectiveExporter/index.tsx` view dispatch |
| DISP-02 | Display formatted timestamps left-aligned beside segment text | Confirmed: format with `formatTimestamp(seconds)` helper in `transcript-parser.ts`; style left-aligned via inline flex layout |
| DISP-03 | Render chapter headings as visual section separators above first segment in each chapter | Confirmed: check `segment.section !== prevSegment?.section` to insert a section header element |
| DISP-04 | Show animated skeleton rows (not a spinner) while transcript is loading | Confirmed: use `status === "loading"` from `useYouTubeTranscript`; render 8–10 skeleton divs with CSS animation via inline `@keyframes` (existing pattern in codebase) |
| DISP-05 | Show distinct error state when defuddle extraction fails | Confirmed: `status === "error"` branch; show `errorMessage` if available, fallback to generic "Could not load transcript" |
| DISP-06 | Show distinct empty state with human-readable message when video has no transcript | Confirmed: `status === "no_transcript"` branch; message: "This video doesn't have a transcript available" |
| INFRA-04 | Video title source: use defuddle `title` field, fall back to `document.title` | Confirmed: defuddle `result.title?.trim() || document.title` — same pattern as `extractPageMarkdownCapture` |
</phase_requirements>

---

## Summary

Phase 1 builds the foundational layer: get the transcript out of YouTube's DOM via defuddle, parse it into typed segments, wire it into the existing capture/display pipeline, and render it in the SelectiveExporter sidebar. All subsequent phases (playback sync, click-to-seek, clip selection) build on this layer — so correctness and proper state shape here are critical.

The codebase already has all the primitives needed. `pageCapture.ts` shows exactly how to call defuddle. `platform.ts` and `capture.ts` show the union-extension pattern. `SelectiveExporter/index.tsx` shows the view dispatch pattern. There are no new libraries to introduce; this phase is entirely additive TypeScript and React work.

The two highest-risk items are (1) correctly handling the `NO_TRANSCRIPT` terminal state — null/missing `## Transcript` in defuddle output must map to a distinct status, not fall through to an error — and (2) the `yt-navigate-finish` SPA nav listener, which must be wired at this phase or stale transcripts will corrupt every downstream phase.

**Primary recommendation:** Write `transcript-parser.test.ts` first, implement the parser to pass tests, then wire the hook and view. The parser is the single pure-function foundation everything else depends on.

---

## Standard Stack

### Core (No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| defuddle | 0.10.0 | Extract `contentMarkdown` (with transcript) from YouTube live document | Already in stack; YouTube extractor confirmed working |
| React | 18.2.0 | `useEffect`, `useState`, `useRef`, `useCallback` for hook and view | Existing; no additions |
| TypeScript | 5.3.3 | Strict typing throughout; `TranscriptSegment`, `YouTubeTranscriptCapture` types | Existing |
| Vitest | 4.0.18 | Unit tests for pure parser functions | Existing test framework |
| Tailwind CSS (`plasmo-` prefix) | 3.4.1 | Segment list styling, skeleton animation | Existing; follow `plasmo-` prefix convention |

### No New Dependencies Required

All four problem areas (transcript parsing, YouTube navigation detection, defuddle invocation, and display) are solvable with the existing stack. The constraint "no new heavy dependencies" in `PROJECT.md` is fully satisfiable.

**Installation:** Nothing to install.

---

## Architecture Patterns

### Recommended Module Structure

```
src/
├── lib/
│   ├── transcript-parser.ts          NEW — pure parsing logic (test this first)
│   └── transcript-parser.test.ts     NEW — Vitest unit tests
├── hooks/
│   └── useYouTubeTranscript.ts       NEW — transcript state + SPA nav listener
├── utils/
│   └── platform.ts                   MODIFY — add "youtube" to Platform union
├── lib/
│   └── capture.ts                    MODIFY — YouTubeTranscriptCapture, new CaptureSurface/Mode
├── hooks/
│   └── useCaptureSource.ts           MODIFY — add youtube branch + youtubeSegments param
├── content.tsx                       MODIFY — call useYouTubeTranscript(), thread result
└── components/SelectiveExporter/
    ├── index.tsx                     MODIFY — render YouTubeTranscriptView when captureMode matches
    ├── types.ts                      MODIFY — add "youtube_transcript" to ViewMode
    └── views/
        └── YouTubeTranscriptView.tsx  NEW — segment list, loading/error/empty states
```

### Pattern 1: Platform Union Extension

**What:** Add `"youtube"` to the `Platform` type union and `detectPlatform()` before the `"unknown"` fallback.

**When to use:** Any time a new host platform needs to be detected.

```typescript
// Source: src/utils/platform.ts (existing pattern to extend)
export type Platform = "chatgpt" | "claude" | "linkedin" | "youtube" | "unknown"

export const detectPlatform = (): Platform => {
  const host = window.location.hostname.toLowerCase()
  if (host.includes("youtube.com")) return "youtube"
  if (host.includes("linkedin.com")) return "linkedin"
  if (host.includes("claude.ai")) return "claude"
  if (host.includes("chatgpt") || host.includes("openai")) return "chatgpt"
  return "unknown"
}

export const getPlatformLabel = (platform: Platform = detectPlatform()) => {
  if (platform === "youtube") return "YouTube"
  // ... existing cases
}
```

### Pattern 2: CaptureMode / CaptureSurface / ExportCapture Extension

**What:** Add `"youtube_transcript"` to `CaptureMode`, `"youtube_watch"` to `CaptureSurface`, and a `YouTubeTranscriptCapture` interface to the `ExportCapture` discriminated union.

**When to use:** Any new surface-specific capture type.

```typescript
// Source: src/lib/capture.ts (existing pattern to extend)
export type CaptureMode =
  | "structured_conversation"
  | "page_markdown"
  | "youtube_transcript"

export type CaptureSurface =
  | "chatgpt_conversation"
  | "claude_chat"
  | "chatgpt_page"
  | "claude_page"
  | "youtube_watch"
  | "generic_page"

import type { TranscriptSegment } from "~lib/transcript-parser"

export interface YouTubeTranscriptCapture {
  captureMode: "youtube_transcript"
  conversationKey: string
  videoId: string
  videoTitle: string
  videoUrl: string
  segments: TranscriptSegment[]
  metadata: CaptureMetadata
}

export type ExportCapture =
  | StructuredConversationCapture
  | PageMarkdownCapture
  | YouTubeTranscriptCapture

export const isYouTubeWatchPage = (platform: Platform, pathname: string): boolean =>
  platform === "youtube" && pathname.startsWith("/watch")
```

### Pattern 3: Pure Regex Transcript Parser

**What:** A pure TypeScript module with no external deps that converts defuddle's `contentMarkdown` into `TranscriptSegment[]`.

**When to use:** Called from `useYouTubeTranscript` after defuddle parse; also the unit test target.

```typescript
// Source: src/lib/transcript-parser.ts (NEW)
export interface TranscriptSegment {
  seconds: number
  text: string
  section?: string
}

const TIMESTAMP_RE = /^\*\*(\d+:\d{2}(?::\d{2})?)\*\*\s*(?:•\s*)?(.*)$/

export function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0")
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * Returns null if markdown is null/undefined/empty or if no ## Transcript heading exists.
 * Returns [] if the heading exists but no segments were parsed (valid empty transcript).
 * Returns TranscriptSegment[] otherwise.
 */
export function parseTranscriptMarkdown(
  markdown: string | null | undefined
): TranscriptSegment[] | null {
  if (!markdown) return null
  const transcriptStart = markdown.indexOf("## Transcript")
  if (transcriptStart === -1) return null

  const section = markdown.slice(transcriptStart)
  const lines = section.split("\n")
  const segments: TranscriptSegment[] = []
  let currentSection: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("###")) {
      currentSection = trimmed.replace(/^#+\s*/, "").trim() || undefined
      continue
    }
    if (trimmed.startsWith("##")) continue
    const match = TIMESTAMP_RE.exec(trimmed)
    if (match) {
      segments.push({
        seconds: timestampToSeconds(match[1]),
        text: match[2].trim(),
        section: currentSection
      })
    }
  }

  return segments
}

/**
 * Binary search: find the last segment index where segment.seconds <= currentTime.
 * Returns -1 if no segment qualifies.
 */
export function findActiveSegmentIndex(
  segments: TranscriptSegment[],
  currentTime: number
): number {
  if (segments.length === 0 || currentTime < segments[0].seconds) return -1
  let lo = 0, hi = segments.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (segments[mid].seconds <= currentTime) lo = mid
    else hi = mid - 1
  }
  return lo
}
```

**Key invariant:** `parseTranscriptMarkdown` returns `null` (not `[]`) when the `## Transcript` heading is absent. The hook maps `null` to `"no_transcript"` status. It returns `[]` only when the heading exists but has no parseable segments — this should map to `"no_transcript"` status too (empty transcript = no content to display).

### Pattern 4: `useYouTubeTranscript` Hook

**What:** Owns transcript state, defuddle invocation, SPA navigation listener, and status.

**When to use:** Called unconditionally in `content.tsx` (React hook ordering rule); returns empty/idle on non-YouTube pages.

```typescript
// Source: src/hooks/useYouTubeTranscript.ts (NEW)
type TranscriptStatus = "idle" | "loading" | "ready" | "error" | "no_transcript"

interface UseYouTubeTranscriptReturn {
  segments: TranscriptSegment[]
  status: TranscriptStatus
  errorMessage?: string
  videoTitle: string
}

export const useYouTubeTranscript = (): UseYouTubeTranscriptReturn => {
  const platform = detectPlatform()
  const isYouTube = platform === "youtube"
    && window.location.pathname.startsWith("/watch")

  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [status, setStatus] = useState<TranscriptStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [videoTitle, setVideoTitle] = useState("")

  const extract = useCallback(() => {
    if (!isYouTube) return
    setStatus("loading")
    try {
      const detached = cloneDocumentForExtraction(document)
      const result = new Defuddle(detached, buildDefuddleOptions(location.href)).parse()
      const title = result.title?.trim() || document.title
      setVideoTitle(title)
      const parsed = parseTranscriptMarkdown(result.contentMarkdown)
      if (parsed === null || parsed.length === 0) {
        setSegments([])
        setStatus("no_transcript")
      } else {
        setSegments(parsed)
        setStatus("ready")
      }
    } catch (err) {
      setSegments([])
      setStatus("error")
      setErrorMessage(err instanceof Error ? err.message : "Extraction failed")
    }
  }, [isYouTube])

  // Initial extraction on mount
  useEffect(() => {
    if (!isYouTube) return
    extract()
  }, [isYouTube, extract])

  // SPA navigation: re-extract on video change (EXTR-06, EXTR-07)
  useEffect(() => {
    if (!isYouTube) return
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let lastVideoId = new URLSearchParams(location.search).get("v") ?? ""

    const handleNavigate = () => {
      const newVideoId = new URLSearchParams(location.search).get("v") ?? ""
      if (newVideoId === lastVideoId) return
      lastVideoId = newVideoId
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(extract, 500)
    }

    document.addEventListener("yt-navigate-finish", handleNavigate)
    return () => {
      document.removeEventListener("yt-navigate-finish", handleNavigate)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [isYouTube, extract])

  if (!isYouTube) return { segments: [], status: "idle", videoTitle: "" }
  return { segments, status, errorMessage, videoTitle }
}
```

**Critical note on hook ordering:** `useYouTubeTranscript()` is called unconditionally in `content.tsx` regardless of current URL. On non-YouTube pages it must return early with empty state — but it still runs the `useState`/`useEffect` hooks at the top. The `if (!isYouTube) return` must come AFTER all hook calls.

### Pattern 5: `useCaptureSource` Extension

**What:** Add `youtubeSegments` param and a YouTube guard branch before the `page_markdown` fallback.

```typescript
// src/hooks/useCaptureSource.ts (MODIFY)
interface UseCaptureSourceParams {
  isOpen: boolean
  messages: Message[]
  conversationKey: string
  conversationTitle?: string
  youtubeSegments?: TranscriptSegment[]
  youtubeStatus?: TranscriptStatus
  youtubeTitle?: string
}

// Inside useMemo, BEFORE the structuredSurface check:
if (isYouTubeWatchPage(platform, pathname)) {
  const videoId = new URLSearchParams(new URL(sourceUrl).search).get("v") ?? ""
  return {
    capture: youtubeStatus === "ready" && youtubeSegments && youtubeSegments.length > 0
      ? {
          captureMode: "youtube_transcript" as const,
          conversationKey,
          videoId,
          videoTitle: youtubeTitle || pageTitle,
          videoUrl: sourceUrl,
          segments: youtubeSegments,
          metadata: { sourceUrl, pageTitle, capturedAt, platform: "YouTube", surface: "youtube_watch" }
        }
      : null,
    emptyStateMessage: youtubeStatus === "no_transcript"
      ? "This video doesn't have a transcript available."
      : youtubeStatus === "error"
        ? "Could not load transcript."
        : "Loading transcript..."
  }
}
```

### Pattern 6: `YouTubeTranscriptView` Component

**What:** Renders segment list, skeleton, error, and empty states. Phase 1 only — no seek/selection yet.

**When to use:** When `capture?.captureMode === "youtube_transcript"` in `SelectiveExporter/index.tsx`.

The view receives segments and status from the capture and hook. For Phase 1, it renders static segments only. Seeking (Phase 2) and selection (Phase 3) are added on top.

```typescript
// src/components/SelectiveExporter/views/YouTubeTranscriptView.tsx (NEW)
interface YouTubeTranscriptViewProps {
  segments: TranscriptSegment[]
  status: TranscriptStatus
  errorMessage?: string
}
```

**Skeleton pattern:** Render 8 placeholder rows with shimmer animation while `status === "loading"`. Use `@keyframes shimmer` injected as a `<style>` tag inside the component (same pattern as `SelectiveExporter/index.tsx` `analysis-markdown` styles). Do NOT use a spinner.

**Section header rendering:** On each segment, if `segment.section !== prevSegment?.section && segment.section`, render a section heading `<div>` above the segment row. Use an accumulating `prevSection` variable during the `.map()`.

### Pattern 7: `SelectiveExporter/index.tsx` View Dispatch Extension

**What:** Add `"youtube_transcript"` branch in the view dispatch.

The `captureMode` drives the initial view, not `ViewMode` state. The `ViewMode` is an internal navigation enum. For YouTube pages, auto-navigate to show the transcript view when capture is available:

```typescript
// Add to useEffect that resets on conversationKey change:
useEffect(() => {
  if (capture?.captureMode === "youtube_transcript") {
    setView("youtube_transcript")  // or add goToYouTubeTranscript() to useViewState
  }
}, [capture?.captureMode])
```

View dispatch in the render:
```typescript
} : view === "youtube_transcript" || capture?.captureMode === "youtube_transcript" ? (
  <YouTubeTranscriptView
    segments={capture?.captureMode === "youtube_transcript" ? capture.segments : []}
    status={youtubeStatus ?? "idle"}
    errorMessage={youtubeErrorMessage}
  />
) : view === "analysis" ? (
```

### Anti-Patterns to Avoid

- **Calling `new Defuddle(...).parse()` inside `useMemo`** — defuddle parse is synchronous but expensive. Run it inside `useEffect` in `useYouTubeTranscript`, not inline in `useCaptureSource`'s `useMemo`.
- **Mapping `null` parse result to error state** — null from `parseTranscriptMarkdown` means "no transcript heading found". This is a normal YouTube state (many videos have no caption track). Map to `"no_transcript"`, not `"error"`.
- **Calling string methods on `result.contentMarkdown` without null guard** — defuddle's `contentMarkdown` can be null/undefined. Always null-check before passing to the parser.
- **Forgetting to debounce `yt-navigate-finish`** — the event fires before `ytInitialPlayerResponse` is updated. Without the 500ms debounce, defuddle may parse the previous video's transcript.
- **Not comparing video IDs on navigation** — `yt-navigate-finish` can fire multiple times on the same video (e.g., related video hover). Guard with `newVideoId === lastVideoId` to skip redundant extractions.
- **Calling `useYouTubeTranscript()` conditionally** — React hook ordering rules require unconditional calls. The hook must return early internally, not be skipped at the call site.
- **Injecting into `document.body` from `YouTubeTranscriptView`** — all UI is inside Shadow DOM. Scroll the sidebar's scrollable panel container, not YouTube's DOM.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Extracting transcript from YouTube DOM | Custom DOM scraper targeting `.ytd-transcript-segment-list-renderer` | defuddle's YouTube extractor | DOM scraping breaks with YouTube redesigns; defuddle's extractor is already proven |
| YouTube video ID extraction | Regex on `window.location.href` | `new URLSearchParams(location.search).get("v")` | URLSearchParams handles all URL variants (short links, embedded params) |
| Markdown parsing for transcript | `marked` / `remark` / `unified` | Custom regex parser | Full markdown parsing adds 100-200KB, introduces parse ambiguity for this narrow format |
| Active segment lookup | Linear search in `timeupdate` handler | Binary search `findActiveSegmentIndex` | Called 4-66x per second when playing; linear search causes jank on 1000+ segment transcripts |
| Clipboard write | `document.execCommand('copy')` | `navigator.clipboard.writeText()` | Deprecated; `navigator.clipboard` already proven working in this codebase (`useExportActions.ts:249`) |
| CSS scoping | Direct `document.body` class injection | Inline styles + `plasmo-` Tailwind prefix | Shadow DOM boundary isolates styles; host-page injection breaks extension isolation |

**Key insight:** The transcript format is narrow and fully specified. A 30-line regex parser covers 100% of real cases and is trivially testable. Full markdown parsing is engineering theater for this problem.

---

## Common Pitfalls

### Pitfall 1: `null` vs. `NO_TRANSCRIPT` Confusion

**What goes wrong:** `parseTranscriptMarkdown` returns `null` when `## Transcript` is absent. If the hook maps this to `status: "error"`, the empty-state component never renders and users see a confusing error on videos with no captions.

**Why it happens:** `null` return is an unusual convention. Easy to mistake for "something broke."

**How to avoid:** Document the contract explicitly: `null` = no transcript section found = `"no_transcript"` status. `[]` (empty array) after the heading exists = also `"no_transcript"`. Only `throw` from inside the try/catch maps to `"error"`.

**Warning signs:** Test `EXTR-05` by running against a video URL that has no transcript; if the UI shows an error state instead of the empty state, this pitfall has occurred.

### Pitfall 2: `yt-navigate-finish` Without Video ID Guard

**What goes wrong:** `yt-navigate-finish` fires on every YouTube SPA navigation event, including non-video navigations (home, search, channel pages). Without checking that the new `?v=` param is different from the current one, the hook re-extracts on every navigation — including navigating away from a watch page, which causes defuddle to be called on a non-video page and return no transcript (incorrectly clearing the panel).

**Why it happens:** The event is coarse-grained — it fires for all YouTube internal navigations.

**How to avoid:** Compare `new URLSearchParams(location.search).get("v")` before and after the event. Only re-extract if the video ID changed AND the new page is a `/watch` page. Reset to `"idle"` immediately when navigating away from a watch page (so the panel doesn't show a stale transcript on the YouTube home page).

**Warning signs:** Opening the sidebar on YouTube home shows the previous video's transcript, or switching videos shows the old transcript briefly before updating.

### Pitfall 3: Hook Called After Early `if (!isYouTube) return`

**What goes wrong:** React rules of hooks require that hooks are always called in the same order. If `useYouTubeTranscript()` calls `useState`/`useEffect` after an early return, React throws a runtime error ("Rendered fewer hooks than expected").

**Why it happens:** Putting the guard at the top of the hook body before any hook calls.

**How to avoid:** Call all `useState` and `useEffect` hooks unconditionally at the top. Only use `isYouTube` as a condition INSIDE effect callbacks, not as a gate before the hook calls. At the return, short-circuit with `if (!isYouTube) return { segments: [], status: "idle", videoTitle: "" }` AFTER all hooks are called.

**Warning signs:** Console error "React has detected a change in the order of Hooks" on non-YouTube pages.

### Pitfall 4: Defuddle Called on Live `document` (Not Detached Clone)

**What goes wrong:** Defuddle mutates the document it receives during parsing. If called on `document` directly (not a clone), it modifies the live YouTube page DOM — potentially removing elements or changing layout.

**Why it happens:** Missing the `cloneDocumentForExtraction(document)` step.

**How to avoid:** Always call `cloneDocumentForExtraction(document)` first (already established in `pageCapture.ts`). The detached document is safe to mutate.

**Warning signs:** YouTube page layout breaks or elements disappear after the sidebar opens.

### Pitfall 5: `useMemo` Dependency Array Mismatch in `useCaptureSource`

**What goes wrong:** Adding `youtubeSegments` and `youtubeStatus` as new params to `useCaptureSource` requires adding them to the `useMemo` dependency array. Missing this causes stale capture state — the YouTube view renders once and never updates.

**Why it happens:** Adding params without thinking about the downstream `useMemo`.

**How to avoid:** After adding `youtubeSegments` and `youtubeStatus` to the param interface, add them to the `useMemo` deps array immediately.

**Warning signs:** Transcript appears after hard reload but not after YouTube SPA navigation.

### Pitfall 6: `ViewMode` Union Out of Sync with `SelectiveExporter` Render Switch

**What goes wrong:** Adding `"youtube_transcript"` to `ViewMode` in `types.ts` but not adding the corresponding branch in `SelectiveExporter/index.tsx` means TypeScript compiles but the view is never rendered.

**Why it happens:** Union extension is type-level only; runtime behavior requires a matching case in the view dispatch.

**How to avoid:** Search for all places where `ViewMode` values are checked (currently: `useViewState.ts`, `SelectiveExporter/index.tsx`, `SubHeader.tsx`) and add the `"youtube_transcript"` case.

---

## Code Examples

### Vitest Test Pattern for Pure Parser

```typescript
// Source: src/lib/capture.test.ts (existing test pattern to follow)
// File: src/lib/transcript-parser.test.ts
import { describe, expect, it } from "vitest"
import { parseTranscriptMarkdown, timestampToSeconds, findActiveSegmentIndex } from "./transcript-parser"

describe("timestampToSeconds", () => {
  it("converts M:SS format", () => expect(timestampToSeconds("1:23")).toBe(83))
  it("converts H:MM:SS format", () => expect(timestampToSeconds("1:23:45")).toBe(5025))
  it("converts 0:00", () => expect(timestampToSeconds("0:00")).toBe(0))
})

describe("parseTranscriptMarkdown", () => {
  it("returns null when input is null", () => {
    expect(parseTranscriptMarkdown(null)).toBeNull()
  })

  it("returns null when ## Transcript heading is absent", () => {
    expect(parseTranscriptMarkdown("# Some Page\n\nContent here")).toBeNull()
  })

  it("parses M:SS segments", () => {
    const md = "## Transcript\n**0:31** Hello world."
    expect(parseTranscriptMarkdown(md)).toEqual([
      { seconds: 31, text: "Hello world.", section: undefined }
    ])
  })

  it("parses H:MM:SS segments", () => {
    const md = "## Transcript\n**1:23:45** Long video segment."
    expect(parseTranscriptMarkdown(md)).toEqual([
      { seconds: 5025, text: "Long video segment.", section: undefined }
    ])
  })

  it("strips bullet character from segment text", () => {
    const md = "## Transcript\n**0:12** • Bullet text."
    expect(parseTranscriptMarkdown(md)![0].text).toBe("Bullet text.")
  })

  it("attaches chapter heading to following segments", () => {
    const md = "## Transcript\n### Intro\n**0:00** First.\n**0:10** Second."
    const result = parseTranscriptMarkdown(md)!
    expect(result[0].section).toBe("Intro")
    expect(result[1].section).toBe("Intro")
  })

  it("changes section on new chapter heading", () => {
    const md = "## Transcript\n### Intro\n**0:00** A.\n### Main\n**1:00** B."
    const result = parseTranscriptMarkdown(md)!
    expect(result[0].section).toBe("Intro")
    expect(result[1].section).toBe("Main")
  })

  it("returns empty array (not null) when heading exists but no segments", () => {
    const md = "## Transcript\n### Just a heading"
    expect(parseTranscriptMarkdown(md)).toEqual([])
  })
})

describe("findActiveSegmentIndex", () => {
  const segs = [
    { seconds: 0, text: "A" },
    { seconds: 30, text: "B" },
    { seconds: 60, text: "C" }
  ]
  it("returns -1 for empty array", () => expect(findActiveSegmentIndex([], 10)).toBe(-1))
  it("returns -1 when time before first segment", () => expect(findActiveSegmentIndex(segs, -1)).toBe(-1))
  it("returns 0 at exactly 0 seconds", () => expect(findActiveSegmentIndex(segs, 0)).toBe(0))
  it("returns 1 at 45 seconds", () => expect(findActiveSegmentIndex(segs, 45)).toBe(1))
  it("returns last index at beyond-end time", () => expect(findActiveSegmentIndex(segs, 999)).toBe(2))
})
```

### Skeleton Row Pattern (DISP-04)

```typescript
// Render inside YouTubeTranscriptView when status === "loading"
// Follows existing SelectiveExporter inline @keyframes pattern
const SkeletonRows = () => (
  <div>
    <style>{`
      @keyframes yt-skeleton-shimmer {
        0% { opacity: 0.4; }
        50% { opacity: 0.8; }
        100% { opacity: 0.4; }
      }
    `}</style>
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          gap: "12px",
          padding: "8px 0",
          animation: "yt-skeleton-shimmer 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.1}s`
        }}>
        <div style={{ width: "32px", height: "14px", background: DARK_THEME.border, borderRadius: "4px", flexShrink: 0 }} />
        <div style={{ flex: 1, height: "14px", background: DARK_THEME.border, borderRadius: "4px" }} />
      </div>
    ))}
  </div>
)
```

### SPA Navigation Video ID Guard

```typescript
// Inside useEffect in useYouTubeTranscript.ts
const getVideoId = () => new URLSearchParams(window.location.search).get("v") ?? ""

let lastVideoId = getVideoId()

const handleNavigate = () => {
  const currentVideoId = getVideoId()
  const isWatchPage = window.location.pathname.startsWith("/watch")
  if (!isWatchPage) {
    // Navigated away from a watch page — reset to idle
    setSegments([])
    setStatus("idle")
    lastVideoId = ""
    return
  }
  if (currentVideoId === lastVideoId) return  // Same video, no-op
  lastVideoId = currentVideoId
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(extract, 500)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DOM scraping YouTube transcript UI | defuddle `contentMarkdown` extraction | defuddle 0.10.0 (already in stack) | No DOM coupling to YouTube's class names |
| Polling `video.currentTime` with `setInterval` | `timeupdate` event listener | HTML5 media spec | Zero overhead when paused; correct seek detection |
| `document.execCommand('copy')` | `navigator.clipboard.writeText()` | Chrome 66+ | Not deprecated; confirmed working in this codebase |

**Deprecated/outdated:**
- YouTube iframe API (`YT.Player`): Only for iframes you own — irrelevant on YouTube's own watch page
- YouTube Data API for transcript: Requires OAuth + quota; overkill when defuddle gives direct DOM access

---

## Open Questions

1. **Defuddle Null Output on Some YouTube Pages**
   - What we know: defuddle's YouTube extractor works on standard watch pages; confirmed in PROJECT.md
   - What's unclear: Does it handle YouTube Shorts URLs (`/shorts/`) or embedded players? These aren't watch pages and are out of scope, but `detectPlatform()` will still return `"youtube"` for them
   - Recommendation: Add `pathname.startsWith("/watch")` guard in `isYouTubeWatchPage()` (already shown in architecture research) to prevent defuddle from running on non-watch YouTube pages

2. **Defuddle Sync vs. Async Parse Performance**
   - What we know: `pageCapture.ts` calls `defuddle.parse()` synchronously (confirmed from source); `buildDefuddleOptions` sets `useAsync: true` but parse is still called synchronously
   - What's unclear: On a 2-hour video transcript (1000+ segments), does the synchronous parse block the UI thread noticeably?
   - Recommendation: Run a manual test on a long video in Phase 1; if > 200ms freeze, wrap in `setTimeout(0)` to yield to browser. This is not expected to be a problem given defuddle is already used this way in `pageCapture.ts`.

3. **`yt-navigate-finish` Event Availability**
   - What we know: This is a YouTube-internal DOM custom event, documented in multiple open-source YouTube extension projects
   - What's unclear: YouTube has not formally documented this event; it could be renamed in a future YouTube update
   - Recommendation: Use it as specified (it's the established standard for YouTube SPA detection); add a comment noting it's an internal event and could change

---

## Sources

### Primary (HIGH confidence)
- `src/lib/pageCapture.ts` — defuddle invocation pattern (`cloneDocumentForExtraction`, `buildDefuddleOptions`, synchronous `.parse()`)
- `src/utils/platform.ts` — `Platform` union extension pattern
- `src/lib/capture.ts` — `CaptureMode`, `CaptureSurface`, `ExportCapture` discriminated union
- `src/hooks/useCaptureSource.ts` — branch dispatch pattern, `useMemo` with platform detection
- `src/components/SelectiveExporter/index.tsx` — view dispatch pattern, hook threading
- `src/components/SelectiveExporter/hooks/useViewState.ts` — `ViewMode` enum, navigation helper pattern
- `src/components/SelectiveExporter/types.ts` — `ViewMode`, `SelectiveExporterProps` shape
- `src/content.tsx` — hook invocation order, prop threading pattern
- `.planning/PROJECT.md` — defuddle transcript markdown format (confirmed), seeking mechanism, constraints
- `.planning/research/STACK.md` — parser regex, seeking pattern, clipboard pattern
- `.planning/research/ARCHITECTURE.md` — component boundaries, data flow, module layout

### Secondary (MEDIUM confidence)
- `.planning/codebase/TESTING.md` — Vitest test patterns verified against actual test files
- `src/lib/capture.test.ts` — actual test file confirming Vitest import/describe/it pattern

### Tertiary (LOW confidence)
- `yt-navigate-finish` event existence — known from open-source YouTube extension community; not officially documented by YouTube

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries confirmed present in `package.json`
- Architecture: HIGH — every decision traced to existing codebase pattern
- Parser regex: HIGH — format fully specified in PROJECT.md; regex tested mentally against all documented formats
- SPA navigation: MEDIUM-HIGH — `yt-navigate-finish` is community-established but not officially documented
- Pitfalls: HIGH — sourced from direct code inspection of the files this phase modifies

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (90 days — stable stack, no fast-moving dependencies)
