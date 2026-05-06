import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  disconnectGitHub,
  getGitHubAuthUrl,
  getGitHubStatus
} from "~lib/github"

import { GitHubSection } from "./GitHubSection"

vi.mock("~lib/github", () => ({
  getGitHubAuthUrl: vi.fn(),
  getGitHubStatus: vi.fn(),
  disconnectGitHub: vi.fn()
}))

describe("GitHubSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("chrome", {
      ...chrome,
      tabs: {
        create: vi.fn()
      }
    })
  })

  it("shows the connect flow for users who have not connected GitHub", async () => {
    vi.mocked(getGitHubStatus).mockResolvedValue({ connected: false })
    vi.mocked(getGitHubAuthUrl).mockResolvedValue(
      "https://github.com/login/oauth/authorize?state=abc"
    )

    render(<GitHubSection />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Connect GitHub" })
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub" }))

    await waitFor(() => {
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: "https://github.com/login/oauth/authorize?state=abc"
      })
    })
  })

  it("shows the connected repo details and allows disconnecting", async () => {
    vi.mocked(getGitHubStatus)
      .mockResolvedValueOnce({
        connected: true,
        username: "octocat",
        repoName: "momentum-conversations",
        repoUrl: "https://github.com/octocat/momentum-conversations"
      })
      .mockResolvedValueOnce({ connected: false })
    vi.mocked(disconnectGitHub).mockResolvedValue()

    render(<GitHubSection />)

    expect(
      await screen.findByText("Connected as @octocat")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "momentum-conversations" })
    ).toHaveAttribute(
      "href",
      "https://github.com/octocat/momentum-conversations"
    )

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }))

    await waitFor(() => {
      expect(disconnectGitHub).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Connect GitHub" })
      ).toBeInTheDocument()
    })
  })
})
