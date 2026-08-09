import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Header } from "./Header"

const baseProps = {
  title: "Distribution Strategy Insights",
  summaryText: "5 messages detected",
  isSignedOut: false,
  onSignInClick: vi.fn(),
  onIndexClick: vi.fn(),
  onSettingsClick: vi.fn(),
  onClose: vi.fn()
}

describe("Header", () => {
  it("labels the collection entry point so it reads as the way into all conversations", () => {
    render(<Header {...baseProps} />)

    expect(
      screen.getByRole("button", { name: /all conversations/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /message index/i })
    ).not.toBeInTheDocument()
  })

  it("opens the collection when that button is clicked", () => {
    const onIndexClick = vi.fn()
    render(<Header {...baseProps} onIndexClick={onIndexClick} />)

    fireEvent.click(screen.getByRole("button", { name: /all conversations/i }))

    expect(onIndexClick).toHaveBeenCalled()
  })
})
