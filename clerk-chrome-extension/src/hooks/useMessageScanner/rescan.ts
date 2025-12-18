import type { Conversation, CapturedPlatform, InterceptorEvent } from "./types"
import { getActiveConversationIdFromUrl, now } from "./utils"

export const INTERCEPTOR_SOURCE = "__echo_network_interceptor__"

export interface RescanHandlerDeps {
  capturedPlatform: CapturedPlatform | null
  flushAllState: () => void
  handleInterceptorEvent: (evt: InterceptorEvent) => void
  storeRef: React.MutableRefObject<Map<string, Conversation>>
}

export const createRescanHandler = (deps: RescanHandlerDeps) => {
  const { capturedPlatform, flushAllState, handleInterceptorEvent, storeRef } = deps

  return async () => {
    console.log("[useMessageScanner] rescan called", { capturedPlatform })
    flushAllState()

    if (!capturedPlatform) {
      console.log("[useMessageScanner] rescan: no captured platform, skipping fetch")
      return
    }
    const activeId = getActiveConversationIdFromUrl(capturedPlatform)
    if (!activeId) {
      console.log("[useMessageScanner] rescan: no active conversation ID, skipping fetch")
      return
    }

    console.log("[useMessageScanner] rescan: fetching detail for", { platform: capturedPlatform, activeId })

    try {
      if (capturedPlatform === "chatgpt") {
        const url = `/backend-api/conversation/${activeId}`
        console.log("[useMessageScanner] rescan: fetching ChatGPT detail", url)
        const resp = await fetch(url, {
          credentials: "include",
          headers: { accept: "application/json" }
        })
        if (!resp.ok) {
          console.log("[useMessageScanner] rescan: ChatGPT fetch failed", resp.status, resp.statusText)
          return
        }
        const json = await resp.json().catch(() => null)
        if (!json) {
          console.log("[useMessageScanner] rescan: ChatGPT response not JSON")
          return
        }
        console.log("[useMessageScanner] rescan: ChatGPT detail fetched successfully")
        handleInterceptorEvent({
          source: INTERCEPTOR_SOURCE,
          url: new URL(url, window.location.origin).href,
          method: "GET",
          status: resp.status,
          ok: resp.ok,
          ts: now(),
          data: json
        })
      }

      if (capturedPlatform === "claude") {
        const key = `claude:${activeId}`
        const convo = storeRef.current.get(key)
        const orgId = convo?.orgId
        if (!orgId) {
          console.log("[useMessageScanner] rescan: Claude conversation missing orgId", { key, hasConvo: !!convo })
          return
        }

        const url = `/api/organizations/${orgId}/conversations/${activeId}`
        console.log("[useMessageScanner] rescan: fetching Claude detail", url)
        const resp = await fetch(url, {
          credentials: "include",
          headers: { accept: "application/json" }
        })
        if (!resp.ok) {
          console.log("[useMessageScanner] rescan: Claude fetch failed", resp.status, resp.statusText)
          return
        }
        const json = await resp.json().catch(() => null)
        if (!json) {
          console.log("[useMessageScanner] rescan: Claude response not JSON")
          return
        }
        console.log("[useMessageScanner] rescan: Claude detail fetched successfully")
        handleInterceptorEvent({
          source: INTERCEPTOR_SOURCE,
          url: new URL(url, window.location.origin).href,
          method: "GET",
          status: resp.status,
          ok: resp.ok,
          ts: now(),
          data: json
        })
      }
    } catch (error) {
      console.error("[useMessageScanner] rescan: error during fetch", error)
    }
  }
}
