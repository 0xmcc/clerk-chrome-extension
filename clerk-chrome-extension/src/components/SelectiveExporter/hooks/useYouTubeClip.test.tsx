import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createYouTubeClip } from "../services/youtubeClip"
import { useYouTubeClip } from "./useYouTubeClip"

vi.mock("../services/youtubeClip", () => ({
  createYouTubeClip: vi.fn()
}))

const mockedCreateYouTubeClip = vi.mocked(createYouTubeClip)

const BASE_REQUEST = {
  videoUrl: "https://www.youtube.com/watch?v=abc123",
  startSeconds: 30,
  endSeconds: 105
}

const createDeferred = () => {
  let resolve!: (value: {
    id: string
    status: "success"
    command: string
    createdAt: string
  }) => void

  const promise = new Promise<{
    id: string
    status: "success"
    command: string
    createdAt: string
  }>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

describe("useYouTubeClip", () => {
  beforeEach(() => {
    mockedCreateYouTubeClip.mockReset()
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

  it("copies the yt-dlp command, creates the clip job, and resets success state after two seconds", async () => {
    mockedCreateYouTubeClip.mockResolvedValue({
      id: "clip-1",
      status: "success",
      command:
        'yt-dlp --merge-output-format mp4 --remux-video mp4 -S vcodec:h264,lang,quality,res,fps,hdr:12,acodec:aac --download-sections "*0:30-1:45" "https://www.youtube.com/watch?v=abc123"',
      createdAt: "2026-03-21T00:00:00.000Z"
    })

    const { result } = renderHook(() => useYouTubeClip())

    await act(async () => {
      await expect(result.current.createClip(BASE_REQUEST)).resolves.toBe(true)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'yt-dlp --merge-output-format mp4 --remux-video mp4 -S vcodec:h264,lang,quality,res,fps,hdr:12,acodec:aac --download-sections "*0:30-1:45" "https://www.youtube.com/watch?v=abc123"'
    )
    expect(mockedCreateYouTubeClip).toHaveBeenCalledWith(BASE_REQUEST)

    await waitFor(() => {
      expect(result.current.status).toBe("success")
    })

    await waitFor(
      () => {
        expect(result.current.status).toBe("idle")
      },
      { timeout: 3000 }
    )
  })

  it("exposes a creating state while the background request is in flight", async () => {
    const deferred = createDeferred()
    mockedCreateYouTubeClip.mockReturnValue(deferred.promise)

    const { result } = renderHook(() => useYouTubeClip())

    act(() => {
      void result.current.createClip(BASE_REQUEST)
    })

    expect(result.current.status).toBe("creating")

    await act(async () => {
      deferred.resolve({
        id: "clip-1",
        status: "success",
        command: "yt-dlp ...",
        createdAt: "2026-03-21T00:00:00.000Z"
      })
      await deferred.promise
    })

    await waitFor(() => {
      expect(result.current.status).toBe("success")
    })
  })

  it("reports background failures after the clipboard write succeeds", async () => {
    mockedCreateYouTubeClip.mockRejectedValue(
      new Error("Background worker unavailable")
    )

    const { result } = renderHook(() => useYouTubeClip())

    await act(async () => {
      await expect(result.current.createClip(BASE_REQUEST)).resolves.toBe(false)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })

    expect(result.current.errorMessage).toBe("Background worker unavailable")
  })
})
