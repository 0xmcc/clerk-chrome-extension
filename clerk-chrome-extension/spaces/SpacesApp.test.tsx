import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SpacesApp } from "./SpacesApp"

vi.mock("~utils/navigation", () => ({
  openSignInPage: vi.fn()
}))

vi.mock("./lib/echoApi", () => ({
  refreshEchoAuthStatus: vi.fn().mockResolvedValue(false),
  listEchoConversations: vi.fn().mockResolvedValue([]),
  getEchoConversationDetail: vi.fn(),
  listEchoGitHubRepos: vi.fn().mockResolvedValue([]),
  getEchoConversationRepos: vi.fn().mockResolvedValue([]),
  saveEchoConversationRepos: vi.fn().mockResolvedValue([]),
  getEchoGitHubStatus: vi.fn().mockResolvedValue({ connected: false }),
  connectEchoGitHub: vi.fn()
}))

describe("SpacesApp", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows sign-in and GitHub connect actions on the initial Echo app screen", async () => {
    render(<SpacesApp routerMode="memory" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
    })

    expect(
      screen.getByRole("button", { name: "Connect GitHub" })
    ).toBeInTheDocument()
  })
})
