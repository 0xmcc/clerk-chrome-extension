import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { sendAgentMailTestEmail } from "../services/agentmail"
import { useSendToMyAITest } from "./useSendToMyAITest"

vi.mock("../services/agentmail", () => ({
  sendAgentMailTestEmail: vi.fn()
}))

const mockedSendAgentMailTestEmail = vi.mocked(sendAgentMailTestEmail)

const createDeferred = () => {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe("useSendToMyAITest", () => {
  beforeEach(() => {
    mockedSendAgentMailTestEmail.mockReset()
  })

  it("rejects empty test-email settings before making a request", async () => {
    const setStatusMessage = vi.fn()
    const { result } = renderHook(() => useSendToMyAITest({ setStatusMessage }))

    await expect(
      result.current.sendTestEmail({
        aiEmail: "",
        aiEmailFrom: "sender@example.com",
        aiEmailApiKey: "secret-key"
      })
    ).resolves.toBe(false)

    expect(mockedSendAgentMailTestEmail).not.toHaveBeenCalled()
    expect(setStatusMessage).toHaveBeenCalledWith(
      "Fill in all email settings first"
    )
  })

  it("rejects whitespace-only sender and API key values", async () => {
    const setStatusMessage = vi.fn()
    const { result } = renderHook(() => useSendToMyAITest({ setStatusMessage }))

    await expect(
      result.current.sendTestEmail({
        aiEmail: "recipient@example.com",
        aiEmailFrom: "   ",
        aiEmailApiKey: "   "
      })
    ).resolves.toBe(false)

    expect(mockedSendAgentMailTestEmail).not.toHaveBeenCalled()
    expect(setStatusMessage).toHaveBeenCalledWith(
      "Fill in all email settings first"
    )
  })

  it("calls the AgentMail test sender and reports success", async () => {
    const setStatusMessage = vi.fn()
    mockedSendAgentMailTestEmail.mockResolvedValue(undefined)
    const { result } = renderHook(() => useSendToMyAITest({ setStatusMessage }))

    await expect(
      result.current.sendTestEmail({
        aiEmail: "recipient@example.com",
        aiEmailFrom: "sender@example.com",
        aiEmailApiKey: "secret-key"
      })
    ).resolves.toBe(true)

    expect(mockedSendAgentMailTestEmail).toHaveBeenCalledWith({
      toAddress: "recipient@example.com",
      fromAddress: "sender@example.com",
      apiKey: "secret-key"
    })
    expect(setStatusMessage).toHaveBeenCalledWith("✅ Test email sent!")
    expect(result.current.isTesting).toBe(false)
  })

  it("exposes loading state while the request is in flight", async () => {
    const setStatusMessage = vi.fn()
    const deferred = createDeferred()
    mockedSendAgentMailTestEmail.mockReturnValue(deferred.promise)
    const { result } = renderHook(() => useSendToMyAITest({ setStatusMessage }))

    act(() => {
      void result.current.sendTestEmail({
        aiEmail: "recipient@example.com",
        aiEmailFrom: "sender@example.com",
        aiEmailApiKey: "secret-key"
      })
    })

    expect(result.current.isTesting).toBe(true)

    await act(async () => {
      deferred.resolve()
      await deferred.promise
    })

    await waitFor(() => {
      expect(result.current.isTesting).toBe(false)
    })
  })

  it("reports request failures with the thrown error message", async () => {
    const setStatusMessage = vi.fn()
    mockedSendAgentMailTestEmail.mockRejectedValue(
      new Error("Service unavailable")
    )
    const { result } = renderHook(() => useSendToMyAITest({ setStatusMessage }))

    await expect(
      result.current.sendTestEmail({
        aiEmail: "recipient@example.com",
        aiEmailFrom: "sender@example.com",
        aiEmailApiKey: "secret-key"
      })
    ).resolves.toBe(false)

    expect(setStatusMessage).toHaveBeenCalledWith("Service unavailable")
    expect(result.current.isTesting).toBe(false)
  })
})
