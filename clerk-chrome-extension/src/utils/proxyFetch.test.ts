import { describe, expect, it, vi } from "vitest"

import { handleProxyFetchMessage } from "./proxyFetch"

describe("proxyFetch handler", () => {
  it("allows AgentMail requests in development and returns parsed JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ id: "msg_123" }))
    })

    await expect(
      handleProxyFetchMessage(
        {
          url: "https://api.agentmail.to/v0/inboxes/sender%40example.com/messages/send",
          method: "POST",
          headers: {
            Authorization: "Bearer secret-key",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ subject: "AI Handoff Test" })
        },
        { fetchImpl, isDevelopment: true }
      )
    ).resolves.toEqual({
      success: true,
      status: 200,
      data: { id: "msg_123" }
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.agentmail.to/v0/inboxes/sender%40example.com/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer secret-key",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ subject: "AI Handoff Test" })
      }
    )
  })

  it("returns a host-not-allowed error for misconfigured dev proxyFetch URLs", async () => {
    await expect(
      handleProxyFetchMessage(
        {
          url: "https://api.example.com/v1/messages"
        },
        { isDevelopment: true }
      )
    ).resolves.toEqual({
      success: false,
      status: 403,
      error: "proxyFetch host not allowed: api.example.com"
    })
  })

  it("returns a disabled error outside development", async () => {
    await expect(
      handleProxyFetchMessage(
        {
          url: "https://api.agentmail.to/v0/inboxes/sender%40example.com/messages/send"
        },
        { isDevelopment: false }
      )
    ).resolves.toEqual({
      success: false,
      status: 403,
      error: "proxyFetch is disabled in production builds"
    })
  })
})
