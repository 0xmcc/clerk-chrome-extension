import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  READY_SIGNAL_MAX_ATTEMPTS,
  READY_SIGNAL_RETRY_INTERVAL_MS,
  isInterceptorPayloadEvent,
  startReadySignalHandshake,
  toInterceptorEvent
} from "./handshake"
import {
  INTERCEPTOR_READY_ACK_SIGNAL,
  INTERCEPTOR_READY_SIGNAL,
  INTERCEPTOR_SOURCE
} from "~config/interceptor"

describe("startReadySignalHandshake", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("retries the ready signal until the interceptor acknowledges it", () => {
    const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => {})

    const stop = startReadySignalHandshake()

    expect(postMessageSpy).toHaveBeenCalledTimes(1)
    expect(postMessageSpy).toHaveBeenLastCalledWith(INTERCEPTOR_READY_SIGNAL, "*")

    vi.advanceTimersByTime(READY_SIGNAL_RETRY_INTERVAL_MS)
    expect(postMessageSpy).toHaveBeenCalledTimes(2)

    window.dispatchEvent(
      new MessageEvent("message", { data: INTERCEPTOR_READY_ACK_SIGNAL })
    )

    vi.advanceTimersByTime(READY_SIGNAL_RETRY_INTERVAL_MS * 5)
    expect(postMessageSpy).toHaveBeenCalledTimes(2)

    stop()
  })

  it("stops retrying after the max attempt count when no ack arrives", () => {
    const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => {})

    const stop = startReadySignalHandshake()

    vi.advanceTimersByTime(
      READY_SIGNAL_RETRY_INTERVAL_MS * READY_SIGNAL_MAX_ATTEMPTS * 2
    )

    expect(postMessageSpy).toHaveBeenCalledTimes(READY_SIGNAL_MAX_ATTEMPTS)

    stop()
  })
})

describe("isInterceptorPayloadEvent", () => {
  it("accepts interceptor payloads even when the browser reports a null source", () => {
    expect(
      isInterceptorPayloadEvent(
        new MessageEvent("message", {
          data: {
            source: INTERCEPTOR_SOURCE,
            url: "/api/organizations/org-123/projects/project-1"
          }
        })
      )
    ).toBe(true)
  })

  it("preserves request headers when converting an intercepted payload", () => {
    expect(
      toInterceptorEvent({
        source: INTERCEPTOR_SOURCE,
        url: "/backend-api/conversation/c1",
        headers: { authorization: "Bearer late-jwt-token" },
        data: { id: "c1" }
      })
    ).toMatchObject({
      url: "/backend-api/conversation/c1",
      headers: { authorization: "Bearer late-jwt-token" },
      data: { id: "c1" }
    })
  })
})
