export interface TranscriptSegment {
  seconds: number
  text: string
  section?: string
}

/**
 * Converts a timestamp string ("M:SS" or "H:MM:SS") to total seconds.
 */
export function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number)
  if (parts.length === 3) {
    const [h, m, s] = parts
    return h * 3600 + m * 60 + s
  }
  const [m, s] = parts
  return m * 60 + s
}

/**
 * Converts total seconds to a human-readable timestamp string.
 * Uses M:SS format unless hours are present, then H:MM:SS.
 * No leading zero on the minutes/hours part.
 */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const ss = String(s).padStart(2, "0")
  if (h > 0) {
    const mm = String(m).padStart(2, "0")
    return `${h}:${mm}:${ss}`
  }
  return `${m}:${ss}`
}

/**
 * Parses defuddle's contentMarkdown into an array of TranscriptSegment objects.
 *
 * Returns null if:
 * - Input is falsy (null, undefined, empty string)
 * - No "## Transcript" heading is found in the markdown
 *
 * Returns an empty array if the heading is present but contains no timestamp lines.
 */
export function parseTranscriptMarkdown(
  markdown: string | null | undefined
): TranscriptSegment[] | null {
  if (!markdown) return null

  // Find the "## Transcript" heading (not "###")
  const transcriptIndex = markdown.search(/^## Transcript$/m)
  if (transcriptIndex === -1) return null

  const transcriptSection = markdown.slice(transcriptIndex)
  const lines = transcriptSection.split("\n")

  const segments: TranscriptSegment[] = []
  let currentSection: string | undefined = undefined

  // Regex: **timestamp** optional_bullet text
  const segmentRegex = /^\*\*(\d+:\d{2}(?::\d{2})?)\*\*\s*(?:[•*]\s*)?(.*)$/

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("### ")) {
      // Chapter heading — update current section
      currentSection = trimmed.slice(4).trim()
      continue
    }

    if (trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
      // Skip non-transcript ## headings (the "## Transcript" line itself and others)
      continue
    }

    const match = trimmed.match(segmentRegex)
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
 * Binary search to find the index of the last segment whose `seconds` value
 * is <= currentTime.
 *
 * Returns -1 if the array is empty or currentTime is before the first segment.
 */
export function findActiveSegmentIndex(
  segments: TranscriptSegment[],
  currentTime: number
): number {
  if (segments.length === 0) return -1
  if (currentTime < segments[0].seconds) return -1

  let lo = 0
  let hi = segments.length - 1
  let result = 0

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (segments[mid].seconds <= currentTime) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return result
}
