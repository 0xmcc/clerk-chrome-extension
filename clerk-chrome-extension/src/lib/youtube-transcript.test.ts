import { describe, it, expect } from "vitest"
import {
  getCaptionTrackUrl,
  parseYtTimedText,
  parseYtInitialPlayerResponse
} from "./youtube-transcript"

// These tests document the contract for extracting YouTube transcripts via
// ytInitialPlayerResponse.captions (not defuddle, which only extracts description).
// They were written to reproduce the bug where useYouTubeTranscript always returned
// "no_transcript" because defuddle's YouTube extractor never includes "## Transcript".

describe("getCaptionTrackUrl", () => {
  it("returns null for empty player response", () => {
    expect(getCaptionTrackUrl({})).toBeNull()
  })

  it("returns null when captions key is missing", () => {
    expect(getCaptionTrackUrl({ videoDetails: { title: "test" } })).toBeNull()
  })

  it("returns null when captionTracks array is empty", () => {
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: { captionTracks: [] }
      }
    }
    expect(getCaptionTrackUrl(pr)).toBeNull()
  })

  it("extracts baseUrl from the first caption track", () => {
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { baseUrl: "https://www.youtube.com/api/timedtext?v=abc&lang=en", languageCode: "en" }
          ]
        }
      }
    }
    expect(getCaptionTrackUrl(pr)).toBe(
      "https://www.youtube.com/api/timedtext?v=abc&lang=en"
    )
  })

  it("prefers English track over non-English", () => {
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { baseUrl: "https://www.youtube.com/api/timedtext?lang=fr", languageCode: "fr" },
            { baseUrl: "https://www.youtube.com/api/timedtext?lang=en", languageCode: "en" }
          ]
        }
      }
    }
    expect(getCaptionTrackUrl(pr)).toContain("lang=en")
  })

  it("falls back to first track when no English track exists", () => {
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { baseUrl: "https://www.youtube.com/api/timedtext?lang=de", languageCode: "de" }
          ]
        }
      }
    }
    expect(getCaptionTrackUrl(pr)).toContain("lang=de")
  })
})

describe("parseYtTimedText", () => {
  it("returns empty array for empty transcript", () => {
    expect(parseYtTimedText("<transcript></transcript>")).toEqual([])
  })

  it("converts XML timed text to TranscriptSegment array", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?><transcript><text start="1.08" dur="3.28">Hello world</text><text start="4.50" dur="2.10">Another segment</text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result).toEqual([
      { seconds: 1, text: "Hello world" },
      { seconds: 4, text: "Another segment" }
    ])
  })

  it("floors fractional seconds to integer", () => {
    const xml = `<transcript><text start="59.99" dur="1">Test</text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result[0].seconds).toBe(59)
  })

  it("decodes HTML entities in segment text", () => {
    const xml = `<transcript><text start="0" dur="1">Hello &amp; world &#39;test&#39; &quot;quoted&quot;</text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result[0].text).toBe(`Hello & world 'test' "quoted"`)
  })

  it("decodes numeric HTML entities", () => {
    const xml = `<transcript><text start="0" dur="1">caf&#233;</text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result[0].text).toBe("café")
  })

  it("skips segments with empty text after decoding", () => {
    const xml = `<transcript><text start="0" dur="1">  </text><text start="1" dur="1">real text</text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe("real text")
  })

  it("handles segments with only start attribute (no dur)", () => {
    const xml = `<transcript><text start="5">Just text</text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result).toEqual([{ seconds: 5, text: "Just text" }])
  })
})

describe("parseYtInitialPlayerResponse", () => {
  it("returns null when no ytInitialPlayerResponse script exists", () => {
    const doc = document.implementation.createHTMLDocument()
    expect(parseYtInitialPlayerResponse(doc)).toBeNull()
  })

  it("returns null for unrelated scripts", () => {
    const doc = document.implementation.createHTMLDocument()
    const script = doc.createElement("script")
    script.textContent = 'var someOtherVar = {"key": "value"};'
    doc.head.appendChild(script)
    expect(parseYtInitialPlayerResponse(doc)).toBeNull()
  })

  it("parses ytInitialPlayerResponse from a script tag (space-padded assignment)", () => {
    const doc = document.implementation.createHTMLDocument()
    const script = doc.createElement("script")
    script.textContent = 'var ytInitialPlayerResponse = {"videoDetails":{"title":"Test Video"}};'
    doc.head.appendChild(script)
    const result = parseYtInitialPlayerResponse(doc)
    expect(result).toEqual({ videoDetails: { title: "Test Video" } })
  })

  it("parses ytInitialPlayerResponse without space before equals", () => {
    const doc = document.implementation.createHTMLDocument()
    const script = doc.createElement("script")
    script.textContent = 'ytInitialPlayerResponse={"captions":{}};'
    doc.head.appendChild(script)
    const result = parseYtInitialPlayerResponse(doc)
    expect(result).toEqual({ captions: {} })
  })

  it("returns null when JSON is malformed", () => {
    const doc = document.implementation.createHTMLDocument()
    const script = doc.createElement("script")
    script.textContent = "var ytInitialPlayerResponse = {broken json;"
    doc.head.appendChild(script)
    expect(parseYtInitialPlayerResponse(doc)).toBeNull()
  })
})
