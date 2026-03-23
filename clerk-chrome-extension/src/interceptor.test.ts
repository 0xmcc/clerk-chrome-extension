import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const INTERCEPTOR_SOURCE = "__echo_network_interceptor__"
const LISTENER_READY_SIGNAL = "__echo_listener_ready__"
const LISTENER_READY_ACK_SIGNAL = "__echo_listener_ready_ack__"

const makeJsonResponse = (json: unknown, status = 200) =>
  new Response(JSON.stringify(json), {
    status,
    headers: { "content-type": "application/json" }
  })

const loadSerializedInterceptor = async () => {
  const { installNetworkInterceptor } = await loadInterceptorModule()
  return (0, eval)(`(${installNetworkInterceptor.toString()})`) as typeof installNetworkInterceptor
}

const loadInterceptorModule = async () => {
  const realWindow = window

  Object.defineProperty(globalThis, "window", {
    value: undefined,
    configurable: true,
    writable: true
  })

  vi.resetModules()
  const module = await import("./interceptor")

  Object.defineProperty(globalThis, "window", {
    value: realWindow,
    configurable: true,
    writable: true
  })

  return module
}

describe("installNetworkInterceptor", () => {
  let originalFetch: typeof window.fetch

  beforeEach(() => {
    originalFetch = window.fetch
    delete window.__echo_net_hook_installed
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    window.fetch = originalFetch
    delete window.__echo_net_hook_installed
  })

  it("flushes queued messages when the ready signal arrives without a window source", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({ syncs: [] }))
    window.fetch = fetchMock as typeof window.fetch
    vi.stubGlobal("fetch", fetchMock)

    const postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {})

    const { installNetworkInterceptor } = await loadInterceptorModule()

    installNetworkInterceptor(
      "/backend-api/conversation/",
      "/backend-api/conversations",
      "/api/organizations/",
      "/youtubei/v1/get_transcript"
    )

    await window.fetch(
      "/api/organizations/org-123/projects/project-1/syncs?calculate_size=false"
    )

    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ source: INTERCEPTOR_SOURCE }),
      "*"
    )

    window.dispatchEvent(new MessageEvent("message", { data: LISTENER_READY_SIGNAL }))

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        source: INTERCEPTOR_SOURCE,
        url: "/api/organizations/org-123/projects/project-1/syncs?calculate_size=false"
      }),
      "*"
    )
  })

  it("works when executed as a serialized standalone function", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({ syncs: [] }))
    window.fetch = fetchMock as typeof window.fetch
    vi.stubGlobal("fetch", fetchMock)

    const postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => {})

    const serializedInterceptor = await loadSerializedInterceptor()

    serializedInterceptor(
      "/backend-api/conversation/",
      "/backend-api/conversations",
      "/api/organizations/",
      "/youtubei/v1/get_transcript"
    )

    window.dispatchEvent(new MessageEvent("message", { data: LISTENER_READY_SIGNAL }))

    expect(postMessageSpy).toHaveBeenCalledWith(LISTENER_READY_ACK_SIGNAL, "*")
  })
})
