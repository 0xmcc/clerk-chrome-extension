import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ActionArea } from "./ActionArea"

const baseProps = {
  view: "export" as const,
  selectedCount: 4,
  canSave: true,
  exportState: "idle" as const,
  statusMessage: "",
  analysisInput: "",
  isSignedOut: false,
  awaitingSignIn: false,
  onAnalysisInputChange: vi.fn(),
  onAnalysisSend: vi.fn(),
  onBackToExport: vi.fn(),
  onSave: vi.fn(),
  onSignInClick: vi.fn(),
  onConfirmSignedIn: vi.fn()
}

describe("ActionArea GitHub repo chooser", () => {
  it("renders an Echo-style repo chooser summary for connected GitHub accounts", () => {
    render(
      <ActionArea
        {...baseProps}
        githubConnected
        githubRepos={[
          {
            name: "momentum-conversations",
            fullName: "octocat/momentum-conversations",
            url: "https://github.com/octocat/momentum-conversations"
          }
        ]}
        selectedGitHubRepoFullNames={["octocat/momentum-conversations"]}
        onGitHubRepoMenuToggle={vi.fn()}
      />
    )

    expect(screen.getByText("GitHub repos")).toBeInTheDocument()
    expect(
      screen.getByText("1 repo selected")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Choose repos" })
    ).toBeInTheDocument()
  })

  it("lets the user toggle repo selections from the chooser menu", () => {
    const onGitHubRepoToggle = vi.fn()

    render(
      <ActionArea
        {...baseProps}
        githubConnected
        githubRepoMenuOpen
        githubRepos={[
          {
            name: "momentum-vault",
            fullName: "octocat/momentum-vault",
            url: "https://github.com/octocat/momentum-vault"
          },
          {
            name: "momentum-conversations",
            fullName: "octocat/momentum-conversations",
            url: "https://github.com/octocat/momentum-conversations"
          },
          {
            name: "clerk-chrome-extension",
            fullName: "octocat/clerk-chrome-extension",
            url: "https://github.com/octocat/clerk-chrome-extension"
          },
          {
            name: "second-brain",
            fullName: "octocat/second-brain",
            url: "https://github.com/octocat/second-brain"
          }
        ]}
        selectedGitHubRepoFullNames={["octocat/momentum-conversations"]}
        onGitHubRepoMenuToggle={vi.fn()}
        onGitHubRepoToggle={onGitHubRepoToggle}
      />
    )

    expect(screen.getByPlaceholderText("Search repos")).toBeInTheDocument()
    expect(screen.getByTestId("github-repo-list")).toHaveStyle({
      maxHeight: "220px",
      overflowY: "auto"
    })

    expect(screen.getByLabelText("octocat/momentum-conversations")).toBeChecked()

    const vaultLabel = screen
      .getByLabelText("octocat/momentum-vault")
      .closest("label")
    const selectedLabel = screen
      .getByLabelText("octocat/momentum-conversations")
      .closest("label")
    const nextUnselectedLabel = screen
      .getByLabelText("octocat/clerk-chrome-extension")
      .closest("label")

    expect(vaultLabel).not.toBeNull()
    expect(selectedLabel).not.toBeNull()
    expect(nextUnselectedLabel).not.toBeNull()
    expect(
      vaultLabel!.compareDocumentPosition(selectedLabel!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      selectedLabel!.compareDocumentPosition(nextUnselectedLabel!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    fireEvent.click(screen.getByLabelText("octocat/second-brain"))

    expect(onGitHubRepoToggle).toHaveBeenCalledWith("octocat/second-brain")

    fireEvent.change(screen.getByPlaceholderText("Search repos"), {
      target: { value: "clerk" }
    })

    expect(
      screen.getByLabelText("octocat/clerk-chrome-extension")
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText("octocat/second-brain")
    ).not.toBeInTheDocument()
  })
})
