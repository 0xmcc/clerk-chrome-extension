# Architecture Patterns: YouTube Transcript Feature

**Domain:** YouTube transcript sidebar — clip creation in a Chrome extension overlay
**Researched:** 2026-03-20
**Overall confidence:** HIGH (all decisions grounded in the existing codebase)

---

## Recommended Architecture

The feature slots into the existing layered extension model without a new entry point or context boundary. All new code lives inside `clerk-chrome-extension/src/`. The integration surface is deliberately narrow: one new `Platform` value, one new `CaptureMode`, one new `ExportCapture` variant, one new view, one dedicated hook, one lib module, and one Supabase migration.

```
content.tsx
  └─ useCaptureSource (extended)        ← detects youtube, returns YouTubeTranscriptCapture
       └─ useYouTubeTranscript (new)     ← owns transcript state + playback sync
            └─ lib/transcript-parser    ← pure markdown → TranscriptSegment[]
  └─ SelectiveExporter (extended)
       └─ YouTubeTranscriptView (new)    ← renders segments, handles selection
            └─ useClipService (new)      ← Supabase save + clipboard copy
```

---

## Component Boundaries

| Module | File(s) | Responsibility | Communicates With |
|--------|---------|----------------|-------------------|
| Platform detection | `src/utils/platform.ts` | Add `"youtube"` to `Platform` union | `useCaptureSource`, `capture.ts` |
| Capture type | `src/lib/capture.ts` | Add `YouTubeTranscriptCapture` variant + `CaptureSurface` value | `useCaptureSource`, `SelectiveExporter` |
| Transcript parser | `src/lib/transcript-parser.ts` | Pure fn: defuddle markdown → `TranscriptSegment[]` | `useYouTubeTranscript` |
| Transcript hook | `src/hooks/useYouTubeTranscript.ts` | Fetch + parse transcript; expose playback sync | `useCaptureSource`, `YouTubeTranscriptView` |
| Capture source hook | `src/hooks/useCaptureSource.ts` | Add youtube branch; return `YouTubeTranscriptCapture` | `content.tsx` |
| Transcript view | `src/components/SelectiveExporter/views/YouTubeTranscriptView.tsx` | Render segments, selection state, clip trigger | `SelectiveExporter/index.tsx` |
| Clip service | `src/components/SelectiveExporter/services/clip-service.ts` | Save to Supabase `clips` table + format clipboard string | `YouTubeTranscriptView` |
| View mode | `src/components/SelectiveExporter/types.ts` | Add `"youtube_transcript"` to `ViewMode` union | `useViewState`, `SelectiveExporter/index.tsx` |
| View state hook | `src/components/SelectiveExporter/hooks/useViewState.ts` | Add `goToYouTubeTranscript()` helper | `SelectiveExporter/index.tsx` |
| Supabase migration | `clerk-chrome-extension/supabase/migrations/002_clips.sql` | Create `clips` table | Supabase project |

---

## Question 1: How should YouTube be wired into `useCaptureSource`?

**Decision: Add a `"youtube"` value to the `Platform` union and a new `CaptureMode` + capture type. `useCaptureSource` gets a third branch — no rework of existing branches.**

### Rationale

`useCaptureSource` is already a three-branch dispatcher: `structured_conversation`, `page_markdown`, early-exit for structured surfaces with no messages yet. YouTube is a fourth distinct surface that must:
- Short-circuit before the `page_markdown` fallback (which would extract defuddle markdown in a generic way)
- Return a typed capture object the `SelectiveExporter` can identify by `captureMode`

The cleanest hook to follow is the existing `detectPlatform()` / `isStructuredConversationSurface()` pattern: add a `isYouTubeWatchPage()` guard that fires before the markdown fallback.

### Files to modify

**`src/utils/platform.ts`** — add `"youtube"` to `Platform` union and to `detectPlatform()`:
```typescript
export type Platform = "chatgpt" | "claude" | "linkedin" | "youtube" | "unknown"

// In detectPlatform():
if (host.includes("youtube.com")) return "youtube"
```

**`src/lib/capture.ts`** — add new `CaptureMode`, `CaptureSurface`, and capture type:
```typescript
export type CaptureMode =
  | "structured_conversation"
  | "page_markdown"
  | "youtube_transcript"         // NEW

export type CaptureSurface =
  | "chatgpt_conversation"
  | "claude_chat"
  | "chatgpt_page"
  | "claude_page"
  | "youtube_watch"              // NEW
  | "generic_page"

export interface YouTubeTranscriptCapture {
  captureMode: "youtube_transcript"
  conversationKey: string
  videoId: string
  videoTitle: string
  videoUrl: string
  segments: TranscriptSegment[]   // defined in transcript-parser.ts
  metadata: CaptureMetadata
}

export type ExportCapture =
  | StructuredConversationCapture
  | PageMarkdownCapture
  | YouTubeTranscriptCapture      // NEW
```

Also add a helper used by `useCaptureSource`:
```typescript
export const isYouTubeWatchPage = (platform: Platform, pathname: string): boolean =>
  platform === "youtube" && pathname.startsWith("/watch")
```

**`src/hooks/useCaptureSource.ts`** — add the youtube branch at the top of the `useMemo`, before the `page_markdown` fallback:
```typescript
if (isYouTubeWatchPage(platform, pathname)) {
  // segments come from useYouTubeTranscript, passed as a new param
  return {
    capture: segments.length > 0 ? {
      captureMode: "youtube_transcript",
      conversationKey,
      videoId: extractYouTubeVideoId(sourceUrl),
      videoTitle: pageTitle,
      videoUrl: sourceUrl,
      segments,
      metadata: { sourceUrl, pageTitle, capturedAt, platform: "YouTube", surface: "youtube_watch" }
    } : null,
    emptyStateMessage: "Loading transcript..."
  }
}
```

`useCaptureSource` receives `segments: TranscriptSegment[]` as an additional param. `content.tsx` calls `useYouTubeTranscript()` and passes `segments` down. This keeps `useCaptureSource` a pure decision function with no async I/O of its own — consistent with the existing design.

**`src/hooks/useCaptureSource.ts` updated signature:**
```typescript
interface UseCaptureSourceParams {
  isOpen: boolean
  messages: Message[]
  conversationKey: string
  conversationTitle?: string
  youtubeSegments?: TranscriptSegment[]   // NEW, only populated on YouTube pages
}
```

**`src/content.tsx`** — call `useYouTubeTranscript()` unconditionally (hook ordering rule) and thread its `segments` through:
```typescript
const { segments } = useYouTubeTranscript()   // returns [] on non-YouTube pages

const { capture, emptyStateMessage } = useCaptureSource({
  isOpen: isExporterOpen,
  messages: displayMessages,
  conversationKey: displayConvoKey,
  conversationTitle: displayTitle,
  youtubeSegments: segments
})
```

---

## Question 2: Where should transcript state live?

**Decision: A new dedicated hook `useYouTubeTranscript`. Do NOT put it in `useMessageScanner`.**

### Rationale

`useMessageScanner` is purpose-built for the network-interceptor → conversation-store pipeline. It manages an IndexedDB-backed `Map` of `Conversation` objects keyed by `"${platform}:${id}"`. Transcript state has none of these characteristics:
- It is page-scoped (one video per tab), not conversation-collection-scoped
- It is derived from a synchronous defuddle parse, not an async streaming API
- It does not need IndexedDB persistence; the transcript is always re-extractable from the live page
- It has a playback-sync loop that depends on the `<video>` element, which has no analog in the scanner

Placing transcript state in a separate hook also avoids coupling the YouTube codepath to the `useMessageScanner` re-render cycle, which fires on every intercepted network event from ChatGPT/Claude.

### `useYouTubeTranscript.ts` — state shape
```typescript
interface UseYouTubeTranscriptReturn {
  segments: TranscriptSegment[]    // parsed; empty until extraction completes
  activeSegmentIndex: number       // index of segment matching current playback position
  seekTo: (seconds: number) => void
  status: "idle" | "loading" | "ready" | "error"
  errorMessage?: string
}
```

The hook:
1. On mount, checks `detectPlatform() === "youtube"` — returns empty result on other pages (safe for `content.tsx` unconditional call)
2. Runs defuddle on `document` (reusing `cloneDocumentForExtraction` from `pageCapture.ts`) and calls `parseTranscriptMarkdown()` from `transcript-parser.ts`
3. Sets up a `timeupdate` listener for playback sync (see Q3)
4. Exposes `seekTo(seconds)` which sets `document.querySelector('video')?.currentTime`

---

## Question 3: Playback position sync — polling vs. `timeupdate`?

**Decision: `timeupdate` event listener on the `<video>` element. No polling.**

### Rationale

`timeupdate` fires natively as the video plays (typically 4–250 ms intervals depending on the browser — MDN: "fired as frequently as the browser decides is useful"). It fires on seek completion too. Zero overhead compared to a `setInterval` that runs even when the video is paused.

The only edge case is the `<video>` element not yet being in the DOM when the hook mounts. This is handled with a one-time `MutationObserver` that waits for `video` to appear, then attaches the listener — matching the existing pattern in `src/contents/twitter-save-button.ts` which uses a DOM mutation guard before attaching button listeners.

### Implementation sketch inside `useYouTubeTranscript.ts`:
```typescript
useEffect(() => {
  let video = document.querySelector("video")

  const attach = (v: HTMLVideoElement) => {
    const handler = () => {
      const idx = findActiveSegmentIndex(segments, v.currentTime)
      setActiveSegmentIndex(idx)
    }
    v.addEventListener("timeupdate", handler)
    return () => v.removeEventListener("timeupdate", handler)
  }

  if (video) return attach(video)

  // Video not yet in DOM — observe
  const observer = new MutationObserver(() => {
    video = document.querySelector("video")
    if (video) {
      observer.disconnect()
      cleanup = attach(video)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}, [segments])
```

`findActiveSegmentIndex` is a pure helper in `transcript-parser.ts`: binary search over `segments` for the last segment whose `seconds <= currentTime`.

---

## Question 4: Module structure

**Recommended module layout (all paths relative to `clerk-chrome-extension/src/`):**

```
lib/
  transcript-parser.ts          NEW — pure parsing logic

hooks/
  useYouTubeTranscript.ts       NEW — transcript state + playback sync
  useCaptureSource.ts           MODIFY — add youtube branch + segments param

utils/
  platform.ts                   MODIFY — add "youtube" to Platform

lib/
  capture.ts                    MODIFY — YouTubeTranscriptCapture, new CaptureSurface/Mode

components/SelectiveExporter/
  index.tsx                     MODIFY — render YouTubeTranscriptView when captureMode === "youtube_transcript"
  types.ts                      MODIFY — add "youtube_transcript" to ViewMode
  views/
    YouTubeTranscriptView.tsx   NEW — segment list, selection, clip trigger
  services/
    clip-service.ts             NEW — Supabase insert + clipboard formatter
  hooks/
    useViewState.ts             MODIFY — add goToYouTubeTranscript()

content.tsx                     MODIFY — call useYouTubeTranscript(), thread segments into useCaptureSource
```

### `lib/transcript-parser.ts` — exports

```typescript
export interface TranscriptSegment {
  seconds: number     // canonical time for seeking and clip boundaries
  text: string        // cleaned segment text (bullet stripped)
  section?: string    // chapter heading if present
}

/**
 * Parse defuddle's contentMarkdown into typed segments.
 * Returns [] if no ## Transcript section found.
 */
export function parseTranscriptMarkdown(markdown: string): TranscriptSegment[]

/**
 * Convert "M:SS" or "H:MM:SS" timestamp string to seconds.
 */
export function timestampToSeconds(ts: string): number

/**
 * Find the index of the last segment whose seconds <= currentTime.
 * Returns -1 if segments is empty or currentTime < segments[0].seconds.
 */
export function findActiveSegmentIndex(segments: TranscriptSegment[], currentTime: number): number
```

No external dependencies — pure string/array operations. This makes the parser trivially testable.

### `views/YouTubeTranscriptView.tsx` — props

```typescript
interface YouTubeTranscriptViewProps {
  segments: TranscriptSegment[]
  activeSegmentIndex: number
  onSeek: (seconds: number) => void          // calls seekTo from useYouTubeTranscript
  onCreateClip: (start: number, end: number, text: string, videoTitle: string, videoUrl: string) => void
}
```

Internal state: `selectionStart: number | null`, `selectionEnd: number | null` (segment indices). Click-to-start, second-click-to-end selection model (simpler than drag; works in Shadow DOM).

### `services/clip-service.ts` — exports

```typescript
export interface ClipPayload {
  videoId: string
  title: string          // auto-generated: videoTitle + " [H:MM:SS – H:MM:SS]"
  url: string            // base YouTube URL, no ?t= needed on saved row
  startSeconds: number
  endSeconds: number
  text: string
  userId: string | null  // null when Clerk token unavailable (anon save)
}

export async function saveClip(payload: ClipPayload): Promise<void>
export function formatClipForClipboard(payload: ClipPayload): string
// Format: "{title}\n{H:MM:SS} – {H:MM:SS}\n\n{text}\n\n{url}?t={startSeconds}"
```

`saveClip` uses `getSupabaseClient()` directly, same as `tweet-saver.ts`. `userId` is populated by calling `requestClerkToken()` and extracting the JWT `sub` claim (or null if not signed in).

### `SelectiveExporter/index.tsx` — change summary

Add a `capture?.captureMode === "youtube_transcript"` branch in the view-area `if/else` chain:

```typescript
} : view === "youtube_transcript" ? (
  <YouTubeTranscriptView
    segments={(capture as YouTubeTranscriptCapture).segments}
    activeSegmentIndex={activeSegmentIndex}
    onSeek={seekTo}
    onCreateClip={handleCreateClip}
  />
) : view === "analysis" ? (
```

`activeSegmentIndex` and `seekTo` come from `useYouTubeTranscript`, which needs to be called in `content.tsx` and threaded through `SelectiveExporterProps`, OR called directly in `SelectiveExporter/index.tsx` (since it is a pure hook and safe to call in any React context).

**Recommendation: call `useYouTubeTranscript()` inside `SelectiveExporter/index.tsx`**, not in `content.tsx`. This keeps playback sync co-located with the view that needs it and avoids threading `activeSegmentIndex` and `seekTo` through props. `content.tsx` only needs `segments` (for `useCaptureSource`), so it calls a lighter `useYouTubeSegments()` that returns just `segments` — or simply re-exports `segments` from the same hook. The hook is idempotent; calling it twice on YouTube is fine because `timeupdate` has a single native listener regardless.

**Simpler alternative:** call `useYouTubeTranscript()` once, in `content.tsx`, pass the full return value as new props to `SelectiveExporter`. Avoids duplicate hook calls. This is the recommendation:

```typescript
// content.tsx
const youtubeTranscript = useYouTubeTranscript()

// SelectiveExporterProps: add youtubeTranscript?: UseYouTubeTranscriptReturn
// SelectiveExporter: uses youtubeTranscript.seekTo and youtubeTranscript.activeSegmentIndex
```

---

## Question 5: Supabase `clips` table

**Migration file:** `clerk-chrome-extension/supabase/migrations/002_clips.sql`

```sql
-- YouTube Transcript Clips
CREATE TABLE IF NOT EXISTS public.clips (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id       text        NOT NULL,
  title          text        NOT NULL,
  url            text        NOT NULL,
  start_seconds  integer     NOT NULL,
  end_seconds    integer     NOT NULL,
  text           text        NOT NULL,
  user_id        text,                        -- Clerk user sub; null = anonymous
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Efficient lookup for a user's clips on a given video
CREATE INDEX IF NOT EXISTS idx_clips_user_id     ON public.clips (user_id);
CREATE INDEX IF NOT EXISTS idx_clips_video_id    ON public.clips (video_id);
CREATE INDEX IF NOT EXISTS idx_clips_user_video  ON public.clips (user_id, video_id);

-- RLS: disabled initially, same pattern as tweets table.
-- Re-enable once Clerk JWT auth is wired through the extension.
ALTER TABLE public.clips DISABLE ROW LEVEL SECURITY;

-- TODO: enable when auth is confirmed working end-to-end
-- ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "users_own_clips_select" ON public.clips FOR SELECT USING (user_id = auth.jwt()->>'sub');
-- CREATE POLICY "users_own_clips_insert" ON public.clips FOR INSERT WITH CHECK (user_id = auth.jwt()->>'sub');
-- CREATE POLICY "users_own_clips_delete" ON public.clips FOR DELETE USING (user_id = auth.jwt()->>'sub');
```

**Column notes:**
- `video_id` stores the YouTube video ID string (e.g., `dQw4w9WgXcQ`), not the full URL. This allows re-constructing YouTube deep-link URLs at read time: `https://www.youtube.com/watch?v={video_id}&t={start_seconds}`.
- `title` is auto-generated on the client: `"{videoTitle} [{H:MM:SS} – {H:MM:SS}]"`.
- `user_id` is nullable to allow saves before sign-in (consistent with the tweets table pattern and the TODO comment in `supabase.ts` about re-enabling Clerk JWT RLS).
- No `updated_at` — clips are immutable after creation.

---

## Data Flow: Transcript Feature

```
1. User navigates to youtube.com/watch?v=...
2. content.tsx mounts PlasmoOverlay
3. useYouTubeTranscript() runs:
   a. detectPlatform() === "youtube" → proceed
   b. cloneDocumentForExtraction(document) + new Defuddle(...).parse()
   c. parseTranscriptMarkdown(result.contentMarkdown) → TranscriptSegment[]
   d. Attaches "timeupdate" listener to <video>
   e. Returns { segments, activeSegmentIndex, seekTo, status }

4. useCaptureSource({ ..., youtubeSegments: segments }) runs:
   a. isYouTubeWatchPage() → true
   b. Returns YouTubeTranscriptCapture if segments.length > 0

5. SelectiveExporter receives capture (captureMode: "youtube_transcript")
6. useViewState auto-navigates to "youtube_transcript" view on first open

7. YouTubeTranscriptView renders segments:
   - Each segment shows formatted timestamp + text
   - activeSegmentIndex auto-scrolls panel
   - Clicking a timestamp calls seekTo(segment.seconds)

8. User selects start + end segment → "Create Clip" button appears
9. handleCreateClip calls clip-service.saveClip() and formatClipForClipboard()
10. Clip saved to Supabase clips table, text copied to clipboard
```

---

## Integration Points with Existing Code

| Existing symbol | Change type | What changes |
|-----------------|-------------|--------------|
| `Platform` (platform.ts) | Extend union | Add `"youtube"` |
| `CaptureMode` (capture.ts) | Extend union | Add `"youtube_transcript"` |
| `CaptureSurface` (capture.ts) | Extend union | Add `"youtube_watch"` |
| `ExportCapture` (capture.ts) | Extend union | Add `YouTubeTranscriptCapture` |
| `useCaptureSource` params | Extend interface | Add `youtubeSegments?: TranscriptSegment[]` |
| `useCaptureSource` body | Add branch | YouTube guard before `page_markdown` fallback |
| `ViewMode` (types.ts) | Extend union | Add `"youtube_transcript"` |
| `SelectiveExporterProps` (types.ts) | Extend interface | Add `youtubeTranscript?: UseYouTubeTranscriptReturn` |
| `SelectiveExporter/index.tsx` | Add view branch | Render `YouTubeTranscriptView` |
| `useViewState.ts` | Add helper | `goToYouTubeTranscript()` |
| `content.tsx` | Add hook call | `useYouTubeTranscript()`, thread result |

No existing code paths are deleted. The `page_markdown` fallback remains unchanged — it will never trigger on YouTube because the new `isYouTubeWatchPage()` guard returns first.

---

## Anti-Patterns to Avoid

### Putting transcript state in `useMessageScanner`
Transcript data has no relationship to the IndexedDB conversation store or network interception pipeline. Mixing them creates unnecessary re-render coupling and complicates future removal of either feature.

### Calling `new Defuddle(...).parse()` synchronously inside `useMemo` inside `useCaptureSource`
`pageCapture.ts` already shows the correct pattern: defuddle is called inside a hook (or effect), not inline in a `useMemo` that also runs on every `[isOpen, messages, platform]` change. Put the parse in `useYouTubeTranscript` (runs once on mount with a `useEffect`).

### Using `setInterval` for playback sync
Covered in Q3. `timeupdate` is the correct primitive.

### Injecting into `document.body` from `YouTubeTranscriptView`
All UI is inside Shadow DOM (existing Plasmo constraint). Auto-scroll of the sidebar panel must target the panel's scrollable container ref, not `document.querySelector(...)` calls on the host page.

### Storing full transcript text in `clips` per-row as unlimited text
The `text` column should store only the text of the selected span, not the full video transcript. The full transcript is always re-parseable from the live page.

---

## Scalability Considerations

This is a read-heavy feature for personal use. No scalability concerns at the extension tier. Supabase write volume is user-action-triggered (one row per clip save). The clips table design is adequate through any reasonable personal use scale.

---

## Sources

All architectural decisions are derived from first-party source code inspection of the codebase at `/Users/marko/Code/clerk-chrome-extension`. Confidence is HIGH because every decision traces directly to an existing pattern in the codebase rather than external convention.

- `src/hooks/useCaptureSource.ts` — branch dispatch pattern, `platform` usage
- `src/lib/capture.ts` — `CaptureMode`, `CaptureSurface`, `ExportCapture` union
- `src/utils/platform.ts` — `Platform` union, `detectPlatform()`
- `src/lib/pageCapture.ts` — defuddle invocation pattern (`cloneDocumentForExtraction`, `buildDefuddleOptions`)
- `src/components/SelectiveExporter/index.tsx` — view dispatch (`view === "analysis"` etc.), hook threading pattern
- `src/components/SelectiveExporter/hooks/useViewState.ts` — `ViewMode` enum, navigation helper pattern
- `src/components/SelectiveExporter/types.ts` — `ViewMode`, `SelectiveExporterProps`
- `src/lib/tweet-saver.ts` — Supabase upsert pattern, `getSupabaseClient()` usage
- `clerk-chrome-extension/supabase/migrations/001_tweet_saver.sql` — migration format, RLS disabled pattern
- `src/content.tsx` — hook invocation order, prop threading to `SelectiveExporter`
- `.planning/PROJECT.md` — defuddle transcript markdown format, seeking constraint
