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

// Stable ref-like object that points to the shared state
export const storeRef = { current: sharedStore }
