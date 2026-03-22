import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createYouTubeClip, getYouTubeClip } from "../services/youtubeClip"
import { useYouTubeClip } from "./useYouTubeClip"

vi.mock("../services/youtubeClip", () => ({
  createYouTubeClip: vi.fn(),
  getYouTubeClip: vi.fn()
}))

const mockedCreateYouTubeClip = vi.mocked(createYouTubeClip)
const mockedGetYouTubeClip = vi.mocked(getYouTubeClip)

const BASE_REQUEST = {
  videoUrl: "https://www.youtube.com/watch?v=abc123",
  startSeconds: 30,
  endSeconds: 105,
  videoId: "abc123",
  title: "Jensen Huang interview",
  source: "chrome_extension" as const
}

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe("useYouTubeClip", () => {
  beforeEach(() => {
    mockedCreateYouTubeClip.mockReset()
    mockedGetYouTubeClip.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("submits a clip request, polls until completed, and exposes the download URL", async () => {
    vi.useFakeTimers()

    const createdClip = {
      id: "clip-1",
      status: "queued" as const,
      createdAt: "2026-03-21T00:00:00.000Z"
    }
    const deferred = createDeferred<typeof createdClip>()
    mockedCreateYouTubeClip.mockReturnValue(deferred.promise)
    mockedGetYouTubeClip
      .mockResolvedValueOnce({
        id: "clip-1",
        status: "processing",
        createdAt: "2026-03-21T00:00:00.000Z"
      })
      .mockResolvedValueOnce({
        id: "clip-1",
        status: "completed",
        downloadUrl: "https://cdn.example.test/clip-1.mp4",
        createdAt: "2026-03-21T00:00:00.000Z"
      })

    const { result } = renderHook(() => useYouTubeClip())

    act(() => {
      void result.current.createClip(BASE_REQUEST)
    })

    expect(result.current.status).toBe("submitting")

    await act(async () => {
      deferred.resolve(createdClip)
      await deferred.promise
    })

    expect(result.current.status).toBe("queued")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(result.current.status).toBe("processing")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(result.current.status).toBe("completed")

    expect(result.current.clip).toEqual({
      id: "clip-1",
      status: "completed",
      downloadUrl: "https://cdn.example.test/clip-1.mp4",
      createdAt: "2026-03-21T00:00:00.000Z"
    })
    expect(result.current.errorMessage).toBeUndefined()
  })

  it("reports a terminal failure from the backend", async () => {
    mockedCreateYouTubeClip.mockResolvedValue({
      id: "clip-1",
      status: "failed",
      error: "Transcript unavailable",
      createdAt: "2026-03-21T00:00:00.000Z"
    })

    const { result } = renderHook(() => useYouTubeClip())

    await act(async () => {
      await expect(result.current.createClip(BASE_REQUEST)).resolves.toBe(false)
    })

    expect(result.current.status).toBe("failed")
    expect(result.current.clip).toEqual({
      id: "clip-1",
      status: "failed",
      error: "Transcript unavailable",
      createdAt: "2026-03-21T00:00:00.000Z"
    })
    expect(result.current.errorMessage).toBe("Transcript unavailable")
  })

  it("surfaces request failures", async () => {
    mockedCreateYouTubeClip.mockRejectedValue(new Error("Missing Clerk session"))

    const { result } = renderHook(() => useYouTubeClip())

    await act(async () => {
      await expect(result.current.createClip(BASE_REQUEST)).resolves.toBe(false)
    })

    expect(result.current.status).toBe("failed")
    expect(result.current.clip).toBeNull()
    expect(result.current.errorMessage).toBe("Missing Clerk session")
  })
})
