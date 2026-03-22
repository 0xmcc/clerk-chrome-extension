import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TranscriptSegment } from "~lib/transcript-parser"

import { useYouTubeClip } from "../hooks/useYouTubeClip"
import { YouTubeTranscriptView } from "./YouTubeTranscriptView"

vi.mock("../hooks/useYouTubeClip", () => ({
  useYouTubeClip: vi.fn()
}))

const BASE_VIDEO_URL = "https://www.youtube.com/watch?v=abc123"
const BASE_VIDEO_ID = "abc123"
const BASE_VIDEO_TITLE = "Jensen Huang interview"

const BASE_SEGMENTS: TranscriptSegment[] = [
  { seconds: 30, text: "Intro line" },
  { seconds: 60, text: "Second line" },
  { seconds: 105, text: "Third line" },
  { seconds: 140, text: "Fourth line" }
]

const createClipMock = vi.fn()
const resetClipMock = vi.fn()
const openMock = vi.fn()
const mockedUseYouTubeClip = vi.mocked(useYouTubeClip)

const renderView = (
  props: Partial<React.ComponentProps<typeof YouTubeTranscriptView>> = {}
) =>
  render(
    <YouTubeTranscriptView
      segments={BASE_SEGMENTS}
      status="ready"
      videoId={BASE_VIDEO_ID}
      videoTitle={BASE_VIDEO_TITLE}
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
    openMock.mockReset()
    vi.stubGlobal("open", openMock)
    mockedUseYouTubeClip.mockReturnValue({
      status: "idle",
      clip: null,
      errorMessage: undefined,
      createClip: createClipMock,
      reset: resetClipMock
    })
  })

  it("selects a range and forwards the selected clip metadata to the hook", () => {
    renderView()

    fireEvent.click(getSegmentRow("0:30", "Intro line"))
    expect(
      screen.queryByRole("button", { name: "Create clip" })
    ).not.toBeInTheDocument()

    fireEvent.click(getSegmentRow("1:00", "Second line"))
    fireEvent.click(screen.getByRole("button", { name: "Create clip" }))

    expect(createClipMock).toHaveBeenCalledWith({
      videoUrl: BASE_VIDEO_URL,
      startSeconds: 30,
      endSeconds: 105,
      videoId: BASE_VIDEO_ID,
      title: BASE_VIDEO_TITLE,
      source: "chrome_extension"
    })
  })

  it("renders a download action when the clip is completed", () => {
    mockedUseYouTubeClip.mockReturnValue({
      status: "completed",
      clip: {
        id: "clip_123",
        status: "completed",
        createdAt: "2026-03-21T12:00:00.000Z",
        downloadUrl: "https://cdn.example.test/clip.mp4"
      },
      errorMessage: undefined,
      createClip: createClipMock,
      reset: resetClipMock
    })

    renderView()

    fireEvent.click(getSegmentRow("0:30", "Intro line"))
    fireEvent.click(getSegmentRow("1:00", "Second line"))
    fireEvent.click(screen.getByRole("button", { name: "Download clip" }))

    expect(openMock).toHaveBeenCalledWith(
      "https://cdn.example.test/clip.mp4",
      "_blank",
      "noopener,noreferrer"
    )
    expect(screen.getByText("Clip ready.")).toBeInTheDocument()
  })

  it("shows backend failures inline", () => {
    mockedUseYouTubeClip.mockReturnValue({
      status: "failed",
      clip: {
        id: "clip_123",
        status: "failed",
        createdAt: "2026-03-21T12:00:00.000Z",
        error: "Missing Clerk session"
      },
      errorMessage: "Missing Clerk session",
      createClip: createClipMock,
      reset: resetClipMock
    })

    renderView()

    fireEvent.click(getSegmentRow("0:30", "Intro line"))
    fireEvent.click(getSegmentRow("1:00", "Second line"))

    expect(screen.getByRole("alert")).toHaveTextContent("Missing Clerk session")
    expect(screen.getByRole("button", { name: "Retry clip" })).toBeInTheDocument()
  })
})
