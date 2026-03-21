import { describe, expect, it } from "vitest"

import {
  findActiveSegmentIndex,
  formatTimestamp,
  parseTranscriptMarkdown,
  timestampToSeconds
} from "./transcript-parser"

describe("timestampToSeconds", () => {
  it("converts M:SS format", () => {
    expect(timestampToSeconds("1:23")).toBe(83)
  })

  it("converts H:MM:SS format", () => {
    expect(timestampToSeconds("1:23:45")).toBe(5025)
  })

  it("converts 0:00", () => {
    expect(timestampToSeconds("0:00")).toBe(0)
  })

  it("converts 10:05", () => {
    expect(timestampToSeconds("10:05")).toBe(605)
  })
})

describe("formatTimestamp", () => {
  it("formats 83 seconds as 1:23", () => {
    expect(formatTimestamp(83)).toBe("1:23")
  })

  it("formats 5025 seconds as 1:23:45", () => {
    expect(formatTimestamp(5025)).toBe("1:23:45")
  })

  it("formats 0 seconds as 0:00", () => {
    expect(formatTimestamp(0)).toBe("0:00")
  })

  it("formats 61 seconds as 1:01", () => {
    expect(formatTimestamp(61)).toBe("1:01")
  })

  it("formats 3661 seconds as 1:01:01", () => {
    expect(formatTimestamp(3661)).toBe("1:01:01")
  })
})

describe("parseTranscriptMarkdown", () => {
  it("returns null for null input", () => {
    expect(parseTranscriptMarkdown(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(parseTranscriptMarkdown(undefined)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseTranscriptMarkdown("")).toBeNull()
  })

  it("returns null when no ## Transcript heading is present", () => {
    expect(parseTranscriptMarkdown("## Some Other Heading\n**0:00** Text.")).toBeNull()
  })

  it("parses a single M:SS segment", () => {
    const result = parseTranscriptMarkdown("## Transcript\n**0:31** Hello world.")
    expect(result).toEqual([{ seconds: 31, text: "Hello world.", section: undefined }])
  })

  it("parses H:MM:SS timestamp format", () => {
    const result = parseTranscriptMarkdown("## Transcript\n**1:23:45** Long video.")
    expect(result).toEqual([{ seconds: 5025, text: "Long video.", section: undefined }])
  })

  it("strips bullet character from text", () => {
    const result = parseTranscriptMarkdown("## Transcript\n**0:12** • Bullet text.")
    expect(result).not.toBeNull()
    expect(result![0].text).toBe("Bullet text.")
  })

  it("attaches chapter heading as section to subsequent segments", () => {
    const result = parseTranscriptMarkdown(
      "## Transcript\n### Intro\n**0:00** First.\n**0:10** Second."
    )
    expect(result).toEqual([
      { seconds: 0, text: "First.", section: "Intro" },
      { seconds: 10, text: "Second.", section: "Intro" }
    ])
  })

  it("changes section when a new chapter heading appears", () => {
    const result = parseTranscriptMarkdown(
      "## Transcript\n### Intro\n**0:00** A.\n### Main\n**1:00** B."
    )
    expect(result).toEqual([
      { seconds: 0, text: "A.", section: "Intro" },
      { seconds: 60, text: "B.", section: "Main" }
    ])
  })

  it("returns empty array when heading exists but no segments follow", () => {
    const result = parseTranscriptMarkdown("## Transcript\n### Just a heading")
    expect(result).toEqual([])
  })
})

describe("findActiveSegmentIndex", () => {
  const segments = [
    { seconds: 0, text: "A" },
    { seconds: 30, text: "B" },
    { seconds: 60, text: "C" }
  ]

  it("returns -1 for empty array", () => {
    expect(findActiveSegmentIndex([], 10)).toBe(-1)
  })

  it("returns -1 when time is before first segment", () => {
    expect(findActiveSegmentIndex(segments, -1)).toBe(-1)
  })

  it("returns 0 on exact match of first segment", () => {
    expect(findActiveSegmentIndex(segments, 0)).toBe(0)
  })

  it("returns 1 when time is between segments (45 is between 30 and 60)", () => {
    expect(findActiveSegmentIndex(segments, 45)).toBe(1)
  })

  it("returns last index when time is beyond last segment", () => {
    expect(findActiveSegmentIndex(segments, 999)).toBe(2)
  })

  it("returns 2 on exact match of last segment", () => {
    expect(findActiveSegmentIndex(segments, 60)).toBe(2)
  })
})
