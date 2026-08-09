import { describe, expect, it, vi } from "vitest"

import { handleMomentumStatusMessage } from "./momentumSync"

const okResponse = (body: unknown = { synced: ["a"], syncedAt: { a: 1 } }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  })

describe("handleMomentumStatusMessage", () => {
  it("POSTs ids to <base>/conversations/status with the bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse())

    const result = await handleMomentumStatusMessage(
      {
        action: "momentumStatus",
        url: "http://127.0.0.1:4319",
        token: "tok",
        ids: ["a", "b"]
      },
      { fetchImpl }
    )

    expect(result.success).toBe(true)
    const [calledUrl, init] = fetchImpl.mock.calls[0]
    expect(calledUrl).toBe("http://127.0.0.1:4319/conversations/status")
    expect(init.headers.Authorization).toBe("Bearer tok")
    expect(JSON.parse(init.body)).toEqual({ ids: ["a", "b"] })
  })

  it("refuses a non-loopback host so conversation ids never leave the machine", async () => {
    const fetchImpl = vi.fn()

    const result = await handleMomentumStatusMessage(
      {
        action: "momentumStatus",
        url: "http://evil.example.com",
        token: "tok",
        ids: ["a"]
      },
      { fetchImpl }
    )

    expect(result.success).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("refuses https non-loopback and missing tokens", async () => {
    const fetchImpl = vi.fn()

    const noToken = await handleMomentumStatusMessage(
      { action: "momentumStatus", url: "http://127.0.0.1:4319", token: "", ids: [] },
      { fetchImpl }
    )

    expect(noToken.success).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("rejects a non-array ids payload", async () => {
    const fetchImpl = vi.fn()

    const result = await handleMomentumStatusMessage(
      {
        action: "momentumStatus",
        url: "http://127.0.0.1:4319",
        token: "tok",
        ids: "nope"
      },
      { fetchImpl }
    )

    expect(result.success).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("surfaces a network failure instead of throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))

    const result = await handleMomentumStatusMessage(
      {
        action: "momentumStatus",
        url: "http://127.0.0.1:4319",
        token: "tok",
        ids: ["a"]
      },
      { fetchImpl }
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain("ECONNREFUSED")
  })

  it("recognizes a running older server when its status endpoint is unavailable", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }))
      .mockResolvedValueOnce(okResponse({ conversations: 10, messages: 20 }))

    const result = await handleMomentumStatusMessage(
      {
        action: "momentumStatus",
        url: "http://127.0.0.1:4319",
        token: "tok",
        ids: ["a"]
      },
      { fetchImpl }
    )

    expect(result).toMatchObject({
      success: true,
      data: { statusUnsupported: true, synced: [] }
    })
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:4319/stats",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok" }) })
    )
  })
})
