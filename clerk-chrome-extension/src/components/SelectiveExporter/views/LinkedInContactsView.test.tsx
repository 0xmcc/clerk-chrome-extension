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
    expect(onDownload).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Nayama Rajlich" })
    ])
  })

  it("switches between contact cards and JSON and exports only checked people", () => {
    const onDownload = vi.fn()
    const contacts = [
      {
        name: "Nayama Rajlich",
        profileUrl: "https://www.linkedin.com/in/nayama-rajlich/",
        headline: "Product Designer",
        location: "San Francisco Bay Area"
      },
      {
        name: "Mitra Martin",
        profileUrl: "https://www.linkedin.com/in/mitra-martin/",
        headline: "Director of Womenswear",
        location: "San Rafael, California"
      }
    ]

    render(<LinkedInContactsView contacts={contacts} onDownload={onDownload} />)

    const nayamaToggle = screen.getByRole("checkbox", {
      name: "Include Nayama Rajlich"
    })
    const mitraToggle = screen.getByRole("checkbox", {
      name: "Include Mitra Martin"
    })
    expect(nayamaToggle).toBeChecked()
    expect(mitraToggle).toBeChecked()

    fireEvent.click(nayamaToggle)
    expect(nayamaToggle).not.toBeChecked()
    expect(screen.getByText("1 of 2 selected")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "JSON" }))
    const jsonPreview = screen.getByTestId("linkedin-contacts-json")
    expect(jsonPreview).toHaveTextContent("Mitra Martin")
    expect(jsonPreview).not.toHaveTextContent("Nayama Rajlich")

    fireEvent.click(screen.getByRole("button", { name: "Download JSON" }))
    expect(onDownload).toHaveBeenCalledWith([contacts[1]])

    fireEvent.click(screen.getByRole("button", { name: "Contacts" }))
    expect(
      screen.getByRole("checkbox", { name: "Include Mitra Martin" })
    ).toBeChecked()
  })

  it("preserves manual selection when the drawer parent re-renders", () => {
    const contact = {
      name: "Nayama Rajlich",
      profileUrl: "https://www.linkedin.com/in/nayama-rajlich/"
    }
    const { rerender } = render(
      <LinkedInContactsView contacts={[contact]} onDownload={vi.fn()} />
    )
    const checkbox = screen.getByRole("checkbox", {
      name: "Include Nayama Rajlich"
    })

    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()

    rerender(
      <LinkedInContactsView contacts={[{ ...contact }]} onDownload={vi.fn()} />
    )

    expect(
      screen.getByRole("checkbox", { name: "Include Nayama Rajlich" })
    ).not.toBeChecked()
  })

  it("shows an inline empty state instead of a browser alert", () => {
    render(<LinkedInContactsView contacts={[]} onDownload={vi.fn()} />)

    expect(
      screen.getByText(/No LinkedIn contacts were found/i)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeDisabled()
  })
})
