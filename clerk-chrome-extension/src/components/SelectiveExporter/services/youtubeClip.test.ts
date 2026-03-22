import { beforeEach, describe, expect, it, vi } from "vitest"

import { API_BASE_URL } from "~config/api"
import { requestClerkToken } from "~utils/clerk"

import { createYouTubeClip, getYouTubeClip } from "./youtubeClip"

vi.mock("~utils/clerk", () => ({
  requestClerkToken: vi.fn()
}))

const mockedRequestClerkToken = vi.mocked(requestClerkToken)

describe("youtubeClip service", () => {
  beforeEach(() => {
    mockedRequestClerkToken.mockReset()
    mockedRequestClerkToken.mockResolvedValue("test-token")
    vi.stubGlobal("fetch", vi.fn())
  })

  it("creates a YouTube clip job through the backend API", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        job: {
          id: "clip_123",
          status: "queued",
          createdAt: "2026-03-21T12:00:00.000Z"
        }
      })
    } as unknown as Response)

    await expect(
      createYouTubeClip({
        videoUrl: "https://www.youtube.com/watch?v=abc123",
        startSeconds: 1380,
        endSeconds: 1398,
        videoId: "abc123",
        title: "Jensen Huang interview",
        source: "chrome_extension"
      })
    ).resolves.toEqual({
      id: "clip_123",
      status: "queued",
      createdAt: "2026-03-21T12:00:00.000Z"
    })

    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/v1/youtube-clips`, {
      method: "POST",
      body: JSON.stringify({
        videoUrl: "https://www.youtube.com/watch?v=abc123",
        startSeconds: 1380,
        endSeconds: 1398,
        videoId: "abc123",
        title: "Jensen Huang interview",
        source: "chrome_extension"
      }),
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json"
      }
    })
  })

  it("loads a YouTube clip job through the backend API", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        job: {
          id: "clip_123",
          status: "processing",
          createdAt: "2026-03-21T12:00:00.000Z",
          startedAt: "2026-03-21T12:00:02.000Z",
          progress: 35,
          downloadUrl: null,
          error: null
        }
      })
    } as unknown as Response)

    await expect(getYouTubeClip("clip_123")).resolves.toEqual({
      id: "clip_123",
      status: "processing",
      createdAt: "2026-03-21T12:00:00.000Z",
      startedAt: "2026-03-21T12:00:02.000Z",
      progress: 35,
      downloadUrl: null,
      error: null
    })

    expect(fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/v1/youtube-clips/clip_123`,
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "application/json"
        }
      }
    )
  })

  it("throws the backend error when clip creation fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({
        error: "Missing Clerk session"
      })
    } as unknown as Response)

    await expect(
      createYouTubeClip({
        videoUrl: "https://www.youtube.com/watch?v=abc123",
        startSeconds: 1380,
        endSeconds: 1398,
        videoId: "abc123",
        title: "Jensen Huang interview",
        source: "chrome_extension"
      })
    ).rejects.toThrow("Missing Clerk session")
  })
})
