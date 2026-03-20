import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createIngestionPipeline } from "./ingestion"
import type { Conversation } from "./types"

// Stub window.location for URL construction
Object.defineProperty(globalThis, "window", {
  value: { location: { origin: "https://chatgpt.com", href: "https://chatgpt.com/" } },
  writable: true,
})

const makeListResponse = (count: number, total: number, startId = 0) => ({
  total,
  items: Array.from({ length: count }, (_, i) => ({
    id: `conv-${startId + i}`,
    title: `Conversation ${startId + i}`,
    create_time: 1700000000 + i,
    update_time: 1700000000 + i,
  })),
})

const makeDeps = (overrides?: Partial<{ getAuthToken: () => string | null; upsertMany: (c: Conversation[]) => void }>) => {
  const upsertMany = vi.fn()
  return {
    upsertMany,
    getAuthToken: vi.fn().mockReturnValue("test-jwt-token"),
    ...overrides,
  }
}

describe("createIngestionPipeline", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("trigger() is idempotent — run() fires exactly once even if called multiple times", async () => {
    const deps = makeDeps()
    const resp = { ok: true, json: vi.fn().mockResolvedValue(makeListResponse(5, 5)) }
    vi.mocked(fetch).mockResolvedValue(resp as unknown as Response)

    const pipeline = createIngestionPipeline(deps)
    pipeline.trigger()
    pipeline.trigger()
    pipeline.trigger()

    await vi.runAllTimersAsync()
    // fetch called once (single page, 5 < 100 so loop ends, but trigger only ran once)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it("returns early without fetching when auth token is null", async () => {
    const deps = makeDeps({ getAuthToken: vi.fn().mockReturnValue(null) })
    const pipeline = createIngestionPipeline(deps)
    pipeline.trigger()

    await vi.runAllTimersAsync()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    expect(deps.upsertMany).not.toHaveBeenCalled()
  })

  it("single page: fetches once and terminates when offset >= total", async () => {
    const deps = makeDeps()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(makeListResponse(25, 25)),
    } as unknown as Response)

    const pipeline = createIngestionPipeline(deps)
    pipeline.trigger()
    await vi.runAllTimersAsync()

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    expect(deps.upsertMany).toHaveBeenCalledTimes(1)
    expect(deps.upsertMany.mock.calls[0][0]).toHaveLength(25)
  })

  it("multi-page: paginates with correct offsets until offset >= total", async () => {
    const deps = makeDeps()
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(makeListResponse(100, 250, 0)) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(makeListResponse(100, 250, 100)) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(makeListResponse(50, 250, 200)) } as unknown as Response)

    const pipeline = createIngestionPipeline(deps)
    pipeline.trigger()
    await vi.runAllTimersAsync()

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
    // Check offsets
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => url as string)
    expect(urls[0]).toContain("offset=0")
    expect(urls[1]).toContain("offset=100")
    expect(urls[2]).toContain("offset=200")
    expect(deps.upsertMany).toHaveBeenCalledTimes(3)
  })

  it("terminates on empty page when json.total is missing", async () => {
    const deps = makeDeps()
    // No total field — falls back to empty-page termination
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ items: [{ id: "c1", title: "T", create_time: 1, update_time: 1 }] }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ items: [] }) } as unknown as Response)

    const pipeline = createIngestionPipeline(deps)
    pipeline.trigger()
    await vi.runAllTimersAsync()

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
    expect(deps.upsertMany).toHaveBeenCalledTimes(1)
  })

  it("breaks gracefully on non-ok response without throwing", async () => {
    const deps = makeDeps()
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as unknown as Response)

    const pipeline = createIngestionPipeline(deps)
    await expect(async () => {
      pipeline.trigger()
      await vi.runAllTimersAsync()
    }).not.toThrow()

    expect(deps.upsertMany).not.toHaveBeenCalled()
  })

  it("breaks gracefully on fetch network error without throwing", async () => {
    const deps = makeDeps()
    vi.mocked(fetch).mockRejectedValue(new Error("network failure"))

    const pipeline = createIngestionPipeline(deps)
    await expect(async () => {
      pipeline.trigger()
      await vi.runAllTimersAsync()
    }).not.toThrow()

    expect(deps.upsertMany).not.toHaveBeenCalled()
  })

  it("cancel() stops the loop before the next fetch", async () => {
    const deps = makeDeps()
    let resolvePage1: (v: unknown) => void
    const page1Promise = new Promise(r => { resolvePage1 = r })

    vi.mocked(fetch)
      .mockReturnValueOnce(page1Promise as unknown as Promise<Response>)
      .mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(makeListResponse(100, 300, 100)) } as unknown as Response)

    const pipeline = createIngestionPipeline(deps)
    pipeline.trigger()

    // Cancel before page 1 resolves
    pipeline.cancel()
    resolvePage1!({ ok: true, json: vi.fn().mockResolvedValue(makeListResponse(100, 300, 0)) })

    await vi.runAllTimersAsync()

    // Only page 1 fetch happened; page 2 was cancelled before it could start
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it("uses ENDPOINTS.chatgpt.list path in the fetch URL, not a hardcoded string", async () => {
    const deps = makeDeps()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(makeListResponse(5, 5)),
    } as unknown as Response)

    const pipeline = createIngestionPipeline(deps)
    pipeline.trigger()
    await vi.runAllTimersAsync()

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain("/backend-api/conversations")
  })

  it("upserts conversations with hasFullHistory: false and empty messages", async () => {
    const deps = makeDeps()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(makeListResponse(2, 2)),
    } as unknown as Response)

    const pipeline = createIngestionPipeline(deps)
    pipeline.trigger()
    await vi.runAllTimersAsync()

    const upserted: Conversation[] = deps.upsertMany.mock.calls[0][0]
    expect(upserted).toHaveLength(2)
    upserted.forEach(c => {
      expect(c.hasFullHistory).toBe(false)
      expect(c.messages).toEqual([])
      expect(c.platform).toBe("chatgpt")
    })
  })
})

describe("handlers onChatGPTListIntercepted integration", () => {
  it("callback is called after list upsert, not after detail events", async () => {
    const { createInterceptorEventHandler } = await import("./handlers")

    const upsertMany = vi.fn()
    const onChatGPTListIntercepted = vi.fn()

    const handler = createInterceptorEventHandler({
      capturedPlatform: "chatgpt",
      upsertMany,
      updateActiveMessagesFromStore: vi.fn(),
      onChatGPTListIntercepted,
    })

    // Fire a list event
    handler({
      source: "__echo_network_interceptor__",
      url: "https://chatgpt.com/backend-api/conversations",
      method: "GET",
      status: 200,
      ok: true,
      ts: Date.now(),
      data: { items: [{ id: "c1", title: "T", create_time: 1700000000, update_time: 1700000001 }], total: 1 },
    })

    expect(onChatGPTListIntercepted).toHaveBeenCalledTimes(1)

    onChatGPTListIntercepted.mockClear()
    upsertMany.mockClear()

    // Fire a detail event — callback should NOT fire
    handler({
      source: "__echo_network_interceptor__",
      url: "https://chatgpt.com/backend-api/conversation/c1",
      method: "GET",
      status: 200,
      ok: true,
      ts: Date.now(),
      data: {
        id: "c1",
        title: "T",
        create_time: 1700000000,
        update_time: 1700000001,
        current_node: "node1",
        mapping: {
          node1: { id: "node1", message: { id: "msg1", author: { role: "user" }, content: { content_type: "text", parts: ["hello"] }, create_time: 1700000000 }, parent: null, children: [] },
        },
      },
    })

    expect(onChatGPTListIntercepted).not.toHaveBeenCalled()
  })
})
