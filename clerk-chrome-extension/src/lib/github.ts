import { API_BASE_URL } from "~config/api"
import { requestClerkToken } from "~utils/clerk"

export type GitHubStatus = {
  connected: boolean
  username?: string
  repoUrl?: string
  repoName?: string
}

export type GitHubRepo = {
  name: string
  fullName: string
  url: string
}

async function fetchGitHubEndpoint<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await requestClerkToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    }
  })
  const result = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      result?.error ||
        result?.message ||
        `GitHub request failed with status ${response.status}`
    )
  }

  return result as T
}

export async function getGitHubAuthUrl(): Promise<string> {
  const result = await fetchGitHubEndpoint<{ url: string }>("/v1/github/auth-url")
  return result.url
}

export async function getGitHubStatus(): Promise<GitHubStatus> {
  return fetchGitHubEndpoint<GitHubStatus>("/v1/github/status")
}

export async function listGitHubRepos(): Promise<GitHubRepo[]> {
  const result = await fetchGitHubEndpoint<{ repos: GitHubRepo[] }>(
    "/v1/github/repos"
  )
  return result.repos
}

export async function getConversationGitHubRepos(
  conversationId: string
): Promise<string[]> {
  const result = await fetchGitHubEndpoint<{ repos: GitHubRepo[] }>(
    `/v1/conversations/${encodeURIComponent(conversationId)}/github-repos`
  )
  return result.repos.map((repo) => repo.fullName)
}

export async function saveConversationGitHubRepos(
  conversationId: string,
  repoFullNames: string[]
): Promise<string[]> {
  const result = await fetchGitHubEndpoint<{ repos: GitHubRepo[] }>(
    `/v1/conversations/${encodeURIComponent(conversationId)}/github-repos`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ repoFullNames })
    }
  )
  return result.repos.map((repo) => repo.fullName)
}

export async function disconnectGitHub(): Promise<void> {
  await fetchGitHubEndpoint("/v1/github/disconnect", {
    method: "DELETE"
  })
}
