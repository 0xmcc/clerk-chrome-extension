import type { Conversation } from "./types"

// Module-level shared state singleton
// All hook instances share the same store, ensuring conversations
// captured before exporter opens are preserved

export const sharedStore = new Map<string, Conversation>()

// Cached Claude orgId - extracted from any /api/organizations/{orgId}/ URL
let cachedClaudeOrgId: string | null = null

export const setClaudeOrgId = (orgId: string) => {
  if (orgId && orgId !== cachedClaudeOrgId) {
    console.log("[store] Cached Claude orgId:", orgId)
    cachedClaudeOrgId = orgId
  }
}

export const getClaudeOrgId = (): string | null => cachedClaudeOrgId

// Cached ChatGPT auth token - extracted from any /backend-api/ request
let cachedChatGPTAuthToken: string | null = null

export const setChatGPTAuthToken = (token: string) => {
  if (token && token !== cachedChatGPTAuthToken) {
    console.log("[store] Cached ChatGPT auth token:", token.substring(0, 30) + "...")
    cachedChatGPTAuthToken = token
  }
}

export const getChatGPTAuthToken = (): string | null => cachedChatGPTAuthToken

// Stable ref-like object that points to the shared state
export const storeRef = { current: sharedStore }
