import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { detectPlatform } from "~utils/platform"

import type { UseMessageScannerProps, InterceptorEvent } from "./types"
import { isCapturedPlatform, getConversationKey, getActiveConversationIdFromUrl } from "./utils"
import { useConversationStore, useActiveMessages } from "./state"
import { createInterceptorEventHandler } from "./handlers"
import { createRescanHandler, INTERCEPTOR_SOURCE } from "./rescan"

// Instrumentation helper for message flow tracking
function logFlow(step: string, details?: Record<string, unknown>) {
  const timestamp = performance.now().toFixed(2)
  console.log(`[Scanner:FLOW] [${timestamp}ms] ${step}`, details ?? "")
}

export const useMessageScanner = ({ isExporterOpen }: UseMessageScannerProps) => {
  const platform = useMemo(() => detectPlatform(), [])
  const capturedPlatform = isCapturedPlatform(platform) ? platform : null
  const receivedMessageCount = useRef(0)
  const processedMessageCount = useRef(0)

  logFlow("HOOK_INIT", { platform, capturedPlatform, isExporterOpen })

  // Conversation store state
  const {
    conversations,
    stats,
    isScanning,
    storeRef,
    isScanningRef,
    upsertMany,
    updateConversationListFromStore,
    startScanning,
    stopScanning
  } = useConversationStore()

  // Active messages state
  const { messages, updateActiveMessagesFromStore } = useActiveMessages(capturedPlatform, storeRef)

  // Conversation key for URL change detection
  const [conversationKey, setConversationKey] = useState<string>(getConversationKey())

  // Create update function that syncs active messages
  const updateAllDerivedState = useCallback(() => {
    updateConversationListFromStore(updateActiveMessagesFromStore)
  }, [updateConversationListFromStore, updateActiveMessagesFromStore])

  // Create start scanning function
  const startScanningWithUpdate = useCallback(() => {
    startScanning(updateAllDerivedState)
  }, [startScanning, updateAllDerivedState])

  // Create interceptor event handler
  const handleInterceptorEvent = useCallback(
    (evt: InterceptorEvent) => {
      const handler = createInterceptorEventHandler({
        capturedPlatform,
        upsertMany,
        updateActiveMessagesFromStore,
        isScanningRef
      })
      handler(evt)
    },
    [capturedPlatform, upsertMany, updateActiveMessagesFromStore, isScanningRef]
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

  // Keep your old behavior: scanning enabled when exporter opens
  // Also trigger rescan if store is empty to fetch current conversation
  useEffect(() => {
    console.log("[useMessageScanner] isExporterOpen changed:", isExporterOpen)
    if (isExporterOpen) {
      startScanningWithUpdate()
      // If store is empty or current conversation not in store, trigger rescan
      const activeId = capturedPlatform ? getActiveConversationIdFromUrl(capturedPlatform) : null
      const hasActiveConversation = activeId && storeRef.current.has(`${capturedPlatform}:${activeId}`)
      if (!hasActiveConversation && capturedPlatform) {
        console.log("[useMessageScanner] Store empty or missing active conversation, triggering rescan", {
          storeSize: storeRef.current.size,
          activeId,
          hasActiveConversation
        })
        rescan()
      }
    } else {
      stopScanning()
    }
  }, [isExporterOpen, startScanningWithUpdate, stopScanning, capturedPlatform, storeRef, rescan])

  // Listen for intercepted network data directly from window.postMessage (from MAIN world interceptor)
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
        receivedCount: receivedMessageCount.current,
        isScanning: isScanningRef.current
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
    // Update state after queue drains (next tick)
    setTimeout(() => {
      logFlow("INITIAL_UPDATE_AFTER_READY")
      updateAllDerivedState()
    }, 0)

    return () => {
      logFlow("LISTENER_CLEANUP")
      window.removeEventListener("message", listener)
    }
  }, [handleInterceptorEvent, isScanningRef, updateAllDerivedState])

  // Detect URL changes (SPA navigation) and keep conversationKey + messages in sync
  useEffect(() => {
    console.log("[useMessageScanner] Setting up URL change detection interval")
    const interval = window.setInterval(() => {
      const nextKey = getConversationKey()
      if (nextKey !== conversationKey) {
        console.log("[useMessageScanner] URL changed:", { 
          from: conversationKey, 
          to: nextKey,
          isScanning: isScanningRef.current,
          storeSize: storeRef.current.size,
          storeKeys: Array.from(storeRef.current.keys())
        })
        setConversationKey(nextKey)

        // Always sync state on URL change
        console.log("[useMessageScanner] URL change: Syncing state")
        updateAllDerivedState()

        // Only do extra work (rescan) when scanning is enabled
        if (isScanningRef.current) {
          const activeId = capturedPlatform ? getActiveConversationIdFromUrl(capturedPlatform) : null
          const convo = activeId ? storeRef.current.get(`${capturedPlatform}:${activeId}`) : null

          console.log("[useMessageScanner] URL change: Conversation check", {
            capturedPlatform,
            activeId,
            hasConversation: !!convo,
            messageCount: convo?.messages.length ?? 0
          })

          if (capturedPlatform && (!convo || !convo.messages.length)) {
            console.log("[useMessageScanner] URL change: Conversation missing/incomplete, triggering rescan in 300ms")
            setTimeout(() => rescan(), 300)
          }
        }
      }
    }, 400)

    return () => {
      console.log("[useMessageScanner] Cleaning up URL change detection interval")
      window.clearInterval(interval)
    }
  }, [conversationKey, updateAllDerivedState, isScanningRef, capturedPlatform, storeRef, rescan])

  return {
    // Existing return fields (do not break current usage)
    messages,
    rescan,
    conversationKey,

    // Additive fields you asked to keep (won't break existing destructuring)
    conversations,
    stats,
    isScanning,
    startScanning: startScanningWithUpdate,
    stopScanning
  }
}
