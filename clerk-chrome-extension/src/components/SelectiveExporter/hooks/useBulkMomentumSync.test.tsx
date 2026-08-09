import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { Conversation } from "~hooks/useMessageScanner/types"

import { useBulkMomentumSync } from "./useBulkMomentumSync"

const { syncCaptureToMomentum } = vi.hoisted(() => ({
  syncCaptureToMomentum: vi.fn()
}))

vi.mock("../services/momentum", () => ({ syncCaptureToMomentum }))

const conversation = (id: string): Conversation => ({
  id,
  platform: "chatgpt",
  title: `Conversation ${id}`,
  createdAt: 1_600_000_000_000,
  updatedAt: 1_650_000_000_000,
  hasFullHistory: true,
  lastSeenAt: 1_700_000_000_000,
  messages: [
    {
      id: `${id}-m1`,
      role: "user",
      text: "Hello",
      authorName: "Me",
      createdAt: 1_600_000_010_000,
      node: document.body
    }
  ]
})

describe("useBulkMomentumSync", () => {
  it("syncs every requested conversation, reports incremental progress, and retries only failures", async () => {
    syncCaptureToMomentum
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: "offline" })
      .mockResolvedValueOnce({ success: true })
    const refetch = vi.fn()
    const { result } = renderHook(() =>
      useBulkMomentumSync({
        url: "http://127.0.0.1:4319",
        token: "token",
        onComplete: refetch
      })
    )

    act(() => result.current.sync([conversation("a"), conversation("b")]))

    await waitFor(() => expect(result.current.state.state).toBe("error"))
    expect(result.current.state).toMatchObject({
      completed: 1,
      total: 2,
      failed: 1
    })
    expect(refetch).toHaveBeenCalledOnce()

    act(() => result.current.retryFailed())

    await waitFor(() => expect(result.current.state.state).toBe("success"))
    expect(syncCaptureToMomentum).toHaveBeenCalledTimes(3)
    expect(syncCaptureToMomentum.mock.calls[0]![0]).toMatchObject({
      createdAt: 1_600_000_000_000,
      updatedAt: 1_650_000_000_000,
      messages: [{ createdAt: 1_600_000_010_000 }]
    })
    expect(refetch).toHaveBeenCalledTimes(2)
  })

  it("loads a lightweight collection row before syncing it", async () => {
    syncCaptureToMomentum.mockResolvedValue({ success: true })
    const loadConversation = vi.fn().mockResolvedValue(conversation("loaded"))
    const { result } = renderHook(() =>
      useBulkMomentumSync({
        url: "http://127.0.0.1:4319",
        token: "token",
        onComplete: vi.fn(),
        loadConversation
      })
    )

    act(() =>
      result.current.sync([
        { ...conversation("lightweight"), hasFullHistory: false, messages: [] }
      ])
    )

    await waitFor(() => expect(result.current.state.state).toBe("success"))
    expect(loadConversation).toHaveBeenCalledOnce()
    expect(syncCaptureToMomentum).toHaveBeenCalledOnce()
  })
})
