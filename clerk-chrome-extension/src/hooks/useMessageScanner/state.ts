import { useCallback, useState } from "react"
import type { Conversation, Message, ScannerStats, CapturedPlatform } from "./types"
import { mergeConversation, computeStats } from "./mergers"
import { getActiveConversationIdFromUrl } from "./utils"
import { storeRef, isScanningRef } from "./store"

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
    if (incoming.length === 0) return

    console.log("[useMessageScanner] upsertMany: processing", incoming.length, "conversation(s)")

    const store = storeRef.current
    for (const c of incoming) {
      const key = `${c.platform}:${c.id}`
      const existing = store.get(key)
      const merged = mergeConversation(existing, c)
      store.set(key, merged)

      console.log("[useMessageScanner] Upserted conversation", {
        key,
        platform: c.platform,
        id: c.id,
        title: c.title,
        messageCount: merged.messages.length,
        hasFullHistory: merged.hasFullHistory,
        wasNew: !existing
      })
    }

    // Only force React updates when scanning is enabled (reduces rerenders while still capturing in store)
    if (!isScanningRef.current) {
      console.log("[useMessageScanner] upsertMany: skipping React update (not scanning)")
      return
    }

    const next = Array.from(store.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    setConversations(next)
    const newStats = computeStats(next)
    setStats(newStats)
    console.log("[useMessageScanner] upsertMany: updated state", {
      totalConversations: newStats.totalConversations,
      conversationsWithMessages: newStats.conversationsWithMessages,
      totalMessages: newStats.totalMessages
    })
  }, [])

  const flushAllState = useCallback((syncActiveMessages: () => void) => {
    const next = Array.from(storeRef.current.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    const stats = computeStats(next)
    console.log("[useMessageScanner] flushAllState", {
      conversationCount: next.length,
      totalMessages: stats.totalMessages,
      conversationsWithMessages: stats.conversationsWithMessages
    })
    setConversations(next)
    setStats(stats)
    syncActiveMessages()
  }, [])

  const startScanning = useCallback((flushAllStateFn: () => void) => {
    console.log("[useMessageScanner] startScanning: enabling scan mode")
    isScanningRef.current = true
    setIsScanning(true)
    flushAllStateFn()
  }, [])

  const stopScanning = useCallback(() => {
    console.log("[useMessageScanner] stopScanning: disabling scan mode")
    isScanningRef.current = false
    setIsScanning(false)
  }, [])

  return {
    conversations,
    stats,
    isScanning,
    storeRef,
    isScanningRef,
    upsertMany,
    flushAllState,
    startScanning,
    stopScanning
  }
}

export const useActiveMessages = (capturedPlatform: CapturedPlatform | null, storeRef: React.MutableRefObject<Map<string, Conversation>>) => {
  const [messages, setMessages] = useState<Message[]>([])

  const syncActiveMessages = useCallback(() => {
    if (!capturedPlatform) {
      console.log("[useMessageScanner] syncActiveMessages: no captured platform, clearing messages")
      setMessages([])
      return
    }

    const activeId = getActiveConversationIdFromUrl(capturedPlatform)
    console.log("[useMessageScanner] syncActiveMessages: DEBUG", {
      capturedPlatform,
      activeId,
      currentPath: window.location.pathname,
      storeSize: storeRef.current.size,
      storeKeys: Array.from(storeRef.current.keys())
    })

    if (!activeId) {
      console.log("[useMessageScanner] syncActiveMessages: no active conversation ID, clearing messages")
      setMessages([])
      return
    }

    const key = `${capturedPlatform}:${activeId}`
    const convo = storeRef.current.get(key)
    const messageCount = convo?.messages.length ?? 0
    console.log("[useMessageScanner] syncActiveMessages", {
      platform: capturedPlatform,
      activeId,
      key,
      messageCount,
      hasConversation: !!convo,
      conversationTitle: convo?.title,
      conversationMessages: convo?.messages?.length ?? 0
    })
    setMessages(convo?.messages ?? [])
  }, [capturedPlatform, storeRef])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    syncActiveMessages,
    clearMessages
  }
}
