import type { Conversation, CapturedPlatform, InterceptorEvent } from "./types"
import { inferCapturedPlatformFromUrl, extractPathSegment, now } from "./utils"
import { matchChatGPTList, matchChatGPTDetail, matchClaudeList, matchClaudeDetail } from "./urlMatchers"
import { parseChatGPTList, parseChatGPTDetail } from "./parsers/chatgpt"
import { parseClaudeList, parseClaudeDetail } from "./parsers/claude"
import type React from "react"

export interface InterceptorEventHandlerDeps {
  capturedPlatform: CapturedPlatform | null
  upsertMany: (conversations: Conversation[]) => void
  syncActiveMessages: () => void
  isScanningRef: React.MutableRefObject<boolean>
}

export const createInterceptorEventHandler = (deps: InterceptorEventHandlerDeps) => {
  const { capturedPlatform, upsertMany, syncActiveMessages, isScanningRef } = deps

  return (evt: InterceptorEvent) => {
    if (!evt?.url || !evt?.data) {
      console.log("[useMessageScanner] handleInterceptorEvent: skipping (missing url or data)", { hasUrl: !!evt?.url, hasData: !!evt?.data })
      return
    }

    let url: URL
    try {
      // Handle both absolute and relative URLs
      url = evt.url.startsWith("http") ? new URL(evt.url) : new URL(evt.url, window.location.origin)
    } catch {
      console.log("[useMessageScanner] handleInterceptorEvent: invalid URL", evt.url)
      return
    }

    const inferred = inferCapturedPlatformFromUrl(url)
    if (!inferred) {
      console.log("[useMessageScanner] handleInterceptorEvent: not a captured platform", { url: evt.url, pathname: url.pathname })
      return
    }

    console.log("[useMessageScanner] handleInterceptorEvent: intercepted", {
      platform: inferred,
      url: evt.url,
      method: evt.method,
      status: evt.status,
      ok: evt.ok,
      hasData: !!evt.data
    })

    const seenAt = now()

    // ChatGPT
    if (inferred === "chatgpt") {
      if (matchChatGPTList(url)) {
        console.log("[useMessageScanner] ChatGPT list endpoint detected")
        const metas = parseChatGPTList(evt.data)
        console.log("[useMessageScanner] Parsed ChatGPT list:", metas.length, "conversations")
        const convos: Conversation[] = metas.map((m) => ({
          id: m.id,
          platform: "chatgpt",
          title: m.title,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          messages: [],
          hasFullHistory: false,
          lastSeenAt: seenAt
        }))
        upsertMany(convos)
        return
      }

      if (matchChatGPTDetail(url)) {
        const id = extractPathSegment(url.pathname, 0)
        if (!id) {
          console.log("[useMessageScanner] ChatGPT detail: failed to extract ID from", url.pathname)
          return
        }

        console.log("[useMessageScanner] ChatGPT detail endpoint detected:", id)
        const parsed = parseChatGPTDetail(id, evt.data)
        console.log("[useMessageScanner] Parsed ChatGPT detail:", {
          id,
          title: parsed.title,
          messageCount: parsed.messages.length,
          hasFullHistory: parsed.hasFullHistory
        })
        upsertMany([
          {
            id,
            platform: "chatgpt",
            title: parsed.title,
            createdAt: parsed.createdAt,
            updatedAt: parsed.updatedAt,
            messages: parsed.messages,
            hasFullHistory: true,
            lastSeenAt: seenAt
          }
        ])

        // If this is the active conversation, refresh messages immediately
        if (isScanningRef.current && capturedPlatform === "chatgpt") {
          console.log("[useMessageScanner] Active ChatGPT conversation updated, syncing messages")
          syncActiveMessages()
        }
        return
      }

      return
    }

    // Claude
    if (inferred === "claude") {
      if (matchClaudeList(url)) {
        // List: /api/organizations/{orgId}/conversations → orgId is index 1 from end
        const orgId = extractPathSegment(url.pathname, 1)
        if (!orgId) {
          console.log("[useMessageScanner] Claude list: failed to extract orgId from", url.pathname)
          return
        }

        console.log("[useMessageScanner] Claude list endpoint detected, orgId:", orgId)
        const metas = parseClaudeList(orgId, evt.data)
        console.log("[useMessageScanner] Parsed Claude list:", metas.length, "conversations")
        const convos: Conversation[] = metas.map((m) => ({
          id: m.id,
          platform: "claude",
          title: m.title,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          orgId: m.orgId,
          messages: [],
          hasFullHistory: false,
          lastSeenAt: seenAt
        }))
        upsertMany(convos)
        return
      }

      if (matchClaudeDetail(url)) {
        // Detail: /api/organizations/{orgId}/conversations/{uuid} → uuid is index 0, orgId is index 2
        const uuid = extractPathSegment(url.pathname, 0)
        const orgId = extractPathSegment(url.pathname, 2)
        if (!uuid || !orgId) {
          console.log("[useMessageScanner] Claude detail: failed to extract UUID or orgId from", url.pathname)
          return
        }

        console.log("[useMessageScanner] Claude detail endpoint detected:", { orgId, uuid })
        const parsed = parseClaudeDetail(orgId, uuid, evt.data)
        console.log("[useMessageScanner] Parsed Claude detail:", {
          uuid,
          orgId: parsed.orgId,
          title: parsed.title,
          messageCount: parsed.messages.length,
          hasFullHistory: parsed.hasFullHistory
        })
        upsertMany([
          {
            id: uuid,
            platform: "claude",
            title: parsed.title,
            createdAt: parsed.createdAt,
            updatedAt: parsed.updatedAt,
            orgId: parsed.orgId,
            messages: parsed.messages,
            hasFullHistory: true,
            lastSeenAt: seenAt
          }
        ])

        if (isScanningRef.current && capturedPlatform === "claude") {
          console.log("[useMessageScanner] Active Claude conversation updated, syncing messages")
          syncActiveMessages()
        }
        return
      }

      return
    }
  }
}
