import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useSettingsStorage } from "./useSettingsStorage"

describe("useSettingsStorage conversation date preference", () => {
  it("defaults to Last message and persists the selected date mode", () => {
    const { result } = renderHook(() => useSettingsStorage())

    expect(result.current.conversationDateMode).toBe("last_message")

    act(() => result.current.setConversationDateMode("created"))

    expect(result.current.conversationDateMode).toBe("created")
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      conversationDateMode: "created"
    })
  })

  it("restores a valid saved date mode", async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation(
      (_keys, callback) => {
        callback?.({ conversationDateMode: "created" })
      }
    )

    const { result } = renderHook(() => useSettingsStorage())

    await waitFor(() =>
      expect(result.current.conversationDateMode).toBe("created")
    )
  })
})
