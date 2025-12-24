import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { detectPlatform } from "~utils/platform"

import type { InterceptorEvent } from "./types"
import { isCapturedPlatform, getConversationKey, getActiveConversationIdFromUrl } from "./utils"
import { useConversationStore, useActiveMessages } from "./state"
import { createInterceptorEventHandler } from "./handlers"
import { createRescanHandler, INTERCEPTOR_SOURCE } from "./rescan"

// Instrumentation helper for message flow tracking
function logFlow(step: string, details?: Record<string, unknown>) {
  const timestamp = performance.now().toFixed(2)
  console.log(`[Scanner:FLOW] [${timestamp}ms] ${step}`, details ?? "")
}

// Rescan cooldown to prevent spam
const RESCAN_COOLDOWN_MS = 5000

export const useMessageScanner = () => {
  const platform = useMemo(() => detectPlatform(), [])
  const capturedPlatform = isCapturedPlatform(platform) ? platform : null
  const receivedMessageCount = useRef(0)
  const processedMessageCount = useRef(0)

  // Track rescan attempts with timestamp for cooldown-based retry
  const rescanAttemptsRef = useRef<Map<string, number>>(new Map())

  logFlow("HOOK_INIT", { platform, capturedPlatform })

  // Conversation store state (simplified - no start/stop)
  const {
    conversations,
    stats,
    storeRef,
    upsertMany,
    updateConversationListFromStore
  } = useConversationStore()

  // Active messages state
  const { messages, updateActiveMessagesFromStore, activeMessageCount } = useActiveMessages(capturedPlatform, storeRef)

  // Conversation key for URL change detection
  const [conversationKey, setConversationKey] = useState<string>(getConversationKey())

  // Compute stable activeConvoKey for guard checks
  const activeId = capturedPlatform ? getActiveConversationIdFromUrl(capturedPlatform) : null
  const activeConvoKey = capturedPlatform && activeId ? `${capturedPlatform}:${activeId}` : null

  // Split update functions - no callback nesting
  const updateAllDerivedState = useCallback(() => {
    updateConversationListFromStore()
    updateActiveMessagesFromStore()
  }, [updateConversationListFromStore, updateActiveMessagesFromStore])

  // Create interceptor handler ONCE with useMemo (not per-event)
  const interceptorHandler = useMemo(
    () => createInterceptorEventHandler({
      capturedPlatform,
      upsertMany,
      updateActiveMessagesFromStore
    }),
    [capturedPlatform, upsertMany, updateActiveMessagesFromStore]
  )

  const handleInterceptorEvent = useCallback(
    (evt: InterceptorEvent) => {
      interceptorHandler(evt)
    },
    [interceptorHandler]
  )

  // Create rescan handler
  const rescan = useCallback(async () => {
    const handler = createRescanHandler({
      capturedPlatform,
      updateAllDerivedState,
      handleInterceptorEvent,
      storeRef
    })
    await handler()
  }, [capturedPlatform, updateAllDerivedState, handleInterceptorEvent, storeRef])

  // Effect: Message listener - always active
  useEffect(() => {
    logFlow("LISTENER_SETUP_START", { handlerDeps: "handleInterceptorEvent" })

    const listener = (event: MessageEvent) => {
      // Security: only accept messages from same window
      if (event.source !== window) return

      const data = event.data
      if (!data || data.source !== INTERCEPTOR_SOURCE) return

      receivedMessageCount.current++
      logFlow("MESSAGE_RECEIVED", {
        seq: data._seq,
        url: data.url,
        method: data.method,
        status: data.status,
        receivedCount: receivedMessageCount.current
      })

      logFlow("MESSAGE_PROCESS_START", {
        seq: data._seq,
        url: data.url
      })

      handleInterceptorEvent({
        source: INTERCEPTOR_SOURCE,
        url: data.url,
        method: data.method,
        status: data.status,
        ok: data.ok,
        ts: data.ts,
        data: data.data
      })

      processedMessageCount.current++
      logFlow("MESSAGE_PROCESS_COMPLETE", {
        seq: data._seq,
        url: data.url,
        processedCount: processedMessageCount.current
      })
    }

    window.addEventListener("message", listener)
    logFlow("LISTENER_REGISTERED")

    // Signal to interceptor that listener is ready (drains queued messages)
    logFlow("READY_SIGNAL_SENDING")
    window.postMessage("__echo_listener_ready__", "*")
    logFlow("READY_SIGNAL_SENT")

    // Double-tick to handle "detail arrives after first tick" case
    setTimeout(() => {
      logFlow("INITIAL_UPDATE_AFTER_READY_0")
      updateAllDerivedState()
    }, 0)
    setTimeout(() => {
      logFlow("INITIAL_UPDATE_AFTER_READY_100")
      updateAllDerivedState()
    }, 100)

    return () => {
      logFlow("LISTENER_CLEANUP")
      window.removeEventListener("message", listener)
    }
  }, [handleInterceptorEvent, updateAllDerivedState])

  // Effect: URL change detection - always update state, throttled rescan
  useEffect(() => {
    console.log("[useMessageScanner] Setting up URL change detection interval")
    const interval = window.setInterval(() => {
      const nextKey = getConversationKey()
      if (nextKey !== conversationKey) {
        console.log("[useMessageScanner] URL changed:", {
          from: conversationKey,
          to: nextKey,
          storeSize: storeRef.current.size,
          storeKeys: Array.from(storeRef.current.keys())
        })
        setConversationKey(nextKey)

        // Always sync state on URL change
        console.log("[useMessageScanner] URL change: Syncing state")
        updateAllDerivedState()

        // Compute activeConvoKey for this URL
        const nextActiveId = capturedPlatform ? getActiveConversationIdFromUrl(capturedPlatform) : null
        const nextActiveConvoKey = capturedPlatform && nextActiveId
          ? `${capturedPlatform}:${nextActiveId}`
          : null

        // Throttled rescan with cooldown-based retry (not permanent lockout)
        if (nextActiveConvoKey) {
          const lastAttempt = rescanAttemptsRef.current.get(nextActiveConvoKey) ?? 0
          const now = Date.now()
          const convo = storeRef.current.get(nextActiveConvoKey)

          console.log("[useMessageScanner] URL change: Conversation check", {
            capturedPlatform,
            nextActiveId,
            nextActiveConvoKey,
            hasConversation: !!convo,
            messageCount: convo?.messages.length ?? 0,
            timeSinceLastAttempt: now - lastAttempt
          })

          // Only rescan if: missing/empty AND (never tried OR cooldown expired)
          if ((!convo || !convo.messages.length) && (now - lastAttempt > RESCAN_COOLDOWN_MS)) {
            console.log("[useMessageScanner] URL change: Conversation missing/incomplete, triggering rescan in 300ms")
            rescanAttemptsRef.current.set(nextActiveConvoKey, now)
            setTimeout(() => rescan(), 300)
          }
        }
      }
    }, 400)

    return () => {
      console.log("[useMessageScanner] Cleaning up URL change detection interval")
      window.clearInterval(interval)
    }
  }, [conversationKey, updateAllDerivedState, capturedPlatform, storeRef, rescan])

  return {
    messages,
    rescan,
    conversationKey,
    conversations,
    stats,
    activeConvoKey,
    activeMessageCount
  }
}
