import type { Conversation, CapturedPlatform, InterceptorEvent } from "./types"
import { inferCapturedPlatformFromUrl, extractPathSegment, now } from "./utils"
import { matchChatGPTList, matchChatGPTDetail, matchClaudeList, matchClaudeDetail } from "./urlMatchers"
import { parseChatGPTList, parseChatGPTDetail } from "./parsers/chatgpt"
import { parseClaudeList, parseClaudeDetail } from "./parsers/claude"
import { setClaudeOrgId, setChatGPTAuthToken } from "./store"
import { extractClaudeOrgId, extractChatGPTAuthToken } from "../../config/endpoints"
import { debug } from "~utils/debug"

// Instrumentation helper for handler flow tracking
function logFlow(step: string, details?: Record<string, unknown>) {
  const timestamp = performance.now().toFixed(2)
  debug.any(["messages", "handler"], `[${timestamp}ms] ${step}`, details ?? "")
}

export interface InterceptorEventHandlerDeps {
  capturedPlatform: CapturedPlatform | null
  upsertMany: (conversations: Conversation[]) => void
  updateActiveMessagesFromStore: () => void
}

export const createInterceptorEventHandler = (deps: InterceptorEventHandlerDeps) => {
  const { capturedPlatform, upsertMany, updateActiveMessagesFromStore } = deps

  return (evt: InterceptorEvent) => {
    logFlow("HANDLER_ENTRY", { url: evt?.url, hasData: !!evt?.data })

    if (!evt?.url || !evt?.data) {
      logFlow("HANDLER_SKIP_NO_DATA", { hasUrl: !!evt?.url, hasData: !!evt?.data })
      return
    }

    let url: URL
    try {
      // Handle both absolute and relative URLs
      url = evt.url.startsWith("http") ? new URL(evt.url) : new URL(evt.url, window.location.origin)
    } catch {
      logFlow("HANDLER_SKIP_INVALID_URL", { url: evt.url })
      return
    }

    const inferred = inferCapturedPlatformFromUrl(url)
    if (!inferred) {
      logFlow("HANDLER_SKIP_NOT_CAPTURED", { url: evt.url, pathname: url.pathname })
      return
    }

    logFlow("HANDLER_PROCESSING", {
      platform: inferred,
      url: evt.url,
      method: evt.method,
      status: evt.status
    })

    const seenAt = now()

    // ChatGPT
    if (inferred === "chatgpt") {
      // Cache auth token from any ChatGPT backend-api request for later use in rescan
      const extractedAuthToken = extractChatGPTAuthToken(evt.headers)
      if (extractedAuthToken) {
        logFlow("CHATGPT_AUTH_TOKEN_EXTRACTED", { 
          hasToken: true,
          tokenPrefix: extractedAuthToken.substring(0, 30) + "..."
        })
        setChatGPTAuthToken(extractedAuthToken)
      } else if (evt.headers) {
        logFlow("CHATGPT_AUTH_TOKEN_MISSING", { 
          hasHeaders: true,
          headerKeys: Object.keys(evt.headers)
        })
      }

      if (matchChatGPTList(url)) {
        logFlow("CHATGPT_LIST_MATCH")
        const metas = parseChatGPTList(evt.data)
        logFlow("CHATGPT_LIST_PARSED", { count: metas.length })
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
        logFlow("UPSERT_MANY_START", { platform: "chatgpt", type: "list", count: convos.length })
        upsertMany(convos)
        logFlow("UPSERT_MANY_COMPLETE", { platform: "chatgpt", type: "list" })
        return
      }

      if (matchChatGPTDetail(url)) {
        const id = extractPathSegment(url.pathname, 0)
        if (!id) {
          logFlow("CHATGPT_DETAIL_NO_ID", { pathname: url.pathname })
          return
        }

        logFlow("CHATGPT_DETAIL_MATCH", { id })
        const parsed = parseChatGPTDetail(id, evt.data)
        logFlow("CHATGPT_DETAIL_PARSED", {
          id,
          title: parsed.title,
          messageCount: parsed.messages.length
        })
        logFlow("UPSERT_MANY_START", { platform: "chatgpt", type: "detail", id, messageCount: parsed.messages.length })
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
        logFlow("UPSERT_MANY_COMPLETE", { platform: "chatgpt", type: "detail", id })

        // Sync active messages if current tab matches the event's platform
        if (capturedPlatform === inferred) {
          logFlow("UPDATE_ACTIVE_MESSAGES_START", { platform: inferred })
          updateActiveMessagesFromStore()
          logFlow("UPDATE_ACTIVE_MESSAGES_COMPLETE", { platform: inferred })
        }
        return
      }

      return
    }

    // Claude
    if (inferred === "claude") {
      // Cache orgId from any Claude org URL for later use in rescan (pattern from centralized config)
      const extractedOrgId = extractClaudeOrgId(url.pathname)
      if (extractedOrgId) {
        setClaudeOrgId(extractedOrgId)
      }

      if (matchClaudeList(url)) {
        // List: /api/organizations/{orgId}/conversations → orgId is index 1 from end
        const orgId = extractPathSegment(url.pathname, 1)
        if (!orgId) {
          logFlow("CLAUDE_LIST_NO_ORGID", { pathname: url.pathname })
          return
        }

        logFlow("CLAUDE_LIST_MATCH", { orgId })
        const metas = parseClaudeList(orgId, evt.data)
        logFlow("CLAUDE_LIST_PARSED", { orgId, count: metas.length })
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
        logFlow("UPSERT_MANY_START", { platform: "claude", type: "list", count: convos.length })
        upsertMany(convos)
        logFlow("UPSERT_MANY_COMPLETE", { platform: "claude", type: "list" })
        return
      }

      if (matchClaudeDetail(url)) {
        // Detail: /api/organizations/{orgId}/conversations/{uuid} → uuid is index 0, orgId is index 2
        const uuid = extractPathSegment(url.pathname, 0)
        const orgId = extractPathSegment(url.pathname, 2)
        if (!uuid || !orgId) {
          logFlow("CLAUDE_DETAIL_NO_IDS", { pathname: url.pathname })
          return
        }

        logFlow("CLAUDE_DETAIL_MATCH", { orgId, uuid })

        // Log the raw response structure for debugging
        logFlow("CLAUDE_DETAIL_RAW_STRUCTURE", {
          hasChatMessages: Array.isArray((evt.data as any)?.chat_messages),
          chatMessagesLength: Array.isArray((evt.data as any)?.chat_messages) ? (evt.data as any).chat_messages.length : 0,
          topLevelKeys: Object.keys(evt.data as any || {})
        })

        const parsed = parseClaudeDetail(orgId, uuid, evt.data)
        logFlow("CLAUDE_DETAIL_PARSED", {
          uuid,
          orgId: parsed.orgId,
          title: parsed.title,
          messageCount: parsed.messages.length
        })

        logFlow("UPSERT_MANY_START", { platform: "claude", type: "detail", uuid, messageCount: parsed.messages.length })
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
        logFlow("UPSERT_MANY_COMPLETE", { platform: "claude", type: "detail", uuid })

        // Sync active messages if current tab matches the event's platform
        if (capturedPlatform === inferred) {
          logFlow("UPDATE_ACTIVE_MESSAGES_START", { platform: inferred })
          updateActiveMessagesFromStore()
          logFlow("UPDATE_ACTIVE_MESSAGES_COMPLETE", { platform: inferred })
        }
        return
      }

      return
    }
  }
}
