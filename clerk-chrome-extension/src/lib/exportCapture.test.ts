import { describe, expect, it } from "vitest"

import { buildCaptureExportPayload } from "./exportCapture"

describe("buildCaptureExportPayload", () => {
  it("includes message images as markdown references and structured metadata", () => {
    const payload = buildCaptureExportPayload(
      {
        captureMode: "structured_conversation",
        conversationKey: "chatgpt:conv-with-image",
        messages: [
          {
            id: "conv-with-image::m_0001",
            role: "user",
            text: "What is in this image?",
            images: [
              {
                url: "https://files.example.com/uploads/cat.png",
                name: "cat.png"
              }
            ]
          }
        ],
        metadata: {
          sourceUrl: "https://chatgpt.com/c/conv-with-image",
          pageTitle: "Conversation with image",
          capturedAt: "2026-08-25T12:00:00.000Z",
          platform: "ChatGPT",
          surface: "chatgpt_conversation"
        }
      } as never,
      "chrome_extension"
    )

    expect(payload.messages[0]).toMatchObject({
      content:
        "What is in this image?\n\n![cat.png](https://files.example.com/uploads/cat.png)",
      metadata: {
        images: [
          {
            url: "https://files.example.com/uploads/cat.png",
            name: "cat.png"
          }
        ]
      }
    })
  })
})
