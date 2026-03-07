import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AccountSection } from "./AccountSection"

const createDeferred = () => {
  let resolve!: (value: { success: boolean; error?: string }) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<{ success: boolean; error?: string }>(
    (res, rej) => {
      resolve = res
      reject = rej
    }
  )

  return { promise, resolve, reject }
}

describe("AccountSection", () => {
  const setStatusMessage = vi.fn()
  const onSignInClick = vi.fn()

  beforeEach(() => {
    setStatusMessage.mockReset()
    onSignInClick.mockReset()
  })

  it("renders the sign-in action when the user is signed out", () => {
    render(
      <AccountSection
        onLogout={vi.fn()}
        setStatusMessage={setStatusMessage}
        isSignedOut
        onSignInClick={onSignInClick}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    expect(onSignInClick).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole("button", { name: "Log out" })
    ).not.toBeInTheDocument()
  })

  it("renders the logout action when the user is signed in", () => {
    render(
      <AccountSection
        onLogout={vi.fn()}
        setStatusMessage={setStatusMessage}
        isSignedOut={false}
        onSignInClick={onSignInClick}
      />
    )

    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Sign in" })
    ).not.toBeInTheDocument()
  })

  it("shows a pending state while logout is in flight", async () => {
    const deferred = createDeferred()
    const onLogout = vi.fn().mockReturnValue(deferred.promise)

    render(
      <AccountSection
        onLogout={onLogout}
        setStatusMessage={setStatusMessage}
        isSignedOut={false}
        onSignInClick={onSignInClick}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Log out" }))

    expect(
      screen.getByRole("button", { name: "Signing out..." })
    ).toBeDisabled()

    deferred.resolve({ success: true })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled()
    })
  })

  it("reports successful logout", async () => {
    const onLogout = vi.fn().mockResolvedValue({ success: true })

    render(
      <AccountSection
        onLogout={onLogout}
        setStatusMessage={setStatusMessage}
        isSignedOut={false}
        onSignInClick={onSignInClick}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Log out" }))

    await waitFor(() => {
      expect(setStatusMessage).toHaveBeenCalledWith("Signed out.")
    })
  })

  it("reports logout failures from the result payload", async () => {
    const onLogout = vi.fn().mockResolvedValue({
      success: false,
      error: "Network timeout"
    })

    render(
      <AccountSection
        onLogout={onLogout}
        setStatusMessage={setStatusMessage}
        isSignedOut={false}
        onSignInClick={onSignInClick}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Log out" }))

    await waitFor(() => {
      expect(setStatusMessage).toHaveBeenCalledWith("Network timeout")
    })
  })

  it("reports thrown logout errors", async () => {
    const onLogout = vi.fn().mockRejectedValue(new Error("Unexpected failure"))

    render(
      <AccountSection
        onLogout={onLogout}
        setStatusMessage={setStatusMessage}
        isSignedOut={false}
        onSignInClick={onSignInClick}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Log out" }))

    await waitFor(() => {
      expect(setStatusMessage).toHaveBeenCalledWith("Unexpected failure")
    })
  })
})
