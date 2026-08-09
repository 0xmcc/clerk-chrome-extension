import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Message } from "~hooks/useMessageScanner/types"
import { requestClerkToken } from "~utils/clerk"

import { useHumanSentimentTrajectory } from "./useHumanSentimentTrajectory"

vi.mock("~utils/clerk", () => ({
  requestClerkToken: vi.fn().mockResolvedValue("test-token")
}))

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

describe("useHumanSentimentTrajectory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
    vi.mocked(requestClerkToken).mockResolvedValue("test-token")
  })

  it("requests an LLM-scored trajectory and stores a neutral-start result", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  points: [
                    { messageIndex: 1, score: -20, label: "Uncertain" },
                    { messageIndex: 3, score: 72, label: "Happy" }
                  ]
                })
              }
            }
          ]
        }
      })
    } as unknown as Response)

    const { result } = renderHook(() =>
      useHumanSentimentTrajectory({
        source: {
          kind: "structured",
          title: "Checkout integration",
          messages: [
            makeMessage(1, "user", "I cannot get webhooks to work."),
            makeMessage(2, "assistant", "Check the signing secret."),
            makeMessage(3, "user", "That solved it, thanks.")
          ]
        }
      })
    )

    await act(async () => {
      await result.current.analyze()
    })

    expect(requestClerkToken).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/openrouter/chat/completions"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    )

    const [, requestInit] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(String(requestInit?.body))

    expect(body.model).toBe("openai/gpt-4o-mini")
    expect(body.temperature).toBeLessThanOrEqual(0.2)
    expect(body.messages[0].content).toContain("-100")
    expect(body.messages[0].content).toContain("+100")
    expect(body.messages[1].content).toContain('"index": 1')
    expect(body.messages[1].content).toContain('"role": "assistant"')
    expect(result.current.status).toBe("ready")
    expect(result.current.points).toEqual([
      { messageIndex: 0, score: 0, label: "Neutral" },
      { messageIndex: 1, score: -20, label: "Uncertain" },
      { messageIndex: 3, score: 72, label: "Happy" }
    ])
  })
})
