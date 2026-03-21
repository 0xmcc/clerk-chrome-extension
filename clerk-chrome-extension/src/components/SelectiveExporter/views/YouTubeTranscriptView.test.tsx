import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TranscriptSegment } from "~lib/transcript-parser"

import { DARK_THEME } from "../constants"
import { useYouTubeClip } from "../hooks/useYouTubeClip"
import { YouTubeTranscriptView } from "./YouTubeTranscriptView"

vi.mock("../hooks/useYouTubeClip", () => ({
  useYouTubeClip: vi.fn()
}))

const BASE_VIDEO_URL = "https://www.youtube.com/watch?v=abc123"

const BASE_SEGMENTS: TranscriptSegment[] = [
  { seconds: 30, text: "Intro line" },
  { seconds: 60, text: "Second line" },
  { seconds: 105, text: "Third line" },
  { seconds: 140, text: "Fourth line" }
]

const createClipMock = vi.fn()
const resetClipMock = vi.fn()
const mockedUseYouTubeClip = vi.mocked(useYouTubeClip)

const renderView = (
  props: Partial<React.ComponentProps<typeof YouTubeTranscriptView>> = {}
) =>
  render(
    <YouTubeTranscriptView
      segments={BASE_SEGMENTS}
      status="ready"
      videoUrl={BASE_VIDEO_URL}
      {...props}
    />
  )

const getSegmentRow = (timestamp: string, text: string) =>
  screen.getByRole("button", {
    name: new RegExp(`${timestamp}.*${text}`, "i")
  })

describe("YouTubeTranscriptView clip selection", () => {
  beforeEach(() => {
    createClipMock.mockReset()
    resetClipMock.mockReset()
    mockedUseYouTubeClip.mockReturnValue({
      status: "idle",
      clip: null,
      errorMessage: undefined,
      createClip: createClipMock,
      reset: resetClipMock
    })
  })

  it("selects a range and forwards the selected clip bounds to the hook", () => {
    renderView()

    fireEvent.click(getSegmentRow("0:30", "Intro line"))
    expect(
      screen.queryByRole("button", { name: "Copy yt-dlp command" })
    ).not.toBeInTheDocument()

    fireEvent.click(getSegmentRow("1:00", "Second line"))

    expect(screen.getByText("0:30 - 1:45 (75s)")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Copy yt-dlp command" }))

    expect(createClipMock).toHaveBeenCalledWith({
      videoUrl: "https://www.youtube.com/watch?v=abc123",
      startSeconds: 30,
      endSeconds: 105
    })
  })

  it("sorts reverse selections, highlights the full range, and resets to a new start after a completed range", () => {
    renderView()

    const first = getSegmentRow("0:30", "Intro line")
    const second = getSegmentRow("1:00", "Second line")
    const third = getSegmentRow("1:45", "Third line")
    const fourth = getSegmentRow("2:20", "Fourth line")

    fireEvent.click(third)
    fireEvent.click(first)

    expect(first).toHaveStyle({ backgroundColor: DARK_THEME.accentBg })
    expect(second).toHaveStyle({ backgroundColor: DARK_THEME.accentBg })
    expect(third).toHaveStyle({ backgroundColor: DARK_THEME.accentBg })
    expect(fourth).not.toHaveStyle({ backgroundColor: DARK_THEME.accentBg })
    expect(screen.getByText("0:30 - 2:20 (110s)")).toBeInTheDocument()

    fireEvent.click(fourth)

    expect(screen.queryByText("0:30 - 2:20 (110s)")).not.toBeInTheDocument()
    expect(first).not.toHaveStyle({ backgroundColor: DARK_THEME.accentBg })
    expect(second).not.toHaveStyle({ backgroundColor: DARK_THEME.accentBg })
    expect(third).not.toHaveStyle({ backgroundColor: DARK_THEME.accentBg })
    expect(fourth).toHaveStyle({ backgroundColor: DARK_THEME.accentBg })
  })

  it("clears the selection when clicking the active start or end boundary", () => {
    renderView()

    const first = getSegmentRow("0:30", "Intro line")
    const second = getSegmentRow("1:00", "Second line")

    fireEvent.click(first)
    fireEvent.click(second)
    expect(screen.getByText("0:30 - 1:45 (75s)")).toBeInTheDocument()

    fireEvent.click(second)

    expect(screen.queryByText("0:30 - 1:45 (75s)")).not.toBeInTheDocument()
    expect(first).not.toHaveStyle({ backgroundColor: DARK_THEME.accentBg })
    expect(second).not.toHaveStyle({ backgroundColor: DARK_THEME.accentBg })
  })

  it("resets the selection when the transcript or video changes", () => {
    const { rerender } = renderView()

    fireEvent.click(getSegmentRow("0:30", "Intro line"))
    fireEvent.click(getSegmentRow("1:00", "Second line"))
    expect(screen.getByText("0:30 - 1:45 (75s)")).toBeInTheDocument()

    rerender(
      <YouTubeTranscriptView
        segments={BASE_SEGMENTS}
        status="ready"
        videoUrl="https://www.youtube.com/watch?v=different"
      />
    )

    expect(screen.queryByText("0:30 - 1:45 (75s)")).not.toBeInTheDocument()

    fireEvent.click(getSegmentRow("1:00", "Second line"))
    fireEvent.click(getSegmentRow("1:45", "Third line"))
    expect(screen.getByText("1:00 - 2:20 (80s)")).toBeInTheDocument()

    rerender(
      <YouTubeTranscriptView
        segments={[
          { seconds: 5, text: "Fresh intro" },
          { seconds: 20, text: "Fresh second line" }
        ]}
        status="ready"
        videoUrl="https://www.youtube.com/watch?v=different"
      />
    )

    expect(screen.queryByText("1:00 - 2:20 (80s)")).not.toBeInTheDocument()
  })

  it("uses a 5-second buffer for the final segment and adds bottom padding for the sticky bar", () => {
    renderView({
      segments: [
        { seconds: 3600, text: "One hour mark" },
        { seconds: 3661, text: "Final line" }
      ]
    })

    fireEvent.click(getSegmentRow("1:00:00", "One hour mark"))
    fireEvent.click(getSegmentRow("1:01:01", "Final line"))

    expect(screen.getByText("1:00:00 - 1:01:06 (66s)")).toBeInTheDocument()
    expect(screen.getByTestId("yt-transcript-segment-list")).toHaveStyle({
      paddingBottom: "72px"
    })
  })
})
