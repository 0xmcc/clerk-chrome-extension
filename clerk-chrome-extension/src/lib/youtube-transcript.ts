import { timestampToSeconds, type TranscriptSegment } from "./transcript-parser"

/**
 * Parses the ytInitialPlayerResponse JSON from inline <script> tags in the document.
 * Content scripts run in an isolated JS world and cannot access window globals,
 * so we read the raw script text and parse the JSON assignment manually.
 */
// Matches `ytInitialPlayerResponse = {` or `ytInitialPlayerResponse={`
// \b ensures we don't match ytInitialPlayerResponseController or the key
// inside an object literal like `{"ytInitialPlayerResponse": ...}` (which has `:` not `=`).
const YT_IPR_ASSIGN = /\bytInitialPlayerResponse\s*=/

/**
 * Shared brace-walker: given a text and a search pattern, finds the first
 * `{` after the match and walks to its matching `}`, then JSON.parse the
 * extracted object. Returns null if pattern not found or JSON is malformed.
 */
function extractJsonObject(
  text: string,
  pattern: RegExp
): Record<string, unknown> | null {
  const match = pattern.exec(text)
  if (!match) return null

  const braceStart = text.indexOf("{", match.index + match[0].length)
  if (braceStart === -1) return null

  // Walk brackets to find the matching closing brace
  let depth = 0
  let inString = false
  let escape = false
  for (let i = braceStart; i < text.length; i++) {
    const ch = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === "\\" && inString) {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(braceStart, i + 1)) as Record<
            string,
            unknown
          >
        } catch {
          return null
        }
      }
    }
  }
  return null
}

export function parseYtInitialPlayerResponse(
  doc: Document
): Record<string, unknown> | null {
  const scripts = Array.from(doc.querySelectorAll("script"))
  for (const script of scripts) {
    const text = script.textContent ?? ""
    const result = extractJsonObject(text, YT_IPR_ASSIGN)
    if (result !== null) return result
  }
  return null
}

// Matches `ytInitialData = {` or `ytInitialData={`
// \b ensures we don't match ytInitialDataClient or similar variants.
const YT_ID_ASSIGN = /\bytInitialData\s*=/

/**
 * Parses the ytInitialData JSON from inline <script> tags in the document.
 * Uses the same brace-walker approach as parseYtInitialPlayerResponse.
 */
export function parseYtInitialData(
  doc: Document
): Record<string, unknown> | null {
  const scripts = Array.from(doc.querySelectorAll("script"))
  for (const script of scripts) {
    const text = script.textContent ?? ""
    const result = extractJsonObject(text, YT_ID_ASSIGN)
    if (result !== null) return result
  }
  return null
}

/**
 * Extracts the transcript continuation params from ytInitialData.
 * Walks:
 *   engagementPanels[].engagementPanelSectionListRenderer.content
 *     .continuationItemRenderer.continuationEndpoint.getTranscriptEndpoint.params
 *
 * Returns the first non-empty params string found (URL-decoded).
 */
export function getTranscriptContinuationParams(
  ytInitialData: Record<string, unknown>
): string | null {
  const panels = ytInitialData.engagementPanels
  if (!Array.isArray(panels)) return null

  for (const panel of panels) {
    try {
      const renderer = (panel as Record<string, unknown>)
        .engagementPanelSectionListRenderer as Record<string, unknown> | undefined
      if (!renderer) continue

      const content = renderer.content as Record<string, unknown> | undefined
      if (!content) continue

      const continuationItem = content.continuationItemRenderer as
        | Record<string, unknown>
        | undefined
      if (!continuationItem) continue

      const continuationEndpoint = continuationItem.continuationEndpoint as
        | Record<string, unknown>
        | undefined
      if (!continuationEndpoint) continue

      const getTranscriptEndpoint = continuationEndpoint.getTranscriptEndpoint as
        | Record<string, unknown>
        | undefined
      if (!getTranscriptEndpoint) continue

      const params = getTranscriptEndpoint.params
      if (typeof params === "string" && params.length > 0) {
        return decodeURIComponent(params)
      }
    } catch {
      continue
    }
  }

  return null
}

/**
 * Parses the InnerTube /youtubei/v1/get_transcript response into TranscriptSegment[].
 * Walks:
 *   actions[].updateEngagementPanelAction.content.transcriptRenderer
 *     .content.transcriptSearchPanelRenderer.body.transcriptSegmentListRenderer
 *     .initialSegments[].transcriptSegmentRenderer
 */
export function parseInnerTubeTranscriptResponse(data: unknown): TranscriptSegment[] {
  if (!data || typeof data !== "object") return []

  const root = data as Record<string, unknown>
  const actions = root.actions
  if (!Array.isArray(actions)) return []

  for (const action of actions) {
    try {
      const updateAction = (action as Record<string, unknown>)
        .updateEngagementPanelAction as Record<string, unknown> | undefined
      if (!updateAction) continue

      const content = updateAction.content as Record<string, unknown> | undefined
      if (!content) continue

      const transcriptRenderer = content.transcriptRenderer as
        | Record<string, unknown>
        | undefined
      if (!transcriptRenderer) continue

      const transcriptContent = transcriptRenderer.content as
        | Record<string, unknown>
        | undefined
      if (!transcriptContent) continue

      const searchPanelRenderer = transcriptContent.transcriptSearchPanelRenderer as
        | Record<string, unknown>
        | undefined
      if (!searchPanelRenderer) continue

      const body = searchPanelRenderer.body as Record<string, unknown> | undefined
      if (!body) continue

      const segmentListRenderer = body.transcriptSegmentListRenderer as
        | Record<string, unknown>
        | undefined
      if (!segmentListRenderer) continue

      const initialSegments = segmentListRenderer.initialSegments
      if (!Array.isArray(initialSegments)) continue

      const segments: TranscriptSegment[] = []
      for (const item of initialSegments) {
        try {
          const segRenderer = (item as Record<string, unknown>)
            .transcriptSegmentRenderer as Record<string, unknown> | undefined
          if (!segRenderer) continue

          const startMs = segRenderer.startMs
          const seconds = Math.floor(Number(startMs ?? 0) / 1000)

          const snippet = segRenderer.snippet as Record<string, unknown> | undefined
          const runs = snippet?.runs
          if (!Array.isArray(runs)) continue

          const text = runs
            .map((r) => {
              const run = r as Record<string, unknown>
              return typeof run.text === "string" ? run.text : ""
            })
            .join("")
            .trim()

          if (!text) continue

          segments.push({ seconds, text })
        } catch {
          continue
        }
      }

      return segments
    } catch {
      continue
    }
  }

  return []
}

interface CaptionTrack {
  baseUrl?: string
  languageCode?: string
}

/**
 * Extracts the timedtext caption URL from a parsed ytInitialPlayerResponse.
 * Prefers English tracks; falls back to the first available track.
 */
export function getCaptionTrackUrl(
  playerResponse: Record<string, unknown>
): string | null {
  try {
    const captionTracks = (
      playerResponse as {
        captions?: {
          playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] }
        }
      }
    ).captions?.playerCaptionsTracklistRenderer?.captionTracks

    if (!captionTracks || captionTracks.length === 0) return null

    // Prefer the first English track that actually has a URL; fall back to
    // any track that has a URL. Stub tracks (auto-translation entries) can
    // exist in the English slot without a baseUrl.
    const englishTrack = captionTracks.find(
      (t) => t.languageCode?.startsWith("en") && t.baseUrl
    )
    const fallbackTrack = captionTracks.find((t) => t.baseUrl)
    const track = englishTrack ?? fallbackTrack
    const rawUrl = track?.baseUrl
    if (!rawUrl) return null

    // Rebuild a minimal timedtext URL. The full baseUrl from ytInitialPlayerResponse
    // contains session params (ei, opi, exp, etc.) that cause the timedtext
    // endpoint to return an empty 200 when fetched outside the original page
    // session. A minimal URL with just v + lang + fmt=xml is reliable.
    const rawParsed = new URL(rawUrl)
    const videoId = rawParsed.searchParams.get("v")
    const lang = track.languageCode ?? rawParsed.searchParams.get("lang") ?? "en"
    if (!videoId) return null
    const url = new URL("https://www.youtube.com/api/timedtext")
    url.searchParams.set("v", videoId)
    url.searchParams.set("lang", lang)
    url.searchParams.set("fmt", "xml")
    return url.toString()
  } catch {
    return null
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(parseInt(code, 10))
    )
}

interface Json3Event {
  tStartMs?: number
  segs?: Array<{ utf8?: string }>
}

const TRANSCRIPT_ROW_SELECTOR = "ytd-transcript-segment-renderer"
const TRANSCRIPT_TIMESTAMP_SELECTOR = [
  "#segment-start-offset",
  ".segment-timestamp",
  "[class*='segment-timestamp']",
  "[class*='cue-start-offset']"
].join(", ")
const TRANSCRIPT_TEXT_SELECTOR = [
  "#segment-text",
  ".segment-text",
  "[class*='segment-text']",
  "yt-formatted-string"
].join(", ")
const TIMESTAMP_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function splitTimestampAndText(text: string): {
  timestamp: string
  text: string
} | null {
  const normalized = normalizeWhitespace(text)
  const match = normalized.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.*)$/)
  if (!match) return null
  return { timestamp: match[1], text: match[2].trim() }
}

function clickIfPresent(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false
  element.click()
  return true
}

function findButtonLikeElement(
  doc: Document,
  expectedText: string
): HTMLElement | null {
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>("button, [role='button'], [role='tab']")
  )
  return (
    candidates.find(
      (candidate) => normalizeWhitespace(candidate.textContent ?? "") === expectedText
    ) ?? null
  )
}

export function parseTranscriptSegmentsFromDom(
  root: ParentNode
): TranscriptSegment[] {
  const rows = Array.from(root.querySelectorAll<HTMLElement>(TRANSCRIPT_ROW_SELECTOR))
  const segments: TranscriptSegment[] = []

  for (const row of rows) {
    const timestampCandidate = normalizeWhitespace(
      row.querySelector(TRANSCRIPT_TIMESTAMP_SELECTOR)?.textContent ?? ""
    )
    const textCandidate = normalizeWhitespace(
      row.querySelector(TRANSCRIPT_TEXT_SELECTOR)?.textContent ?? ""
    )

    let timestamp = TIMESTAMP_RE.test(timestampCandidate) ? timestampCandidate : ""
    let text = textCandidate

    if (!timestamp || !text || text === timestamp) {
      const fallback = splitTimestampAndText(row.textContent ?? "")
      if (fallback) {
        timestamp ||= fallback.timestamp
        text = text && text !== timestamp ? text : fallback.text
      }
    }

    if (!timestamp || !TIMESTAMP_RE.test(timestamp) || !text) continue

    segments.push({
      seconds: timestampToSeconds(timestamp),
      text
    })
  }

  return segments
}

export async function extractTranscriptSegmentsFromDom(
  doc: Document,
  options?: {
    maxAttempts?: number
    delayMs?: number
  }
): Promise<TranscriptSegment[]> {
  const maxAttempts = options?.maxAttempts ?? 20
  const delayMs = options?.delayMs ?? 250

  const existingSegments = parseTranscriptSegmentsFromDom(doc)
  if (existingSegments.length > 0) return existingSegments

  clickIfPresent(findButtonLikeElement(doc, "Show transcript"))

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    clickIfPresent(findButtonLikeElement(doc, "Transcript"))

    const parsed = parseTranscriptSegmentsFromDom(doc)
    if (parsed.length > 0) return parsed

    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, delayMs)
    })
  }

  return []
}

/**
 * Parses YouTube's timedtext response into TranscriptSegment[].
 * Handles both the legacy XML format and the JSON3 format that YouTube's
 * timedtext API now returns by default (empty 200 without fmt=xml).
 *
 * XML: <transcript><text start="1.08" dur="3.4">text &amp; here</text></transcript>
 * JSON3: { wireMagic: "pb3", events: [{ tStartMs, segs: [{ utf8 }] }] }
 */
export function parseYtTimedText(xml: string): TranscriptSegment[] {
  const trimmed = xml.trim()

  // JSON3 format
  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed) as { events?: Json3Event[] }
      const segments: TranscriptSegment[] = []
      for (const event of data.events ?? []) {
        if (!event.segs) continue
        const text = event.segs
          .map((s) => s.utf8 ?? "")
          .join("")
          .trim()
        if (!text) continue
        segments.push({ seconds: Math.floor((event.tStartMs ?? 0) / 1000), text })
      }
      return segments
    } catch {
      return []
    }
  }

  // XML format
  const segments: TranscriptSegment[] = []
  const tagRegex = /<text\b([^>]*)>([\s\S]*?)<\/text>/g
  const startAttrRegex = /\bstart="([\d.]+)"/
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(trimmed)) !== null) {
    const attrString = match[1]
    const startMatch = startAttrRegex.exec(attrString)
    if (!startMatch) continue
    const seconds = Math.floor(parseFloat(startMatch[1]))
    const raw = match[2]
      .replace(/<n\s*\/?>/gi, " ")     // <n/> line breaks → space
      .replace(/<[^>]+>/g, "")         // strip inline tags (<c>, <b>, <i>, etc.)
    const text = decodeHtmlEntities(raw).trim()
    if (text) {
      segments.push({ seconds, text })
    }
  }
  return segments
}
