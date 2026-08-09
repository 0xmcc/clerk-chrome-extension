import { describe, expect, it } from "vitest"

import type { Message } from "~hooks/useMessageScanner/types"

import {
  buildHumanSentimentUserPrompt,
  parseHumanSentimentCompletion
} from "./humanSentiment"

const makeMessage = (
  index: number,
  role: Message["role"],
  text: string
): Message => ({
  id: `message-${index}`,
  role,
  text,
  authorName: role === "user" ? "Human" : "Assistant",
  node: document.createElement("div")
})

describe("human sentiment helpers", () => {
  it("builds a transcript prompt that preserves full message indices for structured chats", () => {
    const prompt = buildHumanSentimentUserPrompt({
      kind: "structured",
      title: "Billing bug",
      messages: [
        makeMessage(1, "user", "This is confusing."),
        makeMessage(2, "assistant", "Try this setting."),
        makeMessage(3, "user", "Great, that fixed it.")
      ]
    })

    expect(prompt).toContain("Billing bug")
    expect(prompt).toContain('"index": 1')
    expect(prompt).toContain('"role": "user"')
    expect(prompt).toContain('"index": 2')
    expect(prompt).toContain('"role": "assistant"')
    expect(prompt).toContain("Great, that fixed it.")
  })

  it("builds a markdown prompt for page captures where message roles must be inferred", () => {
    const prompt = buildHumanSentimentUserPrompt({
      kind: "markdown",
      title: "ChatGPT capture",
      markdown: "# Transcript\n\nUser: I am stuck.\n\nAssistant: Let's fix it."
    })

    expect(prompt).toContain("ChatGPT capture")
    expect(prompt).toContain("Infer the human/user messages")
    expect(prompt).toContain("User: I am stuck.")
  })

  it("normalizes model JSON into a neutral-start trajectory with clamped scores", () => {
    const result = parseHumanSentimentCompletion(`
      \`\`\`json
      {
        "points": [
          { "messageIndex": 2, "score": -45.3, "label": "Frustrated" },
          { "messageIndex": 4, "score": 140, "label": "Relieved" },
          { "messageIndex": 4, "score": 35, "label": "Duplicate" }
        ]
      }
      \`\`\`
    `)

    expect(result).toEqual([
      { messageIndex: 0, score: 0, label: "Neutral" },
      { messageIndex: 2, score: -45, label: "Frustrated" },
      { messageIndex: 4, score: 100, label: "Relieved" }
    ])
  })
})
