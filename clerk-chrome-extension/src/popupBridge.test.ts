import { describe, expect, it } from "vitest"

import { serializePopupCapture } from "./popupBridge"

describe("serializePopupCapture", () => {
  it("keeps real conversation and message timestamps for popup saves", () => {
    expect(
      serializePopupCapture({
        captureMode: "structured_conversation",
        conversationKey: "chatgpt:conv-123",
        title: "Timestamped chat",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
        messages: [
          {
            id: "m1",
            role: "user",
            text: "Question",
            authorName: "You",
            createdAt: 1_700_000_010_000,
            images: [
              {
                url: "https://files.example.com/uploads/photo.png",
                name: "photo.png"
              }
            ],
            node: document.createElement("div")
          }
        ],
        metadata: {
          sourceUrl: "https://chatgpt.com/c/conv-123",
          pageTitle: "Timestamped chat",
          capturedAt: "2026-08-01T04:02:00.000Z",
          platform: "ChatGPT",
          surface: "chatgpt_conversation"
        }
      })
    ).toMatchObject({
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
      messages: [
        {
          createdAt: 1_700_000_010_000,
          images: [
            {
              url: "https://files.example.com/uploads/photo.png",
              name: "photo.png"
            }
          ]
        }
      ]
    })
  })
})
