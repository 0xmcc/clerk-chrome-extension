import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FloatingButton } from "./floating-button"

describe("FloatingButton", () => {
  it("renders the page capture launcher by default", () => {
    render(<FloatingButton />)

    expect(
      screen.getByRole("button", { name: "Capture this page for AI" })
    ).toBeInTheDocument()
  })

  it("opens the exporter when clicked", () => {
    const onOpenExporter = vi.fn()

    render(<FloatingButton onOpenExporter={onOpenExporter} />)

    fireEvent.click(
      screen.getByRole("button", { name: "Capture this page for AI" })
    )

    expect(onOpenExporter).toHaveBeenCalledTimes(1)
  })

  it("opens the options page on right click", () => {
    render(<FloatingButton />)

    fireEvent.contextMenu(
      screen.getByRole("button", { name: "Capture this page for AI" })
    )

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: "openOptionsPage"
    })
  })
})
