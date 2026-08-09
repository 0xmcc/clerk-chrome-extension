import type { Conversation } from "~hooks/useMessageScanner/types"

export type ConversationSyncState = "synced" | "stale" | "unsynced"

const latestSourceActivity = (
  conversation: Conversation
): number | undefined =>
  conversation.messages.reduce<number | undefined>(
    (latest, message) =>
      message.createdAt != null &&
      (latest == null || message.createdAt > latest)
        ? message.createdAt
        : latest,
    conversation.updatedAt
  )

/** Compare millisecond source timestamps with the archive's second-precision import time. */
export const getConversationSyncState = (
  conversation: Conversation,
  isArchived: boolean,
  syncedAtSeconds: number | undefined
): ConversationSyncState => {
  if (!isArchived) return "unsynced"

  const activityAt = latestSourceActivity(conversation)
  if (activityAt == null || syncedAtSeconds == null) return "synced"

  return Math.trunc(activityAt / 1000) > syncedAtSeconds ? "stale" : "synced"
}

export const conversationsNeedingSync = (
  conversations: Conversation[],
  syncedIds: string[],
  syncedAt: Record<string, number>
): Conversation[] => {
  const syncedSet = new Set(syncedIds)
  return conversations.filter(
    (conversation) =>
      getConversationSyncState(
        conversation,
        syncedSet.has(conversation.id),
        syncedAt[conversation.id]
      ) !== "synced"
  )
}
