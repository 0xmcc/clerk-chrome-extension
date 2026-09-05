import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { LinkedInContactsView } from "./LinkedInContactsView"

describe("LinkedInContactsView", () => {
  it("previews rich contacts in the standard drawer and downloads JSON", () => {
    const onDownload = vi.fn()

    render(
      <LinkedInContactsView
        contacts={[
          {
            name: "Nayama Rajlich",
            profileUrl: "https://www.linkedin.com/in/nayama-rajlich-20618323b/",
            headline: "Product Designer | UX + Visual Design",
            location: "San Francisco Bay Area",
            current: "Product Designer at Barcelino",
            connectionDegree: "3rd+"
          }
        ]}
        onDownload={onDownload}
      />
    )

    expect(screen.getByText(/Nayama Rajlich/)).toBeInTheDocument()
    expect(
      screen.getByText("Product Designer | UX + Visual Design")
    ).toBeInTheDocument()
    expect(screen.getByText("San Francisco Bay Area")).toBeInTheDocument()
    expect(
      screen.getByText("Current: Product Designer at Barcelino")
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Download JSON" }))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it("shows an inline empty state instead of a browser alert", () => {
    render(<LinkedInContactsView contacts={[]} onDownload={vi.fn()} />)

    expect(
      screen.getByText(/No LinkedIn contacts were found/i)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeDisabled()
  })
})
