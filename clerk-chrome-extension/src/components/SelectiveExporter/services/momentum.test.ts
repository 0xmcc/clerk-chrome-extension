import { describe, expect, it, vi } from "vitest"
import { syncCaptureToMomentum } from "./momentum"
import type { SerializableExportCapture } from "~lib/exportCapture"

const capture: SerializableExportCapture = {
  captureMode: "structured_conversation",
  conversationKey: "abc-123",
  title: "Selling Desk Converter Photo",
  messages: [
    { id: "m1", role: "user", text: "give me the perfect prompt" },
    { id: "m2", role: "assistant", text: "here is a clear pattern" }
  ],
  metadata: {
    sourceUrl: "https://chatgpt.com/c/abc-123",
    pageTitle: "Selling Desk Converter Photo",
    capturedAt: "2026-07-25T10:00:00.000Z",
    platform: "ChatGPT",
    surface: "chatgpt_conversation"
  }
}

describe("syncCaptureToMomentum", () => {
  it("sends a momentumSync message with the built payload and capturedAt", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValue({ success: true, status: 200, data: { conversations: 1 } })
    chrome.runtime.sendMessage = sendMessage

    const result = await syncCaptureToMomentum(capture, {
      url: "http://127.0.0.1:4319",
      token: "tok"
    })

    expect(result.success).toBe(true)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    const sent = sendMessage.mock.calls[0]![0]
    expect(sent.action).toBe("momentumSync")
    expect(sent.url).toBe("http://127.0.0.1:4319")
    expect(sent.token).toBe("tok")
    expect(sent.payload.title).toBe("Selling Desk Converter Photo")
    expect(sent.payload.messages).toHaveLength(2)
    expect(sent.payload.metadata.capturedAt).toBe("2026-07-25T10:00:00.000Z")
    expect(sent.payload.metadata.source).toBe("extension")
  })

  it("propagates a failed sync result", async () => {
    chrome.runtime.sendMessage = vi
      .fn()
      .mockResolvedValue({ success: false, status: 401, error: "Unauthorized" })

    const result = await syncCaptureToMomentum(capture, {
      url: "http://127.0.0.1:4319",
      token: "bad"
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe(401)
  })
})
