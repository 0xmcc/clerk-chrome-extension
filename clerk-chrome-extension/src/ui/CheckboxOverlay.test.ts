import { fireEvent, screen } from "@testing-library/dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import { checkboxOverlay } from "./CheckboxOverlay"

describe("CheckboxOverlay", () => {
  afterEach(() => {
    checkboxOverlay.removeAllCheckboxes()
    document.body.innerHTML = ""
  })

  it("renders an accessible toggleable checkbox for a page message", () => {
    const messageNode = document.createElement("div")
    messageNode.textContent = "Visible ChatGPT message"
    document.body.appendChild(messageNode)

    const onToggle = vi.fn()

    checkboxOverlay.injectCheckbox(
      messageNode,
      "conv_test::m_0000",
      true,
      onToggle,
      "Include message 1 from ChatGPT"
    )

    const checkbox = screen.getByRole("checkbox", {
      name: "Include message 1 from ChatGPT"
    })

    expect(checkbox).toBeChecked()

    fireEvent.click(checkbox)

    expect(onToggle).toHaveBeenCalledWith("conv_test::m_0000")
  })
})
