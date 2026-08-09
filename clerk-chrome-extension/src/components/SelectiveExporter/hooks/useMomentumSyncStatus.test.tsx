import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useMomentumSyncStatus } from "./useMomentumSyncStatus"

const sendMessage = vi.fn()

beforeEach(() => {
  sendMessage.mockReset()
  ;(globalThis as any).chrome = { runtime: { sendMessage } }
})

const ids = ["a", "b"]

describe("useMomentumSyncStatus", () => {
  it("reports ready with the synced ids the server returned", async () => {
    sendMessage.mockResolvedValue({
      success: true,
      status: 200,
      data: { synced: ["a"], syncedAt: { a: 1 } }
    })

    const { result } = renderHook(() =>
      useMomentumSyncStatus(ids, {
        url: "http://127.0.0.1:4319",
        token: "tok",
        enabled: true
      })
    )

    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(result.current.syncedIds).toEqual(["a"])
    expect(result.current.syncedAt).toEqual({ a: 1 })
  })

  it("reports error when the server is unreachable", async () => {
    sendMessage.mockResolvedValue({ success: false, error: "ECONNREFUSED" })

    const { result } = renderHook(() =>
      useMomentumSyncStatus(ids, {
        url: "http://127.0.0.1:4319",
        token: "tok",
        enabled: true
      })
    )

    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(result.current.syncedIds).toEqual([])
  })

  it("reports an available server with unsupported per-conversation status", async () => {
    sendMessage.mockResolvedValue({
      success: true,
      data: { synced: [], statusUnsupported: true }
    })

    const { result } = renderHook(() =>
      useMomentumSyncStatus(ids, {
        url: "http://127.0.0.1:4319",
        token: "tok",
        enabled: true
      })
    )

    await waitFor(() => expect(result.current.status).toBe("unsupported"))
    expect(result.current.syncedIds).toEqual([])
  })

  it("does not call the server when sync is not configured", async () => {
    const { result } = renderHook(() =>
      useMomentumSyncStatus(ids, { url: "", token: "", enabled: true })
    )

    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("does not call the server while disabled, so the panel stays idle when closed", async () => {
    renderHook(() =>
      useMomentumSyncStatus(ids, {
        url: "http://127.0.0.1:4319",
        token: "tok",
        enabled: false
      })
    )

    await waitFor(() => expect(sendMessage).not.toHaveBeenCalled())
  })

  it("skips the request entirely when there are no conversations", async () => {
    const { result } = renderHook(() =>
      useMomentumSyncStatus([], {
        url: "http://127.0.0.1:4319",
        token: "tok",
        enabled: true
      })
    )

    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("refetches on demand", async () => {
    sendMessage.mockResolvedValue({
      success: true,
      status: 200,
      data: { synced: [], syncedAt: {} }
    })

    const { result } = renderHook(() =>
      useMomentumSyncStatus(ids, {
        url: "http://127.0.0.1:4319",
        token: "tok",
        enabled: true
      })
    )

    await waitFor(() => expect(result.current.status).toBe("ready"))
    const initialCalls = sendMessage.mock.calls.length

    result.current.refetch()

    await waitFor(() =>
      expect(sendMessage.mock.calls.length).toBeGreaterThan(initialCalls)
    )
  })
})
