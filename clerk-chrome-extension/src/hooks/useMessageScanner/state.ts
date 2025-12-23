import { useCallback, useState } from "react"
import type { Conversation, Message, ScannerStats, CapturedPlatform } from "./types"
import { mergeConversation, computeStats } from "./mergers"
import { getActiveConversationIdFromUrl } from "./utils"
import { storeRef, isScanningRef } from "./store"

// Instrumentation helper for state flow tracking
function logFlow(step: string, details?: Record<string, unknown>) {
  const timestamp = performance.now().toFixed(2)
  console.log(`[State:FLOW] [${timestamp}ms] ${step}`, details ?? "")
}

export interface ConversationStoreState {
  conversations: Conversation[]
  stats: ScannerStats
  isScanning: boolean
}

export const useConversationStore = () => {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [stats, setStats] = useState<ScannerStats>({
    totalConversations: 0,
    conversationsWithMessages: 0,
    totalMessages: 0,
    lastCapturedAt: undefined
  })

  const [isScanning, setIsScanning] = useState<boolean>(isScanningRef.current)

  const upsertMany = useCallback((incoming: Conversation[]) => {
    logFlow("UPSERT_MANY_ENTRY", { incomingCount: incoming.length })

    if (incoming.length === 0) {
      logFlow("UPSERT_MANY_EMPTY", {})
      return
    }

    const store = storeRef.current
    const storeSizeBefore = store.size

    for (const c of incoming) {
      const key = `${c.platform}:${c.id}`
      const existing = store.get(key)
      const merged = mergeConversation(existing, c)
      store.set(key, merged)

      logFlow("UPSERT_CONVERSATION", {
        key,
        platform: c.platform,
        id: c.id,
        title: c.title?.substring(0, 30),
        incomingMsgs: c.messages.length,
        existingMsgs: existing?.messages.length ?? 0,
        mergedMsgs: merged.messages.length,
        wasNew: !existing
      })
    }

    logFlow("UPSERT_STORE_UPDATED", {
      storeSizeBefore,
      storeSizeAfter: store.size
    })

    const next = Array.from(store.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    setConversations(next)
    const newStats = computeStats(next)
    setStats(newStats)

    logFlow("UPSERT_STATE_SET", {
      totalConversations: newStats.totalConversations,
      conversationsWithMessages: newStats.conversationsWithMessages,
      totalMessages: newStats.totalMessages
    })
  }, [])

  const updateConversationListFromStore = useCallback((updateActiveMessagesFromStore: () => void) => {
    logFlow("UPDATE_CONVERSATION_LIST_ENTRY", { storeSize: storeRef.current.size })

    const next = Array.from(storeRef.current.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    const stats = computeStats(next)

    logFlow("UPDATE_CONVERSATION_LIST_COMPUTED", {
      conversationCount: next.length,
      totalMessages: stats.totalMessages,
      conversationsWithMessages: stats.conversationsWithMessages
    })

    setConversations(next)
    setStats(stats)

    logFlow("UPDATE_ACTIVE_MESSAGES_CALLING")
    updateActiveMessagesFromStore()
    logFlow("UPDATE_CONVERSATION_LIST_COMPLETE")
  }, [])

  const startScanning = useCallback((updateAllDerivedStateFn: () => void) => {
    logFlow("START_SCANNING", { previousState: isScanningRef.current })
    isScanningRef.current = true
    setIsScanning(true)
    updateAllDerivedStateFn()
    logFlow("START_SCANNING_COMPLETE")
  }, [])

  const stopScanning = useCallback(() => {
    logFlow("STOP_SCANNING", { previousState: isScanningRef.current })
    isScanningRef.current = false
    setIsScanning(false)
    logFlow("STOP_SCANNING_COMPLETE")
  }, [])

  return {
    conversations,
    stats,
    isScanning,
    storeRef,
    isScanningRef,
    upsertMany,
    updateConversationListFromStore,
    startScanning,
    stopScanning
  }
}

export const useActiveMessages = (capturedPlatform: CapturedPlatform | null, storeRef: React.MutableRefObject<Map<string, Conversation>>) => {
  const [messages, setMessages] = useState<Message[]>([])

  const updateActiveMessagesFromStore = useCallback(() => {
    logFlow("UPDATE_ACTIVE_MESSAGES_ENTRY", { capturedPlatform, storeSize: storeRef.current.size })

    if (!capturedPlatform) {
      logFlow("UPDATE_ACTIVE_NO_PLATFORM", {})
      setMessages([])
      return
    }

    const activeId = getActiveConversationIdFromUrl(capturedPlatform)
    logFlow("UPDATE_ACTIVE_ID_RESOLVED", {
      capturedPlatform,
      activeId,
      currentPath: window.location.pathname,
      storeSize: storeRef.current.size,
      storeKeys: Array.from(storeRef.current.keys())
    })

    if (!activeId) {
      logFlow("UPDATE_ACTIVE_NO_ID", {})
      setMessages([])
      return
    }

    const key = `${capturedPlatform}:${activeId}`
    const convo = storeRef.current.get(key)
    const messageCount = convo?.messages.length ?? 0

    logFlow("UPDATE_ACTIVE_CONVERSATION_LOOKUP", {
      key,
      hasConversation: !!convo,
      messageCount,
      title: convo?.title?.substring(0, 30)
    })

    setMessages(convo?.messages ?? [])

    logFlow("UPDATE_ACTIVE_MESSAGES_SET", {
      messageCount: convo?.messages?.length ?? 0
    })
  }, [capturedPlatform, storeRef])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    updateActiveMessagesFromStore,
    clearMessages
  }
}
