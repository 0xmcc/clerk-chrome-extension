import { useCallback, useState } from "react"

import type { Conversation } from "~hooks/useMessageScanner/types"

import { syncCaptureToMomentum } from "../services/momentum"
import type { CollectionBulkSyncState } from "../views/CollectionView"

interface UseBulkMomentumSyncConfig {
  url: string
  token: string
  onComplete: () => void
  loadConversation?: (
    conversation: Conversation
  ) => Promise<Conversation | undefined>
}

const idleState: CollectionBulkSyncState = {
  state: "idle",
  completed: 0,
  total: 0,
  failed: 0
}

const captureFor = (conversation: Conversation) => ({
  captureMode: "structured_conversation" as const,
  conversationKey: `${conversation.platform}:${conversation.id}`,
  title: conversation.title,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
  messages: conversation.messages,
  metadata: {
    sourceUrl:
      conversation.platform === "claude"
        ? `https://claude.ai/chat/${conversation.id}`
        : `https://chatgpt.com/c/${conversation.id}`,
    pageTitle: conversation.title || "Conversation",
    capturedAt: new Date(conversation.lastSeenAt).toISOString(),
    platform: conversation.platform === "claude" ? "Claude" : "ChatGPT",
    surface:
      conversation.platform === "claude"
        ? ("claude_chat" as const)
        : ("chatgpt_conversation" as const)
  }
})

/** Syncs saved transcripts one at a time, so progress remains truthful and a
 * transient failure can be retried without re-sending conversations that made it. */
export const useBulkMomentumSync = ({
  url,
  token,
  onComplete,
  loadConversation
}: UseBulkMomentumSyncConfig) => {
  const [state, setState] = useState<CollectionBulkSyncState>(idleState)
  const [failedConversations, setFailedConversations] = useState<
    Conversation[]
  >([])

  const run = useCallback(
    async (conversations: Conversation[]) => {
      setState({
        state: "syncing",
        completed: 0,
        total: conversations.length,
        failed: 0
      })
      const failed: Conversation[] = []
      let completed = 0

      for (const conversation of conversations) {
        try {
          const readyConversation =
            conversation.hasFullHistory && conversation.messages.length > 0
              ? conversation
              : await loadConversation?.(conversation)
          if (
            !readyConversation?.hasFullHistory ||
            readyConversation.messages.length === 0
          ) {
            throw new Error("Conversation transcript has not loaded")
          }
          const result = await syncCaptureToMomentum(
            captureFor(readyConversation),
            {
              url,
              token
            }
          )
          if (!result.success)
            throw new Error(result.error || "Momentum sync failed")
          completed += 1
        } catch {
          failed.push(conversation)
        }
        setState({
          state: "syncing",
          completed,
          total: conversations.length,
          failed: failed.length
        })
      }

      setFailedConversations(failed)
      setState({
        state: failed.length === 0 ? "success" : "error",
        completed,
        total: conversations.length,
        failed: failed.length
      })
      // Refresh even after a partial failure: successful conversations must not
      // remain labelled "Not synced" just because another item needs a retry.
      onComplete()
    },
    [loadConversation, onComplete, token, url]
  )

  const sync = useCallback(
    (conversations: Conversation[]) => {
      void run(conversations)
    },
    [run]
  )

  const retryFailed = useCallback(() => {
    if (failedConversations.length > 0) void run(failedConversations)
  }, [failedConversations, run])

  return { state, sync, retryFailed }
}
