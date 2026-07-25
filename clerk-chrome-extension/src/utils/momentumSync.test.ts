import { describe, expect, it, vi } from "vitest"
import { handleMomentumSyncMessage } from "./momentumSync"

const payload = { conversationId: "c1", title: "T", messages: [] }

const okResponse = () =>
  new Response(JSON.stringify({ imported: 1, conversations: 1, messages: 0 }), {
    status: 200,
    headers: { "content-type": "application/json" }
  })

describe("handleMomentumSyncMessage", () => {
  it("POSTs the payload to <base>/captures with the bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse())
    const result = await handleMomentumSyncMessage(
      { action: "momentumSync", url: "http://127.0.0.1:4319", token: "tok", payload },
      { fetchImpl }
    )

    expect(result.success).toBe(true)
    expect(result.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchImpl.mock.calls[0]!
    expect(calledUrl).toBe("http://127.0.0.1:4319/captures")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe("Bearer tok")
    expect(JSON.parse(init.body)).toEqual(payload)
  })

  it("normalizes a base URL with a trailing slash to /captures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse())
    await handleMomentumSyncMessage(
      { action: "momentumSync", url: "http://localhost:4319/", token: "tok", payload },
      { fetchImpl }
    )
    expect(fetchImpl.mock.calls[0]![0]).toBe("http://localhost:4319/captures")
  })

  it("refuses a non-loopback host and never fetches", async () => {
    const fetchImpl = vi.fn()
    const result = await handleMomentumSyncMessage(
      { action: "momentumSync", url: "http://evil.example.com/captures", token: "tok", payload },
      { fetchImpl }
    )
    expect(result.success).toBe(false)
    expect(result.status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("refuses an https (non-loopback) URL", async () => {
    const fetchImpl = vi.fn()
    const result = await handleMomentumSyncMessage(
      { action: "momentumSync", url: "https://127.0.0.1:4319", token: "tok", payload },
      { fetchImpl }
    )
    expect(result.success).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("requires a token", async () => {
    const fetchImpl = vi.fn()
    const result = await handleMomentumSyncMessage(
      { action: "momentumSync", url: "http://127.0.0.1:4319", token: "", payload },
      { fetchImpl }
    )
    expect(result.success).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("surfaces a non-ok server response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }))
    const result = await handleMomentumSyncMessage(
      { action: "momentumSync", url: "http://127.0.0.1:4319", token: "bad", payload },
      { fetchImpl }
    )
    expect(result.success).toBe(false)
    expect(result.status).toBe(401)
  })

  it("returns an error when fetch throws (server not running)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    const result = await handleMomentumSyncMessage(
      { action: "momentumSync", url: "http://127.0.0.1:4319", token: "tok", payload },
      { fetchImpl }
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain("ECONNREFUSED")
  })
})
