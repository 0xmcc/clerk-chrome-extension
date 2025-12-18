import { useCallback, useEffect, useMemo, useState } from "react"
import { detectPlatform } from "~utils/platform"

import type { UseMessageScannerProps, InterceptorEvent } from "./types"
import { isCapturedPlatform, getConversationKey } from "./utils"
import { useConversationStore, useActiveMessages } from "./state"
import { createInterceptorEventHandler } from "./handlers"
import { createRescanHandler, INTERCEPTOR_SOURCE } from "./rescan"

export const useMessageScanner = ({ isExporterOpen }: UseMessageScannerProps) => {
  const platform = useMemo(() => detectPlatform(), [])
  const capturedPlatform = isCapturedPlatform(platform) ? platform : null

  console.log("[useMessageScanner] Initialized", { platform, capturedPlatform, isExporterOpen })

  // Conversation store state
  const {
    conversations,
    stats,
    isScanning,
    storeRef,
    isScanningRef,
    upsertMany,
    flushAllState,
    startScanning,
    stopScanning
  } = useConversationStore()

  // Active messages state
  const { messages, syncActiveMessages, clearMessages } = useActiveMessages(capturedPlatform, storeRef)

  // Conversation key for URL change detection
  const [conversationKey, setConversationKey] = useState<string>(getConversationKey())

  // Create flush function that syncs active messages
  const flushAllStateWithSync = useCallback(() => {
    flushAllState(syncActiveMessages)
  }, [flushAllState, syncActiveMessages])

  // Create start scanning function
  const startScanningWithFlush = useCallback(() => {
    startScanning(flushAllStateWithSync)
  }, [startScanning, flushAllStateWithSync])

  // Create interceptor event handler
  const handleInterceptorEvent = useCallback(
    (evt: InterceptorEvent) => {
      const handler = createInterceptorEventHandler({
        capturedPlatform,
        upsertMany,
        syncActiveMessages,
        isScanningRef
      })
      handler(evt)
    },
    [capturedPlatform, upsertMany, syncActiveMessages, isScanningRef]
  )

  // Create rescan handler
  const rescan = useCallback(async () => {
    const handler = createRescanHandler({
      capturedPlatform,
      flushAllState: flushAllStateWithSync,
      handleInterceptorEvent,
      storeRef
    })
    await handler()
  }, [capturedPlatform, flushAllStateWithSync, handleInterceptorEvent, storeRef])

  // Keep your old behavior: scanning enabled when exporter opens
  useEffect(() => {
    console.log("[useMessageScanner] isExporterOpen changed:", isExporterOpen)
    if (isExporterOpen) startScanningWithFlush()
    else stopScanning()
  }, [isExporterOpen, startScanningWithFlush, stopScanning])

  // Listen for intercepted network data directly from window.postMessage (from MAIN world interceptor)
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      // Security: only accept messages from same window
      if (event.source !== window) return

      const data = event.data
      if (!data || data.source !== INTERCEPTOR_SOURCE) return

      console.log("[useMessageScanner] Received intercepted data via postMessage:", data.url)

      handleInterceptorEvent({
        source: INTERCEPTOR_SOURCE,
        url: data.url,
        method: data.method,
        status: data.status,
        ok: data.ok,
        ts: data.ts,
        data: data.data
      })
    }

    window.addEventListener("message", listener)
    return () => window.removeEventListener("message", listener)
  }, [handleInterceptorEvent])

  // Detect URL changes (SPA navigation) and keep conversationKey + messages in sync
  useEffect(() => {
    console.log("[useMessageScanner] Setting up URL change detection interval")
    const interval = window.setInterval(() => {
      const nextKey = getConversationKey()
      if (nextKey !== conversationKey) {
        console.log("[useMessageScanner] URL changed:", { from: conversationKey, to: nextKey })
        setConversationKey(nextKey)

        // Refresh messages for the newly active conversation
        if (isScanningRef.current) {
          console.log("[useMessageScanner] Scanning active, syncing messages for new conversation")
          syncActiveMessages()
        } else {
          // Even if not scanning, keep messages cleared so exporter won't show stale content
          console.log("[useMessageScanner] Not scanning, clearing messages")
          clearMessages()
        }
      }
    }, 400)

    return () => {
      console.log("[useMessageScanner] Cleaning up URL change detection interval")
      window.clearInterval(interval)
    }
  }, [conversationKey, syncActiveMessages, clearMessages, isScanningRef])

  return {
    // Existing return fields (do not break current usage)
    messages,
    rescan,
    conversationKey,

    // Additive fields you asked to keep (won't break existing destructuring)
    conversations,
    stats,
    isScanning,
    startScanning: startScanningWithFlush,
    stopScanning
  }
}
