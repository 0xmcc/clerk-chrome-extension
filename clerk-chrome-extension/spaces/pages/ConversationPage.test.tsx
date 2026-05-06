import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ConversationThread } from "../data"

import { ConversationPage } from "./ConversationPage"

const conversation: ConversationThread = {
  id: "conv-1",
  source: "Claude",
  title: "Product spec",
  preview: "Preview",
  messagesCount: 2,
  timestamp: "Now",
  messages: [
    {
      id: "m1",
      role: "user",
      author: "You",
      time: "4:15 PM",
      paragraphs: ["Hello"]
    }
  ]
}

describe("ConversationPage", () => {
  it("shows Sign in and Connect GitHub actions in the Echo app header", () => {
    render(
      <ConversationPage
        conversation={conversation}
        onBack={vi.fn()}
        onOpenTransform={vi.fn()}
        isTransformOpen={false}
        isSignedIn={false}
        isGitHubConnected={false}
        availableRepos={[]}
        selectedRepoFullNames={[]}
        onToggleRepo={vi.fn()}
        onSignInClick={vi.fn()}
        onConnectGitHub={vi.fn()}
      />
    )

    expect(screen.getAllByRole("button", { name: "Sign in" })).not.toHaveLength(0)
    expect(
      screen.getAllByRole("button", { name: "Connect GitHub" })
    ).not.toHaveLength(0)
  })

  it("allows selecting multiple GitHub repos from the conversation repo menu", () => {
    const onToggleRepo = vi.fn()

    render(
      <ConversationPage
        conversation={conversation}
        onBack={vi.fn()}
        onOpenTransform={vi.fn()}
        isTransformOpen={false}
        isSignedIn
        isGitHubConnected
        availableRepos={[
          {
            name: "momentum-conversations",
            fullName: "octocat/momentum-conversations",
            url: "https://github.com/octocat/momentum-conversations"
          },
          {
            name: "second-brain",
            fullName: "octocat/second-brain",
            url: "https://github.com/octocat/second-brain"
          }
        ]}
        selectedRepoFullNames={["octocat/momentum-conversations"]}
        onToggleRepo={onToggleRepo}
        onSignInClick={vi.fn()}
        onConnectGitHub={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Choose repos" }))
    fireEvent.click(screen.getByLabelText("octocat/second-brain"))

    expect(screen.getByLabelText("octocat/momentum-conversations")).toBeChecked()
    expect(onToggleRepo).toHaveBeenCalledWith("octocat/second-brain")
  })
})
