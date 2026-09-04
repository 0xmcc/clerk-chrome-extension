import type { MessageImage } from "~lib/messageImages"

export interface Message {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  text: string
  authorName: string
  /** Original platform message time, normalized to unix milliseconds. */
  createdAt?: number
  /** Externally fetchable image attachments associated with this message. */
  images?: MessageImage[]
  // Kept for backward-compatibility with existing consumers/types.
  // In network mode this is a detached node (NOT scraped from DOM).
  node: Element
}

export type CapturedPlatform = "chatgpt" | "claude"

export interface Conversation {
  id: string
  platform: CapturedPlatform
  title?: string
  createdAt?: number
  updatedAt?: number

  // Full message history when available (detail endpoint)
  messages: Message[]
  hasFullHistory: boolean

  // Claude only (handy for rescan fetches)
  orgId?: string

  lastSeenAt: number
}

export interface ScannerStats {
  totalConversations: number
  conversationsWithMessages: number
  totalMessages: number
  lastCapturedAt?: number
}

export type InterceptorEvent = {
  source: string
  url: string
  method?: string
  status?: number
  ok?: boolean
  ts?: number
  data?: unknown
  headers?: Record<string, string>
}
