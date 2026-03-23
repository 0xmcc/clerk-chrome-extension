import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Conversation } from "./types"

const makeJsonResponse = (url: string, json: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: new Headers({ "content-type": "application/json" }),
    json: vi.fn().mockResolvedValue(json)
  }) as unknown as Response

describe("createRescanHandler", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/chat/conv-456")
    vi.stubGlobal("fetch", vi.fn())
  })

  it("uses Claude's current chat_conversations tree endpoint to recover messages", async () => {
    const modernUrl =
      "/api/organizations/org-123/chat_conversations/conv-456?tree=True&rendering_mode=messages&render_all_tools=true&return_dangling_human_message=true"

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)

      if (url === modernUrl) {
        return makeJsonResponse(`https://claude.ai${modernUrl}`, {
          chat_messages: [{ uuid: "msg-1", sender: "human", text: "Hello" }]
        })
      }

      return makeJsonResponse(`https://claude.ai${url}`, { error: "missing" }, 404)
    })

    const { createRescanHandler } = await import("./rescan")
    const handleInterceptorEvent = vi.fn()

    const storeRef = {
      current: new Map<string, Conversation>([
        [
          "claude:conv-456",
          {
            id: "conv-456",
            platform: "claude",
            orgId: "org-123",
            messages: [],
            hasFullHistory: false,
            lastSeenAt: 0
          }
        ]
      ])
    }

    const rescan = createRescanHandler({
      capturedPlatform: "claude",
      updateAllDerivedState: vi.fn(),
      handleInterceptorEvent,
      storeRef
    })

    await rescan()

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      modernUrl,
      expect.objectContaining({
        credentials: "include",
        headers: { accept: "application/json" }
      })
    )
    expect(handleInterceptorEvent).toHaveBeenCalledTimes(1)
    expect(handleInterceptorEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        status: 200,
        url: `https://claude.ai${modernUrl}`
      })
    )
  })
})
