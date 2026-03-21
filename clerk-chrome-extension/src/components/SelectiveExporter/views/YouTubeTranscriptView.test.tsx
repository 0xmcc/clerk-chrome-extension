import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { TranscriptSegment } from "~lib/transcript-parser"

import { DARK_THEME } from "../constants"
import { YouTubeTranscriptView } from "./YouTubeTranscriptView"

const BASE_VIDEO_URL = "https://www.youtube.com/watch?v=abc123"

const BASE_SEGMENTS: TranscriptSegment[] = [
  { seconds: 30, text: "Intro line" },
  { seconds: 60, text: "Second line" },
  { seconds: 105, text: "Third line" },
  { seconds: 140, text: "Fourth line" }
]

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
    vi.useFakeTimers()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("selects a range and copies a yt-dlp command using the next segment start", async () => {
    renderView()

    fireEvent.click(getSegmentRow("0:30", "Intro line"))
    expect(
      screen.queryByRole("button", { name: "Copy yt-dlp command" })
    ).not.toBeInTheDocument()

    fireEvent.click(getSegmentRow("1:00", "Second line"))

    expect(screen.getByText("0:30 - 1:45 (75s)")).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Copy yt-dlp command" })
      )
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'yt-dlp --merge-output-format mp4 --remux-video mp4 -S vcodec:h264,lang,quality,res,fps,hdr:12,acodec:aac --download-sections "*0:30-1:45" "https://www.youtube.com/watch?v=abc123"'
    )
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(
      screen.getByRole("button", { name: "Copy yt-dlp command" })
    ).toBeInTheDocument()
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

  it("uses a 5-second buffer for the final segment and adds bottom padding for the sticky bar", async () => {
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

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Copy yt-dlp command" })
      )
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'yt-dlp --merge-output-format mp4 --remux-video mp4 -S vcodec:h264,lang,quality,res,fps,hdr:12,acodec:aac --download-sections "*1:00:00-1:01:06" "https://www.youtube.com/watch?v=abc123"'
    )
  })
})
