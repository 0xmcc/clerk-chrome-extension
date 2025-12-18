import type { Conversation, Message, ScannerStats } from "./types"
import { now } from "./utils"

export const mergeMessagesPreferIncomingOrder = (incoming: Message[], existing: Message[]): Message[] => {
  const byId = new Map<string, Message>()
  for (const m of existing) byId.set(m.id, m)

  const merged: Message[] = []
  const seen = new Set<string>()

  for (const m of incoming) {
    const prev = byId.get(m.id)
    if (prev) {
      // Prefer the "more complete" text if one is longer
      const pick = (prev.text || "").length > (m.text || "").length ? prev : m
      merged.push({ ...pick, node: pick.node ?? m.node })
    } else {
      merged.push(m)
    }
    seen.add(m.id)
  }

  // Keep any messages we had that are missing from incoming (rare, but prevents loss)
  for (const m of existing) {
    if (!seen.has(m.id)) merged.push(m)
  }

  return merged
}

export const mergeConversation = (existing: Conversation | undefined, incoming: Conversation): Conversation => {
  if (!existing) return incoming

  const title = incoming.title || existing.title
  const createdAt = (() => {
    const a = existing.createdAt
    const b = incoming.createdAt
    if (a == null) return b
    if (b == null) return a
    return Math.min(a, b)
  })()
  const updatedAt = (() => {
    const a = existing.updatedAt
    const b = incoming.updatedAt
    if (a == null) return b
    if (b == null) return a
    return Math.max(a, b)
  })()

  const orgId = existing.orgId || incoming.orgId

  // Message upgrade rules:
  // - Detail endpoint (hasFullHistory=true) always wins for ordering/completeness.
  // - If neither is full, keep the longer one / merge union.
  let messages = existing.messages
  let hasFullHistory = existing.hasFullHistory

  if (incoming.messages.length > 0) {
    if (incoming.hasFullHistory) {
      messages = mergeMessagesPreferIncomingOrder(incoming.messages, existing.messages)
      hasFullHistory = true
    } else if (!existing.hasFullHistory) {
      if (incoming.messages.length >= existing.messages.length) {
        messages = mergeMessagesPreferIncomingOrder(incoming.messages, existing.messages)
      } else {
        messages = mergeMessagesPreferIncomingOrder(existing.messages, incoming.messages)
      }
      hasFullHistory = false
    }
  }

  return {
    ...existing,
    id: existing.id,
    platform: existing.platform,
    title,
    createdAt,
    updatedAt,
    orgId,
    messages,
    hasFullHistory,
    lastSeenAt: Math.max(existing.lastSeenAt, incoming.lastSeenAt)
  }
}

export const computeStats = (conversations: Conversation[]): ScannerStats => {
  let totalMessages = 0
  let withMessages = 0
  for (const c of conversations) {
    if (c.messages.length > 0) withMessages++
    totalMessages += c.messages.length
  }
  return {
    totalConversations: conversations.length,
    conversationsWithMessages: withMessages,
    totalMessages,
    lastCapturedAt: now()
  }
}
