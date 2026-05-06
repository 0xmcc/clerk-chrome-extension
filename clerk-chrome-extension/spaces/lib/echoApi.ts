import { API_BASE_URL } from "~config/api"
import { getGitHubAuthUrl, getGitHubStatus, type GitHubStatus } from "~lib/github"
import {
  requestClerkAuthRefresh,
  requestClerkToken
} from "~utils/clerk"

import type {
  ConversationMessage,
  ConversationThread
} from "../data"

export type EchoGitHubRepo = {
  name: string
  fullName: string
  url: string
}

type ConversationListResponse = {
  conversations: Array<{
    id: string
    title: string
    previewSummary?: string | null
    previewExcerpt?: string | null
    messageCount: number
    createdAt: string
    updatedAt: string
    metadata?: Record<string, unknown>
  }>
}

type ConversationDetailResponse = {
  conversation: {
    id: string
    title: string
    messageCount: number
    updatedAt: string
    metadata?: Record<string, unknown>
  }
  messages: Array<{
    id: string
    role: "user" | "assistant" | "system" | "tool"
    textContent?: string
    content?: { text?: string }
    createdAt?: string
  }>
}

async function fetchEchoApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await requestClerkToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    }
  })
  const result = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      result?.error ||
        result?.message ||
        `Echo request failed with status ${response.status}`
    )
  }

  return result as T
}

function formatTimestamp(value?: string): string {
  if (!value) return "Recently"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Recently"
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  })
}

function inferSource(metadata?: Record<string, unknown>): ConversationThread["source"] {
  const source = String(metadata?.platform || metadata?.source || "")

  if (source.toLowerCase().includes("claude")) return "Claude"
  if (source.toLowerCase().includes("gemini")) return "Gemini"
  return "ChatGPT"
}

function toParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function mapConversationSummary(
  conversation: ConversationListResponse["conversations"][number]
): ConversationThread {
  return {
    id: conversation.id,
    source: inferSource(conversation.metadata),
    title: conversation.title,
    preview:
      conversation.previewSummary ||
      conversation.previewExcerpt ||
      "Saved conversation",
    messagesCount: conversation.messageCount,
    timestamp: formatTimestamp(conversation.updatedAt || conversation.createdAt),
    messages: []
  }
}

function mapConversationDetail(
  result: ConversationDetailResponse
): ConversationThread {
  return {
    id: result.conversation.id,
    source: inferSource(result.conversation.metadata),
    title: result.conversation.title,
    preview: "Saved conversation",
    messagesCount: result.conversation.messageCount,
    timestamp: formatTimestamp(result.conversation.updatedAt),
    messages: result.messages.map((message, index): ConversationMessage => {
      const text =
        message.textContent || message.content?.text || ""

      return {
        id: message.id,
        role: message.role === "assistant" ? "assistant" : "user",
        author: message.role === "assistant" ? "Assistant" : "You",
        time: formatTimestamp(message.createdAt),
        paragraphs: toParagraphs(text || `Message ${index + 1}`)
      }
    })
  }
}

export async function refreshEchoAuthStatus(): Promise<boolean> {
  try {
    const result = await requestClerkAuthRefresh()
    return result.hasSession
  } catch {
    return false
  }
}

export async function listEchoConversations(): Promise<ConversationThread[]> {
  const result = await fetchEchoApi<ConversationListResponse>("/v1/conversations")
  return result.conversations.map(mapConversationSummary)
}

export async function getEchoConversationDetail(
  conversationId: string
): Promise<ConversationThread> {
  const result = await fetchEchoApi<ConversationDetailResponse>(
    `/v1/conversations/${encodeURIComponent(conversationId)}`
  )
  return mapConversationDetail(result)
}

export async function listEchoGitHubRepos(): Promise<EchoGitHubRepo[]> {
  const result = await fetchEchoApi<{ repos: EchoGitHubRepo[] }>("/v1/github/repos")
  return result.repos
}

export async function getEchoConversationRepos(
  conversationId: string
): Promise<string[]> {
  const result = await fetchEchoApi<{ repos: EchoGitHubRepo[] }>(
    `/v1/conversations/${encodeURIComponent(conversationId)}/github-repos`
  )
  return result.repos.map((repo) => repo.fullName)
}

export async function saveEchoConversationRepos(
  conversationId: string,
  repoFullNames: string[]
): Promise<string[]> {
  const result = await fetchEchoApi<{ repos: EchoGitHubRepo[] }>(
    `/v1/conversations/${encodeURIComponent(conversationId)}/github-repos`,
    {
      method: "PUT",
      body: JSON.stringify({ repoFullNames })
    }
  )
  return result.repos.map((repo) => repo.fullName)
}

export async function getEchoGitHubStatus(): Promise<GitHubStatus> {
  try {
    return await getGitHubStatus()
  } catch {
    return { connected: false }
  }
}

export async function connectEchoGitHub(): Promise<void> {
  const url = await getGitHubAuthUrl()

  if (chrome?.tabs?.create) {
    chrome.tabs.create({ url })
    return
  }

  window.open(url, "_blank", "noopener,noreferrer")
}
