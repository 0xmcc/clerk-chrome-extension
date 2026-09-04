import { describe, expect, it } from "vitest"

import { parseChatGPTDetail } from "./chatgpt"

describe("parseChatGPTDetail", () => {
  it("keeps image attachments alongside the message text", () => {
    const parsed = parseChatGPTDetail("conv-with-image", {
      current_node: "user-node",
      mapping: {
        "user-node": {
          parent: null,
          message: {
            author: { role: "user" },
            content: {
              content_type: "multimodal_text",
              parts: [
                "What is in this image?",
                {
                  content_type: "image_asset_pointer",
                  asset_pointer: "https://files.example.com/uploads/cat.png",
                  name: "cat.png"
                }
              ]
            }
          }
        }
      }
    })

    expect(parsed.messages[0]).toMatchObject({
      text: "What is in this image?",
      images: [
        {
          url: "https://files.example.com/uploads/cat.png",
          name: "cat.png"
        }
      ]
    })
  })

  it("preserves ChatGPT's real conversation and message timestamps", () => {
    const parsed = parseChatGPTDetail("conv-123", {
      title: "Timestamped conversation",
      create_time: 1_700_000_000,
      update_time: 1_700_000_100,
      current_node: "assistant-node",
      mapping: {
        "user-node": {
          parent: null,
          message: {
            author: { role: "user" },
            content: { content_type: "text", parts: ["Question"] },
            create_time: 1_700_000_010
          }
        },
        "assistant-node": {
          parent: "user-node",
          message: {
            author: { role: "assistant" },
            content: { content_type: "text", parts: ["Answer"] },
            create_time: 1_700_000_020
          }
        }
      }
    })

    expect(parsed.createdAt).toBe(1_700_000_000_000)
    expect(parsed.updatedAt).toBe(1_700_000_100_000)
    expect(parsed.messages.map((message) => message.createdAt)).toEqual([
      1_700_000_010_000,
      1_700_000_020_000
    ])
  })
})
