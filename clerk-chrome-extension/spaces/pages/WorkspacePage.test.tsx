import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { conversationThreads } from "../data"

import { WorkspacePage } from "./WorkspacePage"

describe("WorkspacePage", () => {
  it("renders Sign in and Connect GitHub buttons in the app header", () => {
    render(
      <WorkspacePage
        conversations={conversationThreads}
        onOpenConversation={vi.fn()}
        onTransformConversation={vi.fn()}
        isSignedIn={false}
        isGitHubConnected={false}
        onSignInClick={vi.fn()}
        onConnectGitHub={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Connect GitHub" })
    ).toBeInTheDocument()
  })
})
