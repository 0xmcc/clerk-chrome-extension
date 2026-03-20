import type { Conversation } from "./types"
import { debug } from "~utils/debug"
import { normalizeChatGPTAuthToken } from "../../config/endpoints"

// Module-level shared state singleton
// All hook instances share the same store, ensuring conversations
// captured before exporter opens are preserved

export const sharedStore = new Map<string, Conversation>()

// Stable ref-like object that points to the shared state
export const storeRef = { current: sharedStore }

// Cached Claude orgId - extracted from any /api/organizations/{orgId}/ URL
let cachedClaudeOrgId: string | null = null

export const setClaudeOrgId = (orgId: string) => {
  if (orgId && orgId !== cachedClaudeOrgId) {
    debug.any(["messages", "rescan"], "Cached Claude orgId", { orgId })
    cachedClaudeOrgId = orgId
  }
}

export const getClaudeOrgId = (): string | null => cachedClaudeOrgId

// Cached ChatGPT auth token - extracted from any /backend-api/ request
let cachedChatGPTAuthToken: string | null = null

const SESSION_KEY_AUTH = "echo_chatgpt_auth_token"
const SESSION_KEY_CONVOS = "echo_conversations_meta"

export const setChatGPTAuthToken = (token: string) => {
  const normalized = normalizeChatGPTAuthToken(token)
  if (normalized && normalized !== cachedChatGPTAuthToken) {
    debug.any(["messages", "rescan"], "Cached ChatGPT auth token", { tokenPrefix: normalized.substring(0, 30) + "..." })
    cachedChatGPTAuthToken = normalized
    try { chrome.storage.session.set({ [SESSION_KEY_AUTH]: normalized }) } catch {}
  }
}

export const getChatGPTAuthToken = (): string | null => cachedChatGPTAuthToken

// Persist minimal conversation metadata (no messages) — debounced 500ms
// Array alloc is deferred into the timeout so rapid upserts only serialize once
let _persistTimer: ReturnType<typeof setTimeout> | null = null
export const persistConversationsMeta = () => {
  if (_persistTimer) clearTimeout(_persistTimer)
  _persistTimer = setTimeout(() => {
    try {
      chrome.storage.session.set({
        [SESSION_KEY_CONVOS]: Array.from(sharedStore.values()).map(c => ({
          id: c.id,
          platform: c.platform,
          title: c.title,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          lastSeenAt: c.lastSeenAt,
        }))
      })
    } catch {}
  }, 500)
}

// Restore auth token + conversation metadata from session storage
export const loadPersistedState = async (): Promise<{
  authTokenRestored: boolean
  conversations: Conversation[]
}> => {
  try {
    const result = await chrome.storage.session.get([SESSION_KEY_AUTH, SESSION_KEY_CONVOS])

    const token = result[SESSION_KEY_AUTH]
    let authTokenRestored = false
    if (token && typeof token === "string" && !cachedChatGPTAuthToken) {
      cachedChatGPTAuthToken = token
      authTokenRestored = true
      debug.any(["messages", "rescan"], "Restored ChatGPT auth token from session")
    }

    const metas = result[SESSION_KEY_CONVOS]
    const conversations: Conversation[] = Array.isArray(metas)
      ? (metas as Array<Record<string, unknown>>).map(m => ({
          id: m.id as string,
          platform: m.platform as "chatgpt" | "claude",
          title: m.title as string | undefined,
          createdAt: m.createdAt as number | undefined,
          updatedAt: m.updatedAt as number | undefined,
          lastSeenAt: (m.lastSeenAt as number) ?? 0,
          messages: [],
          hasFullHistory: false,
        }))
      : []

    return { authTokenRestored, conversations }
  } catch {
    return { authTokenRestored: false, conversations: [] }
  }
}
