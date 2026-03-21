import { describe, it, expect } from "vitest"
import {
  getCaptionTrackUrl,
  parseYtTimedText,
  parseYtInitialPlayerResponse,
  parseYtInitialData,
  getTranscriptContinuationParams,
  parseInnerTubeTranscriptResponse,
  parseTranscriptSegmentsFromDom,
  extractTranscriptSegmentsFromDom
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
      "https://www.youtube.com/api/timedtext?v=abc&lang=en&fmt=xml"
    )
  })

  it("prefers English track over non-English", () => {
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { baseUrl: "https://www.youtube.com/api/timedtext?v=xyz&lang=fr", languageCode: "fr" },
            { baseUrl: "https://www.youtube.com/api/timedtext?v=xyz&lang=en", languageCode: "en" }
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
            { baseUrl: "https://www.youtube.com/api/timedtext?v=xyz&lang=de", languageCode: "de" }
          ]
        }
      }
    }
    expect(getCaptionTrackUrl(pr)).toContain("lang=de")
  })

  it("skips English track with no baseUrl and falls back to another track that has one", () => {
    // Real YouTube pages sometimes emit an `en` track with no baseUrl (e.g. auto-translation
    // stubs) while a different track has the actual URL.
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { languageCode: "en" }, // English track but no baseUrl
            { baseUrl: "https://www.youtube.com/api/timedtext?v=xyz&lang=fr", languageCode: "fr" }
          ]
        }
      }
    }
    expect(getCaptionTrackUrl(pr)).not.toBeNull()
  })

  it("returns null when all tracks have no baseUrl", () => {
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { languageCode: "en" },
            { languageCode: "fr" }
          ]
        }
      }
    }
    expect(getCaptionTrackUrl(pr)).toBeNull()
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

  it("handles dur attribute before start (real YouTube XML order)", () => {
    // YouTube's timedtext API often emits dur before start
    const xml = `<transcript><text dur="4.879" start="0.16">Hello world</text><text dur="2.0" start="5.04">Second line</text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result).toEqual([
      { seconds: 0, text: "Hello world" },
      { seconds: 5, text: "Second line" }
    ])
  })

  it("strips <n> newline tags from auto-generated caption text", () => {
    // Auto-generated captions use <n> or <n/> for line breaks
    const xml = `<transcript><text start="1" dur="3">Hello<n />world</text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result[0].text).toBe("Hello world")
  })

  it("handles mixed attribute order across segments", () => {
    const xml = `<transcript><text start="0" dur="1">first</text><text dur="2" start="1.5">second</text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({ seconds: 1, text: "second" })
  })

  it("strips YouTube inline styling tags like <c.colorname> from segment text", () => {
    // Manually-captioned videos use <c.color-white> or <c> tags for styling.
    const xml = `<transcript><text start="1" dur="2"><c.color-white>Hello world</c></text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result[0].text).toBe("Hello world")
  })

  it("strips <b> and <i> formatting tags, keeping their text content", () => {
    const xml = `<transcript><text start="1" dur="2">This is <b>important</b> and <i>nice</i></text></transcript>`
    const result = parseYtTimedText(xml)
    expect(result[0].text).toBe("This is important and nice")
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

  it("does not match ytInitialPlayerResponseController as the variable", () => {
    // YouTube pages sometimes have a controller variable before the real one.
    // indexOf would naively match the longer name first, then find the wrong JSON.
    const doc = document.implementation.createHTMLDocument()
    const script = doc.createElement("script")
    script.textContent = [
      'var ytInitialPlayerResponseController = {"dummy": true};',
      'var ytInitialPlayerResponse = {"videoDetails":{"title":"Real"}};'
    ].join("\n")
    doc.head.appendChild(script)
    const result = parseYtInitialPlayerResponse(doc)
    expect(result).toEqual({ videoDetails: { title: "Real" } })
  })

  it("does not match when ytInitialPlayerResponse appears only inside a string literal", () => {
    // The variable name appears as an object key string, not an assignment.
    const doc = document.implementation.createHTMLDocument()
    const script = doc.createElement("script")
    script.textContent = 'var config = {"ytInitialPlayerResponse": {"dummy": true}};'
    doc.head.appendChild(script)
    // Should return null — there is no actual assignment to the top-level variable
    expect(parseYtInitialPlayerResponse(doc)).toBeNull()
  })
})

// ─── FAILING TESTS — reproduce the real-page no_transcript bug ──────────────
//
// DevTools confirmed: ytInitialPlayerResponse IS in a script tag and the window
// global has an English captionTrack with a URL.  Yet useYouTubeTranscript still
// returns "no_transcript".  "no_transcript" is only set when parseYtTimedText
// returns 0 segments — meaning the fetch succeeded but the response body isn't
// the <text> XML format our regex expects.
//
// Root cause hypothesis: modern YouTube baseUrls contain `&fmt=json3` (or omit
// `fmt` so the API defaults to json3).  getCaptionTrackUrl returns that URL
// as-is; the fetch returns JSON3; parseYtTimedText finds no <text> tags → [].
// Fix: getCaptionTrackUrl must normalise the URL to force `fmt=xml`.

describe("getCaptionTrackUrl — fmt=xml normalisation (currently failing)", () => {
  it("replaces fmt=json3 with fmt=xml so the fetch returns parseable XML", () => {
    // Real YouTube baseUrls frequently include &fmt=json3.  Returning that URL
    // verbatim makes parseYtTimedText receive JSON, not XML → 0 segments.
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl:
                "https://www.youtube.com/api/timedtext?v=abc&lang=en&fmt=json3",
              languageCode: "en"
            }
          ]
        }
      }
    }
    const url = getCaptionTrackUrl(pr)
    expect(url).not.toContain("fmt=json3")
    expect(url).toContain("fmt=xml")
  })

  it("appends fmt=xml when the baseUrl has no fmt parameter at all", () => {
    // YouTube's timedtext API defaults to json3 when fmt is absent on modern
    // clients.  We must add fmt=xml explicitly.
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: "https://www.youtube.com/api/timedtext?v=abc&lang=en",
              languageCode: "en"
            }
          ]
        }
      }
    }
    const url = getCaptionTrackUrl(pr)
    expect(url).toContain("fmt=xml")
  })

  it("does not double-add fmt=xml when baseUrl already specifies fmt=xml", () => {
    const pr = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: "https://www.youtube.com/api/timedtext?v=abc&lang=en&fmt=xml",
              languageCode: "en"
            }
          ]
        }
      }
    }
    const url = getCaptionTrackUrl(pr)
    const fmtCount = (url ?? "").split("fmt=xml").length - 1
    expect(fmtCount).toBe(1)
  })
})

describe("parseYtTimedText — JSON3 format (documents current failure)", () => {
  it("returns segments when the response is YouTube JSON3 instead of XML", () => {
    // When getCaptionTrackUrl returns a fmt=json3 URL (current behaviour), the
    // fetch body looks like this.  parseYtTimedText currently returns [] because
    // it only matches /<text …>…<\/text>/.  This test documents the failure so
    // the fix (either normalise the URL or handle json3) is clearly visible.
    const json3 = JSON.stringify({
      wireMagic: "pb3",
      events: [
        { tStartMs: 1080, dDurationMs: 3280, segs: [{ utf8: "Hello world" }] },
        { tStartMs: 5040, dDurationMs: 2000, segs: [{ utf8: "Second line" }] },
        // YouTube emits timing-only events with no segs — must be skipped
        { tStartMs: 7000, dDurationMs: 500 }
      ]
    })
    const result = parseYtTimedText(json3)
    expect(result).toEqual([
      { seconds: 1, text: "Hello world" },
      { seconds: 5, text: "Second line" }
    ])
  })

  it("concatenates multi-word segs within a single JSON3 event", () => {
    // Auto-generated captions split a segment into per-word segs entries.
    const json3 = JSON.stringify({
      wireMagic: "pb3",
      events: [
        {
          tStartMs: 2000,
          dDurationMs: 4000,
          segs: [{ utf8: "Hello" }, { utf8: " beautiful" }, { utf8: " world" }]
        }
      ]
    })
    const result = parseYtTimedText(json3)
    expect(result).toEqual([{ seconds: 2, text: "Hello beautiful world" }])
  })
})

describe("parseYtInitialData", () => {
  it("returns null when no ytInitialData script exists", () => {
    const doc = document.implementation.createHTMLDocument()
    expect(parseYtInitialData(doc)).toBeNull()
  })

  it("returns null for unrelated scripts", () => {
    const doc = document.implementation.createHTMLDocument()
    const script = doc.createElement("script")
    script.textContent = 'var someOtherVar = {"key": "value"};'
    doc.head.appendChild(script)
    expect(parseYtInitialData(doc)).toBeNull()
  })

  it("parses ytInitialData from a script tag (var assignment)", () => {
    const doc = document.implementation.createHTMLDocument()
    const script = doc.createElement("script")
    script.textContent = 'var ytInitialData = {"engagementPanels": []};'
    doc.head.appendChild(script)
    const result = parseYtInitialData(doc)
    expect(result).toEqual({ engagementPanels: [] })
  })

  it("does not match ytInitialDataClient (word boundary check)", () => {
    const doc = document.implementation.createHTMLDocument()
    const script = doc.createElement("script")
    // ytInitialDataClient should not match the \bytInitialData\b pattern
    script.textContent = 'var ytInitialDataClient = {"client": true};'
    doc.head.appendChild(script)
    expect(parseYtInitialData(doc)).toBeNull()
  })
})

describe("getTranscriptContinuationParams", () => {
  it("returns null for empty object", () => {
    expect(getTranscriptContinuationParams({})).toBeNull()
  })

  it("returns null when engagementPanels is missing", () => {
    expect(getTranscriptContinuationParams({ videoDetails: {} })).toBeNull()
  })

  it("returns null when no panel has getTranscriptEndpoint", () => {
    const data = {
      engagementPanels: [
        {
          engagementPanelSectionListRenderer: {
            content: {
              continuationItemRenderer: {
                continuationEndpoint: {
                  commandMetadata: {}
                  // no getTranscriptEndpoint
                }
              }
            }
          }
        }
      ]
    }
    expect(getTranscriptContinuationParams(data)).toBeNull()
  })

  it("extracts params from the correct panel structure", () => {
    const data = {
      engagementPanels: [
        {
          engagementPanelSectionListRenderer: {
            content: {
              continuationItemRenderer: {
                continuationEndpoint: {
                  getTranscriptEndpoint: {
                    params: "CgttajV2X3ZXVmllSQ%3D%3D"
                  }
                }
              }
            }
          }
        }
      ]
    }
    const result = getTranscriptContinuationParams(data)
    expect(result).toBe("CgttajV2X3ZXVmllSQ==")
  })

  it("URL-decodes the params (abc%3D%3D → abc==)", () => {
    const data = {
      engagementPanels: [
        {
          engagementPanelSectionListRenderer: {
            content: {
              continuationItemRenderer: {
                continuationEndpoint: {
                  getTranscriptEndpoint: {
                    params: "abc%3D%3D"
                  }
                }
              }
            }
          }
        }
      ]
    }
    expect(getTranscriptContinuationParams(data)).toBe("abc==")
  })
})

describe("parseInnerTubeTranscriptResponse", () => {
  it("returns empty array for null data", () => {
    expect(parseInnerTubeTranscriptResponse(null)).toEqual([])
  })

  it("returns empty array for non-object data", () => {
    expect(parseInnerTubeTranscriptResponse("string")).toEqual([])
    expect(parseInnerTubeTranscriptResponse(42)).toEqual([])
  })

  it("returns empty array when actions array is empty", () => {
    expect(parseInnerTubeTranscriptResponse({ actions: [] })).toEqual([])
  })

  it("parses segments correctly from the full nested structure", () => {
    const data = {
      actions: [
        {
          updateEngagementPanelAction: {
            content: {
              transcriptRenderer: {
                content: {
                  transcriptSearchPanelRenderer: {
                    body: {
                      transcriptSegmentListRenderer: {
                        initialSegments: [
                          {
                            transcriptSegmentRenderer: {
                              startMs: "1060",
                              snippet: { runs: [{ text: "hello world" }] }
                            }
                          },
                          {
                            transcriptSegmentRenderer: {
                              startMs: "5000",
                              snippet: { runs: [{ text: "second segment" }] }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
    expect(parseInnerTubeTranscriptResponse(data)).toEqual([
      { seconds: 1, text: "hello world" },
      { seconds: 5, text: "second segment" }
    ])
  })

  it("floors fractional seconds (startMs 1500 → seconds 1)", () => {
    const data = {
      actions: [
        {
          updateEngagementPanelAction: {
            content: {
              transcriptRenderer: {
                content: {
                  transcriptSearchPanelRenderer: {
                    body: {
                      transcriptSegmentListRenderer: {
                        initialSegments: [
                          {
                            transcriptSegmentRenderer: {
                              startMs: "1500",
                              snippet: { runs: [{ text: "floored" }] }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
    const result = parseInnerTubeTranscriptResponse(data)
    expect(result[0].seconds).toBe(1)
  })

  it("skips segments with empty text", () => {
    const data = {
      actions: [
        {
          updateEngagementPanelAction: {
            content: {
              transcriptRenderer: {
                content: {
                  transcriptSearchPanelRenderer: {
                    body: {
                      transcriptSegmentListRenderer: {
                        initialSegments: [
                          {
                            transcriptSegmentRenderer: {
                              startMs: "0",
                              snippet: { runs: [{ text: "  " }] }
                            }
                          },
                          {
                            transcriptSegmentRenderer: {
                              startMs: "1000",
                              snippet: { runs: [{ text: "real text" }] }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
    const result = parseInnerTubeTranscriptResponse(data)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe("real text")
  })

  it("joins multiple runs within a segment", () => {
    const data = {
      actions: [
        {
          updateEngagementPanelAction: {
            content: {
              transcriptRenderer: {
                content: {
                  transcriptSearchPanelRenderer: {
                    body: {
                      transcriptSegmentListRenderer: {
                        initialSegments: [
                          {
                            transcriptSegmentRenderer: {
                              startMs: "2000",
                              snippet: {
                                runs: [
                                  { text: "Hello" },
                                  { text: " " },
                                  { text: "world" }
                                ]
                              }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
    const result = parseInnerTubeTranscriptResponse(data)
    expect(result[0].text).toBe("Hello world")
  })

  it("handles missing startMs (defaults to 0)", () => {
    const data = {
      actions: [
        {
          updateEngagementPanelAction: {
            content: {
              transcriptRenderer: {
                content: {
                  transcriptSearchPanelRenderer: {
                    body: {
                      transcriptSegmentListRenderer: {
                        initialSegments: [
                          {
                            transcriptSegmentRenderer: {
                              // no startMs
                              snippet: { runs: [{ text: "no timestamp" }] }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
    const result = parseInnerTubeTranscriptResponse(data)
    expect(result[0].seconds).toBe(0)
    expect(result[0].text).toBe("no timestamp")
  })
})

describe("parseTranscriptSegmentsFromDom", () => {
  it("parses timestamp and text from standard transcript row markup", () => {
    const doc = document.implementation.createHTMLDocument()
    doc.body.innerHTML = `
      <ytd-transcript-segment-renderer>
        <div id="segment-start-offset">1:02</div>
        <yt-formatted-string id="segment-text">Hello world</yt-formatted-string>
      </ytd-transcript-segment-renderer>
    `

    expect(parseTranscriptSegmentsFromDom(doc)).toEqual([
      { seconds: 62, text: "Hello world" }
    ])
  })

  it("falls back to splitting the row text when selectors are missing", () => {
    const doc = document.implementation.createHTMLDocument()
    doc.body.innerHTML = `
      <ytd-transcript-segment-renderer>
        0:05 A fallback transcript line
      </ytd-transcript-segment-renderer>
    `

    expect(parseTranscriptSegmentsFromDom(doc)).toEqual([
      { seconds: 5, text: "A fallback transcript line" }
    ])
  })
})

describe("extractTranscriptSegmentsFromDom", () => {
  it("clicks Show transcript and returns rows that appear later", async () => {
    const doc = document.implementation.createHTMLDocument()
    doc.body.innerHTML = `
      <button id="show-transcript">Show transcript</button>
      <button role="tab">Transcript</button>
      <div id="mount"></div>
    `

    const showButton = doc.getElementById("show-transcript")
    showButton?.addEventListener("click", () => {
      doc.getElementById("mount")!.innerHTML = `
        <ytd-transcript-segment-renderer>
          <div id="segment-start-offset">0:07</div>
          <yt-formatted-string id="segment-text">Hydrated row</yt-formatted-string>
        </ytd-transcript-segment-renderer>
      `
    })

    await expect(
      extractTranscriptSegmentsFromDom(doc, { maxAttempts: 2, delayMs: 0 })
    ).resolves.toEqual([{ seconds: 7, text: "Hydrated row" }])
  })
})
