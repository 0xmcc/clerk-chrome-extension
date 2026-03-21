import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  detectPlatformMock,
  waitForYouTubeTranscriptResponseMock,
  extractTranscriptSegmentsFromDomMock,
  parseYtInitialPlayerResponseMock,
  getCaptionTrackUrlMock,
  parseYtTimedTextMock
} = vi.hoisted(() => ({
  detectPlatformMock: vi.fn(),
  waitForYouTubeTranscriptResponseMock: vi.fn(),
  extractTranscriptSegmentsFromDomMock: vi.fn(),
  parseYtInitialPlayerResponseMock: vi.fn(),
  getCaptionTrackUrlMock: vi.fn(),
  parseYtTimedTextMock: vi.fn()
}))

vi.mock("~utils/platform", () => ({
  detectPlatform: detectPlatformMock
}))

vi.mock("~lib/youtube-transcript", async () => {
  const actual =
    await vi.importActual<typeof import("~lib/youtube-transcript")>(
      "~lib/youtube-transcript"
    )

  return {
    ...actual,
    waitForYouTubeTranscriptResponse: waitForYouTubeTranscriptResponseMock,
    extractTranscriptSegmentsFromDom: extractTranscriptSegmentsFromDomMock,
    parseYtInitialPlayerResponse: parseYtInitialPlayerResponseMock,
    getCaptionTrackUrl: getCaptionTrackUrlMock,
    parseYtTimedText: parseYtTimedTextMock
  }
})

import { useYouTubeTranscript } from "./useYouTubeTranscript"

const EMPTY_TIMEDTEXT_XML = "<transcript></transcript>"

const NEW_TRANSCRIPT_DOM = `
  <transcript-segment-view-model>
    <div class="ytwTranscriptSegmentViewModelTimestamp">0:06</div>
    <div class="ytwTranscriptSegmentViewModelSnippet">
      quinoa, maybe some Brussels sprouts.
    </div>
  </transcript-segment-view-model>
  <transcript-segment-view-model>
    <div class="ytwTranscriptSegmentViewModelTimestamp">0:13</div>
    <div class="ytwTranscriptSegmentViewModelSnippet">
      when I'm not here, I want Brad Gersonner in the seat.
    </div>
  </transcript-segment-view-model>
`

describe("useYouTubeTranscript late transcript hydration", () => {
  beforeEach(() => {
    detectPlatformMock.mockReturnValue("youtube")
    waitForYouTubeTranscriptResponseMock.mockResolvedValue([])
    extractTranscriptSegmentsFromDomMock.mockResolvedValue([])
    parseYtInitialPlayerResponseMock.mockReturnValue({ captions: {} })
    getCaptionTrackUrlMock.mockReturnValue(
      "https://www.youtube.com/api/timedtext?v=test&lang=en&fmt=xml"
    )
    parseYtTimedTextMock.mockReturnValue([])

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/xml" }),
        text: vi.fn().mockResolvedValue(EMPTY_TIMEDTEXT_XML)
      } as unknown as Response)
    )

    window.history.pushState({}, "", "/watch?v=test-video")
    document.title = "Late transcript hydration"
    document.body.innerHTML = ""
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ""
  })

  it("should recover when transcript rows appear after the initial no_transcript result", async () => {
    const { result, unmount } = renderHook(() => useYouTubeTranscript())

    await waitFor(() => {
      expect(result.current.status).toBe("no_transcript")
    })

    expect(result.current.segments).toEqual([])

    act(() => {
      document.body.innerHTML = NEW_TRANSCRIPT_DOM
    })

    await waitFor(() => {
      expect(result.current.status).toBe("ready")
    })

    expect(result.current.segments).toEqual([
      { seconds: 6, text: "quinoa, maybe some Brussels sprouts." },
      {
        seconds: 13,
        text: "when I'm not here, I want Brad Gersonner in the seat."
      }
    ])

    unmount()
  })

  it("should recover when the transcript panel is opened after the hook already settled", async () => {
    const { result, unmount } = renderHook(() => useYouTubeTranscript())

    await waitFor(() => {
      expect(result.current.status).toBe("no_transcript")
    })

    act(() => {
      document.body.innerHTML = `
        <button role="tab" id="transcript-tab">Transcript</button>
        <div id="transcript-mount"></div>
      `

      document
        .getElementById("transcript-tab")
        ?.addEventListener("click", () => {
          document.getElementById("transcript-mount")!.innerHTML =
            NEW_TRANSCRIPT_DOM
        })
    })

    act(() => {
      document.getElementById("transcript-tab")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      )
    })

    await waitFor(() => {
      expect(result.current.status).toBe("ready")
    })

    expect(result.current.segments[0]).toEqual({
      seconds: 6,
      text: "quinoa, maybe some Brussels sprouts."
    })

    unmount()
  })
})
