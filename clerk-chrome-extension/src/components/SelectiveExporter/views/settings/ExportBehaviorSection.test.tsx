import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ExportBehaviorSection } from "./ExportBehaviorSection"

describe("ExportBehaviorSection", () => {
  it("renders the export behavior description and unchecked state", () => {
    render(
      <ExportBehaviorSection
        includeHidden={false}
        onIncludeHiddenChange={vi.fn()}
      />
    )

    expect(screen.getByText("Export Behavior")).toBeInTheDocument()
    expect(
      screen.getByText("When active, exports include background AI mechanics.")
    ).toBeInTheDocument()
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  it("reflects the checked state from props", () => {
    render(
      <ExportBehaviorSection includeHidden onIncludeHiddenChange={vi.fn()} />
    )

    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  it("forwards checkbox changes to the parent handler", () => {
    const onIncludeHiddenChange = vi.fn()

    render(
      <ExportBehaviorSection
        includeHidden={false}
        onIncludeHiddenChange={onIncludeHiddenChange}
      />
    )

    fireEvent.click(screen.getByRole("checkbox"))

    expect(onIncludeHiddenChange).toHaveBeenCalledWith(true)
  })
})
