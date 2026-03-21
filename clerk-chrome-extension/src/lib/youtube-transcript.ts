import type { TranscriptSegment } from "./transcript-parser"

/**
 * Parses the ytInitialPlayerResponse JSON from inline <script> tags in the document.
 * Content scripts run in an isolated JS world and cannot access window globals,
 * so we read the raw script text and parse the JSON assignment manually.
 */
export function parseYtInitialPlayerResponse(
  doc: Document
): Record<string, unknown> | null {
  const scripts = Array.from(doc.querySelectorAll("script"))
  for (const script of scripts) {
    const text = script.textContent ?? ""
    // Match both `var ytInitialPlayerResponse = {` and `ytInitialPlayerResponse={`
    const idx = text.indexOf("ytInitialPlayerResponse")
    if (idx === -1) continue

    const braceStart = text.indexOf("{", idx)
    if (braceStart === -1) continue

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
  }
  return null
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

    const englishTrack = captionTracks.find((t) =>
      t.languageCode?.startsWith("en")
    )
    const track = englishTrack ?? captionTracks[0]
    return track.baseUrl ?? null
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

/**
 * Parses YouTube's timedtext XML response into TranscriptSegment[].
 * Uses a regex-based approach for reliability across environments.
 *
 * XML format: <transcript><text start="1.08" dur="3.4">text &amp; here</text></transcript>
 */
export function parseYtTimedText(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  const textRegex = /<text\s+start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g
  let match: RegExpExecArray | null
  while ((match = textRegex.exec(xml)) !== null) {
    const seconds = Math.floor(parseFloat(match[1]))
    const text = decodeHtmlEntities(match[2]).trim()
    if (text) {
      segments.push({ seconds, text })
    }
  }
  return segments
}
