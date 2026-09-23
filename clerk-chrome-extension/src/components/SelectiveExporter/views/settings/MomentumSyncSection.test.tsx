import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MomentumSyncSection } from "./MomentumSyncSection"

describe("MomentumSyncSection", () => {
  it("renders the current URL and token values", () => {
    render(
      <MomentumSyncSection
        momentumSyncUrl="http://127.0.0.1:4319"
        momentumSyncToken="secret-token"
        onMomentumSyncUrlChange={vi.fn()}
        onMomentumSyncTokenChange={vi.fn()}
      />
    )

    expect(screen.getByText("Local Sync (momentum)")).toBeInTheDocument()
    expect(screen.getByLabelText("Server URL")).toHaveValue("http://127.0.0.1:4319")
    expect(screen.getByLabelText("Token")).toHaveValue("secret-token")
  })

  it("calls the change handlers on edits", () => {
    const onUrl = vi.fn()
    const onToken = vi.fn()
    render(
      <MomentumSyncSection
        momentumSyncUrl=""
        momentumSyncToken=""
        onMomentumSyncUrlChange={onUrl}
        onMomentumSyncTokenChange={onToken}
      />
    )

    fireEvent.change(screen.getByLabelText("Server URL"), {
      target: { value: "http://localhost:5000" }
    })
    fireEvent.change(screen.getByLabelText("Token"), {
      target: { value: "abc" }
    })

    expect(onUrl).toHaveBeenCalledWith("http://localhost:5000")
    expect(onToken).toHaveBeenCalledWith("abc")
  })

  it.each(["", "   "])("warns that nothing will sync when the token is %j", (token) => {
    render(
      <MomentumSyncSection
        momentumSyncUrl="http://127.0.0.1:4319"
        momentumSyncToken={token}
        onMomentumSyncUrlChange={vi.fn()}
        onMomentumSyncTokenChange={vi.fn()}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No token set — nothing will sync"
    )
  })

  it("shows no warning once a token is set", () => {
    render(
      <MomentumSyncSection
        momentumSyncUrl="http://127.0.0.1:4319"
        momentumSyncToken="secret-token"
        onMomentumSyncUrlChange={vi.fn()}
        onMomentumSyncTokenChange={vi.fn()}
      />
    )

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
