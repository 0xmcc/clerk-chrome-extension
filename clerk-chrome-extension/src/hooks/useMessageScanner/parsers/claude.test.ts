import { describe, expect, it } from "vitest"

import { extractClaudeText, parseClaudeDetail } from "./claude"

describe("extractClaudeText", () => {
  it("falls back to structured content blocks when text is present but empty", () => {
    expect(
      extractClaudeText({
        text: "",
        content: [{ type: "text", text: "Hello from Claude" }]
      })
    ).toBe("Hello from Claude")
  })
})

describe("parseClaudeDetail", () => {
  it("keeps chat_messages that use content blocks instead of top-level text", () => {
    const parsed = parseClaudeDetail("org-123", "conv-456", {
      chat_messages: [
        {
          uuid: "msg-1",
          sender: "human",
          text: "",
          content: [{ type: "text", text: "Question from user" }]
        },
        {
          uuid: "msg-2",
          sender: "assistant",
          text: "",
          content: [
            { type: "thinking", text: "" },
            { type: "text", text: "Answer from Claude" }
          ]
        }
      ]
    })

    expect(parsed.messages).toHaveLength(2)
    expect(parsed.messages[0]).toMatchObject({
      role: "user",
      text: "Question from user"
    })
    expect(parsed.messages[1]).toMatchObject({
      role: "assistant",
      text: "Answer from Claude"
    })
  })
})
