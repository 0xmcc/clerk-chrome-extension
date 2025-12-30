/**
 * Endpoint configuration for ChatGPT and Claude APIs.
 * 
 * This is the SINGLE SOURCE OF TRUTH for all API endpoint patterns.
 * 
 * TO UPDATE ENDPOINTS: Change the ENDPOINTS object below.
 * All matchers, builders, and utilities automatically use these definitions.
 * 
 * TO ADD A NEW PLATFORM: Add a new entry to ENDPOINTS with list/detail patterns.
 */

// =============================================================================
// ENDPOINT DEFINITIONS (Single Source of Truth)
// =============================================================================

/**
 * Endpoint templates for each platform.
 * 
 * Placeholders:
 * - {id} = conversation ID (UUID)
 * - {orgId} = organization ID (for Claude)
 * 
 * Examples:
 * - ChatGPT list: "/backend-api/conversations"
 * - ChatGPT detail: "/backend-api/conversation/abc-123"
 * - Claude list: "/api/organizations/org-123/conversations"
 * - Claude detail: "/api/organizations/org-123/conversations/uuid-456"
 */
export const ENDPOINTS = {
  chatgpt: {
    /** List endpoint: GET all conversations */
    list: "/backend-api/conversations",
    /** Detail endpoint: GET single conversation (replace {id} with actual ID) */
    detail: "/backend-api/conversation/{id}",
    /** API prefix for platform detection */
    apiPrefix: "/backend-api",
  },
  claude: {
    /** 
     * List endpoints: Claude uses two possible path formats.
     * Both are checked when matching.
     */
    list: [
      "/api/organizations/{orgId}/conversations",
      "/api/organizations/{orgId}/chat_conversations"
    ],
    /** 
     * Detail endpoints: Claude uses two possible path formats.
     * Both are checked when matching.
     */
    detail: [
      "/api/organizations/{orgId}/conversations/{id}",
      "/api/organizations/{orgId}/chat_conversations/{id}"
    ],
    /** Organization API prefix for platform detection */
    orgPrefix: "/api/organizations/",
  }
} as const

// =============================================================================
// HELPER FUNCTIONS (Internal - used by matchers/builders)
// =============================================================================

/**
 * Convert endpoint template to regex pattern.
 * Replaces {id} and {orgId} placeholders with regex patterns.
 */
function templateToRegex(template: string): RegExp {
  return new RegExp(
    "^" + 
    template
      .replace(/\{orgId\}/g, "[^/]+")
      .replace(/\{id\}/g, "[^/]+")
      .replace(/[{}]/g, "") +  // Remove any remaining braces
    "$"
  )
}

/**
 * Replace placeholders in template with actual values.
 */
function fillTemplate(template: string, replacements: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(`{${key}}`, value)
  }
  return result
}

// =============================================================================
// URL MATCHERS (Check if URLs match endpoints)
// =============================================================================

/**
 * Check if URL matches ChatGPT conversation list.
 * 
 * Matches: /backend-api/conversations
 * Doesn't match: /backend-api/conversations?offset=0 (query params are OK)
 */
export function matchChatGPTList(url: URL): boolean {
  return url.pathname === ENDPOINTS.chatgpt.list
}

/**
 * Check if URL matches ChatGPT conversation detail.
 * 
 * Matches: /backend-api/conversation/abc-123
 * Matches: /backend-api/conversation/694b9e70-4910-832a-9a2f-4333e7f3fe63
 * Matches: /backend-api/conversation/init (if it's a valid conversation ID)
 * Doesn't match: /backend-api/conversation/abc-123/stream_status (has trailing segment)
 * Doesn't match: /backend-api/conversation/abc-123/textdocs (has trailing segment)
 * 
 * FIXED: Now uses exact pattern matching instead of startsWith() to avoid matching sub-paths.
 */
export function matchChatGPTDetail(url: URL): boolean {
  const pattern = templateToRegex(ENDPOINTS.chatgpt.detail)
  return pattern.test(url.pathname)
}

/**
 * Check if URL matches any ChatGPT API endpoint.
 */
export function matchChatGPTAny(url: URL): boolean {
  return url.pathname.startsWith(ENDPOINTS.chatgpt.apiPrefix)
}

/**
 * Check if URL matches Claude conversation list (either format).
 * 
 * Matches: /api/organizations/org-123/conversations
 * Matches: /api/organizations/org-123/chat_conversations
 */
export function matchClaudeList(url: URL): boolean {
  const templates = Array.isArray(ENDPOINTS.claude.list) 
    ? ENDPOINTS.claude.list 
    : [ENDPOINTS.claude.list]
  
  return templates.some(template => {
    const pattern = templateToRegex(template)
    return pattern.test(url.pathname)
  })
}

/**
 * Check if URL matches Claude conversation detail (either format).
 * 
 * Matches: /api/organizations/org-123/conversations/uuid-456
 * Matches: /api/organizations/org-123/chat_conversations/uuid-456
 */
export function matchClaudeDetail(url: URL): boolean {
  const templates = Array.isArray(ENDPOINTS.claude.detail) 
    ? ENDPOINTS.claude.detail 
    : [ENDPOINTS.claude.detail]
  
  return templates.some(template => {
    // For detail, allow query params: /conversations/{id}?param=value
    const pattern = templateToRegex(template.replace(/\{id\}/, "[^/?]+"))
    return pattern.test(url.pathname)
  })
}

/**
 * Check if URL matches any Claude organization API endpoint.
 */
export function matchClaudeOrgApi(url: URL): boolean {
  return url.pathname.startsWith(ENDPOINTS.claude.orgPrefix)
}

// =============================================================================
// URL BUILDERS (Create URLs for requests)
// =============================================================================

/**
 * Build ChatGPT conversation detail URL.
 * 
 * Example: buildChatGPTDetailUrl("abc-123")
 * Returns: "/backend-api/conversation/abc-123"
 */
// export function buildChatGPTDetailUrl(conversationId: string): string {
//   return fillTemplate(ENDPOINTS.chatgpt.detail, { id: conversationId })
// }
export function buildChatGPTDetailUrl(conversationId: string): string {
  const path = fillTemplate(ENDPOINTS.chatgpt.detail, { id: conversationId })
  return new URL(path, window.location.origin).href
}


/**
 * Build Claude conversation detail URLs (returns both possible formats).
 * 
 * Example: buildClaudeDetailUrls("org-123", "uuid-456")
 * Returns: [
 *   "/api/organizations/org-123/conversations/uuid-456",
 *   "/api/organizations/org-123/chat_conversations/uuid-456"
 * ]
 */
export function buildClaudeDetailUrls(orgId: string, conversationId: string): string[] {
  const templates = Array.isArray(ENDPOINTS.claude.detail) 
    ? ENDPOINTS.claude.detail 
    : [ENDPOINTS.claude.detail]
  
  return templates.map(template => 
    fillTemplate(template, { orgId, id: conversationId })
  )
}

/**
 * Build Claude conversation list URLs (returns both possible formats).
 */
export function buildClaudeListUrls(orgId: string): string[] {
  const templates = Array.isArray(ENDPOINTS.claude.list) 
    ? ENDPOINTS.claude.list 
    : [ENDPOINTS.claude.list]
  
  return templates.map(template => 
    fillTemplate(template, { orgId })
  )
}

// =============================================================================
// CAPTURE LOGIC (For interceptors)
// =============================================================================

/**
 * Determine if a URL should be captured by the interceptor.
 * 
 * Captures:
 * - ChatGPT: exact list and detail endpoints (not sub-paths)
 * - Claude: all /api/organizations/... URLs (handler filters further)
 * 
 * FIXED: Now only captures exact detail endpoints, not sub-paths like /stream_status
 */
export function shouldCaptureUrl(urlStr: string, baseUrl?: string): boolean {
  try {
    const url = new URL(urlStr, baseUrl || "http://localhost")
    const path = url.pathname

    // Debug ChatGPT matching
    if (path.includes("/backend-api/conversation/")) {
      const detailMatch = matchChatGPTDetail(url)
      console.log("[shouldCaptureUrl] ChatGPT detail check", {
        path,
        detailMatch,
        pattern: ENDPOINTS.chatgpt.detail
      })
    }

    // ChatGPT: Only capture exact endpoints (not sub-paths)
    if (matchChatGPTDetail(url) || matchChatGPTList(url)) {
      return true
    }

    // Claude: Capture ALL org URLs (handler filters conversation endpoints)
    if (matchClaudeOrgApi(url)) {
      return true
    }

    return false
  } catch {
    return false
  }
}

// =============================================================================
// PLATFORM INFERENCE
// =============================================================================

export type CapturedPlatformType = "chatgpt" | "claude"

/**
 * Infer platform from API path patterns (fallback when host detection fails).
 */
export function inferPlatformFromPath(pathname: string): CapturedPlatformType | null {
  if (pathname.startsWith(ENDPOINTS.chatgpt.apiPrefix)) return "chatgpt"
  if (pathname.startsWith(ENDPOINTS.claude.orgPrefix)) return "claude"
  return null
}

/**
 * Extract orgId from Claude API URL pathname.
 * 
 * Example: extractClaudeOrgId("/api/organizations/org-123/conversations")
 * Returns: "org-123"
 */
export function extractClaudeOrgId(pathname: string): string | null {
  const match = pathname.match(new RegExp(`^${ENDPOINTS.claude.orgPrefix}([^/]+)`))
  return match?.[1] || null
}

/**
 * Extract auth token from ChatGPT request headers.
 * 
 * Example: extractChatGPTAuthToken({ authorization: "Bearer token..." })
 * Returns: "Bearer token..." or null
 */
export function extractChatGPTAuthToken(headers: Record<string, string> | HeadersInit | null | undefined): string | null {
  if (!headers) return null
  
  try {
    if (headers instanceof Headers) {
      return headers.get("authorization") || headers.get("Authorization") || null
    }
    if (typeof headers === "object" && headers !== null) {
      const auth = (headers as Record<string, string>)["authorization"] || 
                   (headers as Record<string, string>)["Authorization"]
      return auth || null
    }
  } catch {
    return null
  }
  return null
}

// =============================================================================
// HOST PATTERNS (For content script matching)
// =============================================================================

export const HOST_PATTERNS = {
  CHATGPT: ["https://chat.openai.com/*", "https://chatgpt.com/*"],
  CLAUDE: ["https://claude.ai/*", "https://*.claude.ai/*"],
} as const

export const ALL_HOST_PATTERNS = [...HOST_PATTERNS.CHATGPT, ...HOST_PATTERNS.CLAUDE] as const

/**
 * Check if a URL string matches target sites.
 */
export function isTargetSite(url: string): boolean {
  return url.includes("chat.openai.com") || url.includes("chatgpt.com") || url.includes("claude.ai")
}

// =============================================================================
// BACKWARD COMPATIBILITY (Deprecated - use ENDPOINTS directly)
// =============================================================================

/**
 * @deprecated Use ENDPOINTS.chatgpt instead
 * Kept for backward compatibility with existing code.
 */
export const CHATGPT_ENDPOINTS = {
  API_PREFIX: ENDPOINTS.chatgpt.apiPrefix,
  CONVERSATIONS_LIST: ENDPOINTS.chatgpt.list,
  CONVERSATION_DETAIL_PREFIX: "/backend-api/conversation/",  // Keep for compatibility
} as const

/**
 * @deprecated Use ENDPOINTS.claude instead
 * Kept for backward compatibility with existing code.
 */
export const CLAUDE_ENDPOINTS = {
  ORG_API_PREFIX: ENDPOINTS.claude.orgPrefix,
  CONVERSATION_PATHS: ["conversations", "chat_conversations"] as const,
} as const
