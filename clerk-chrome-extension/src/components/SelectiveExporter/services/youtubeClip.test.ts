import { describe, expect, it, vi } from "vitest"

import {
  createYouTubeClip,
  getYouTubeClipStatus
} from "./youtubeClip"

describe("youtubeClip service", () => {
  it("sends createYouTubeClip messages with the selected range", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      success: true,
      clip: {
        id: "clip-1",
        status: "success",
        command: "yt-dlp ...",
        createdAt: "2026-03-21T00:00:00.000Z"
      }
    })

    chrome.runtime.sendMessage = sendMessage

    await expect(
      createYouTubeClip({
        videoUrl: "https://www.youtube.com/watch?v=abc123",
        startSeconds: 30,
        endSeconds: 105
      })
    ).resolves.toEqual({
      id: "clip-1",
      status: "success",
      command: "yt-dlp ...",
      createdAt: "2026-03-21T00:00:00.000Z"
    })

    expect(sendMessage).toHaveBeenCalledWith({
      action: "createYouTubeClip",
      payload: {
        videoUrl: "https://www.youtube.com/watch?v=abc123",
        startSeconds: 30,
        endSeconds: 105
      }
    })
  })

  it("sends getYouTubeClipStatus messages with the job id", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      success: true,
      clip: {
        id: "clip-1",
        status: "success",
        command: "yt-dlp ...",
        createdAt: "2026-03-21T00:00:00.000Z"
      }
    })

    chrome.runtime.sendMessage = sendMessage

    await expect(getYouTubeClipStatus("clip-1")).resolves.toEqual({
      id: "clip-1",
      status: "success",
      command: "yt-dlp ...",
      createdAt: "2026-03-21T00:00:00.000Z"
    })

    expect(sendMessage).toHaveBeenCalledWith({
      action: "getYouTubeClipStatus",
      jobId: "clip-1"
    })
  })

  it("throws the background error when clip creation fails", async () => {
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      error: "Background worker unavailable"
    })

    await expect(
      createYouTubeClip({
        videoUrl: "https://www.youtube.com/watch?v=abc123",
        startSeconds: 30,
        endSeconds: 105
      })
    ).rejects.toThrow("Background worker unavailable")
  })
})
