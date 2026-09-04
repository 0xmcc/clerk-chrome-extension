import { describe, expect, it } from "vitest"

import { mergeMessagesPreferIncomingOrder } from "./mergers"
import type { Message } from "./types"

const message = (overrides: Partial<Message>): Message => ({
  id: "conv::m_0001",
  role: "user",
  text: "Original text",
  authorName: "You",
  node: document.createElement("div"),
  ...overrides
})

describe("mergeMessagesPreferIncomingOrder", () => {
  it("retains image references when a previously captured longer text wins", () => {
    const merged = mergeMessagesPreferIncomingOrder(
      [
        message({
          text: "Short text",
          images: [
            { url: "https://files.example.com/uploads/cat.png", name: "cat.png" }
          ]
        })
      ],
      [message({ text: "A longer, previously captured version of the text." })]
    )

    expect(merged[0]).toMatchObject({
      text: "A longer, previously captured version of the text.",
      images: [
        { url: "https://files.example.com/uploads/cat.png", name: "cat.png" }
      ]
    })
  })
})
