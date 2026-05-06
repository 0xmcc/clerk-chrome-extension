import { beforeEach, describe, expect, it, vi } from "vitest"

import { requestClerkToken } from "~utils/clerk"

import {
  disconnectGitHub,
  getConversationGitHubRepos,
  getGitHubAuthUrl,
  getGitHubStatus,
  listGitHubRepos,
  saveConversationGitHubRepos
} from "./github"

vi.mock("~utils/clerk", () => ({
  requestClerkToken: vi.fn()
}))

describe("github helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
    vi.mocked(requestClerkToken).mockResolvedValue("clerk-token")
  })

  it("fetches the GitHub auth URL with a Clerk bearer token", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        url: "https://github.com/login/oauth/authorize?state=abc"
      })
    } as unknown as Response)

    await expect(getGitHubAuthUrl()).resolves.toBe(
      "https://github.com/login/oauth/authorize?state=abc"
    )

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/github/auth-url"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer clerk-token"
        })
      })
    )
  })

  it("returns the current GitHub connection status", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        connected: true,
        username: "octocat",
        repoUrl: "https://github.com/octocat/momentum-conversations",
        repoName: "momentum-conversations"
      })
    } as unknown as Response)

    await expect(getGitHubStatus()).resolves.toEqual({
      connected: true,
      username: "octocat",
      repoUrl: "https://github.com/octocat/momentum-conversations",
      repoName: "momentum-conversations"
    })
  })

  it("lists available GitHub repos for the connected user", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        repos: [
          {
            name: "momentum-conversations",
            fullName: "octocat/momentum-conversations",
            url: "https://github.com/octocat/momentum-conversations"
          }
        ]
      })
    } as unknown as Response)

    await expect(listGitHubRepos()).resolves.toEqual([
      {
        name: "momentum-conversations",
        fullName: "octocat/momentum-conversations",
        url: "https://github.com/octocat/momentum-conversations"
      }
    ])
  })

  it("fetches the selected repos for a saved conversation", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        repos: [
          {
            name: "momentum-conversations",
            fullName: "octocat/momentum-conversations",
            url: "https://github.com/octocat/momentum-conversations"
          }
        ]
      })
    } as unknown as Response)

    await expect(
      getConversationGitHubRepos("db-conversation-1")
    ).resolves.toEqual(["octocat/momentum-conversations"])
  })

  it("saves multiple selected repos for a conversation", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        repos: [
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
        ]
      })
    } as unknown as Response)

    await expect(
      saveConversationGitHubRepos("db-conversation-1", [
        "octocat/momentum-conversations",
        "octocat/second-brain"
      ])
    ).resolves.toEqual([
      "octocat/momentum-conversations",
      "octocat/second-brain"
    ])

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/conversations/db-conversation-1/github-repos"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer clerk-token",
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          repoFullNames: [
            "octocat/momentum-conversations",
            "octocat/second-brain"
          ]
        })
      })
    )
  })

  it("throws a useful error when disconnect fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({
        error: "Disconnect failed"
      })
    } as unknown as Response)

    await expect(disconnectGitHub()).rejects.toThrow("Disconnect failed")
  })
})
