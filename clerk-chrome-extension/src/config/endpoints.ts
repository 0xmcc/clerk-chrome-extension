/**
 * SINGLE SOURCE OF TRUTH for all API endpoint patterns.
 *
 * This file defines endpoint patterns ONCE. All other files import from here.
 * If ChatGPT changes /backend-api/conversation/ to /api/v2/conversation/,
 * update it HERE and all code automatically uses the new pattern.
 *
 * CONSTRAINT: One definition point, many reference points.
 */

// =============================================================================
// CHATGPT ENDPOINTS
// =============================================================================

export const CHATGPT_ENDPOINTS = {
  /** Prefix for all ChatGPT API paths */
  API_PREFIX: "/backend-api",

  /** Path for conversation list endpoint */
  CONVERSATIONS_LIST: "/backend-api/conversations",

  /** Path prefix for single conversation detail (append /{id}) */
  CONVERSATION_DETAIL_PREFIX: "/backend-api/conversation/",
} as const

// =============================================================================
// CLAUDE ENDPOINTS
// =============================================================================

export const CLAUDE_ENDPOINTS = {
  /** Prefix for all Claude organization API paths */
  ORG_API_PREFIX: "/api/organizations/",

  /** Claude uses two different endpoint formats for conversations */
  CONVERSATION_PATHS: ["conversations", "chat_conversations"] as const,
} as const

// =============================================================================
// URL BUILDERS (for making requests)
// =============================================================================

/** Build ChatGPT conversation detail URL */
export const buildChatGPTDetailUrl = (conversationId: string): string =>
  `${CHATGPT_ENDPOINTS.CONVERSATION_DETAIL_PREFIX}${conversationId}`

/** Build Claude conversation detail URLs (returns both possible formats) */
export const buildClaudeDetailUrls = (orgId: string, conversationId: string): string[] =>
  CLAUDE_ENDPOINTS.CONVERSATION_PATHS.map(
    (path) => `${CLAUDE_ENDPOINTS.ORG_API_PREFIX}${orgId}/${path}/${conversationId}`
  )

/** Build Claude conversation list URLs (returns both possible formats) */
export const buildClaudeListUrls = (orgId: string): string[] =>
  CLAUDE_ENDPOINTS.CONVERSATION_PATHS.map(
    (path) => `${CLAUDE_ENDPOINTS.ORG_API_PREFIX}${orgId}/${path}`
  )

// =============================================================================
// URL MATCHERS (for checking incoming URLs)
// =============================================================================

/** Check if URL matches ChatGPT conversation list */
export const matchChatGPTList = (u: URL): boolean =>
  u.pathname === CHATGPT_ENDPOINTS.CONVERSATIONS_LIST

/** Check if URL matches ChatGPT conversation detail */
export const matchChatGPTDetail = (u: URL): boolean =>
  u.pathname.startsWith(CHATGPT_ENDPOINTS.CONVERSATION_DETAIL_PREFIX)

/** Check if URL matches any ChatGPT API endpoint */
export const matchChatGPTAny = (u: URL): boolean =>
  u.pathname.startsWith(CHATGPT_ENDPOINTS.API_PREFIX)

/** Check if URL matches Claude conversation list (either format) */
export const matchClaudeList = (u: URL): boolean => {
  const patterns = CLAUDE_ENDPOINTS.CONVERSATION_PATHS.map(
    (path) => new RegExp(`^${CLAUDE_ENDPOINTS.ORG_API_PREFIX}[^/]+/${path}$`)
  )
  return patterns.some((regex) => regex.test(u.pathname))
}

/** Check if URL matches Claude conversation detail (either format) */
export const matchClaudeDetail = (u: URL): boolean => {
  const patterns = CLAUDE_ENDPOINTS.CONVERSATION_PATHS.map(
    (path) => new RegExp(`^${CLAUDE_ENDPOINTS.ORG_API_PREFIX}[^/]+/${path}/[^/?]+$`)
  )
  return patterns.some((regex) => regex.test(u.pathname))
}

/** Check if URL matches any Claude organization API endpoint */
export const matchClaudeOrgApi = (u: URL): boolean =>
  u.pathname.startsWith(CLAUDE_ENDPOINTS.ORG_API_PREFIX)

// =============================================================================
// CAPTURE LOGIC (for interceptors)
// =============================================================================

/**
 * Determine if a URL should be captured by the interceptor.
 * This is the canonical implementation - do not duplicate elsewhere.
 */
export const shouldCaptureUrl = (urlStr: string, baseUrl?: string): boolean => {
  try {
    const u = new URL(urlStr, baseUrl || "http://localhost")
    const p = u.pathname

    // ChatGPT endpoints
    if (
      p.startsWith(CHATGPT_ENDPOINTS.CONVERSATION_DETAIL_PREFIX) ||
      p === CHATGPT_ENDPOINTS.CONVERSATIONS_LIST
    ) {
      return true
    }

    // Claude: Capture ALL /api/organizations/... URLs
    // Handler extracts orgId and filters conversation endpoints
    if (p.startsWith(CLAUDE_ENDPOINTS.ORG_API_PREFIX)) {
      return true
    }

    return false
  } catch {
    return false
  }
}

// =============================================================================
// PLATFORM INFERENCE (from URL patterns)
// =============================================================================

export type CapturedPlatformType = "chatgpt" | "claude"

/** Infer platform from API path patterns (fallback when host detection fails) */
export const inferPlatformFromPath = (pathname: string): CapturedPlatformType | null => {
  if (pathname.startsWith(CHATGPT_ENDPOINTS.API_PREFIX)) return "chatgpt"
  if (pathname.startsWith(CLAUDE_ENDPOINTS.ORG_API_PREFIX)) return "claude"
  return null
}

// =============================================================================
// ORG ID EXTRACTION (Claude-specific)
// =============================================================================

/** Extract orgId from Claude API URL pathname */
export const extractClaudeOrgId = (pathname: string): string | null => {
  const regex = new RegExp(`^${CLAUDE_ENDPOINTS.ORG_API_PREFIX}([^/]+)`)
  const match = pathname.match(regex)
  return match?.[1] || null
}

// =============================================================================
// HOST PATTERNS (for content script matching)
// =============================================================================

export const HOST_PATTERNS = {
  CHATGPT: ["https://chat.openai.com/*", "https://chatgpt.com/*"],
  CLAUDE: ["https://claude.ai/*", "https://*.claude.ai/*"],
} as const

export const ALL_HOST_PATTERNS = [...HOST_PATTERNS.CHATGPT, ...HOST_PATTERNS.CLAUDE] as const

/** Check if a URL string matches target sites */
export const isTargetSite = (url: string): boolean =>
  url.includes("chat.openai.com") || url.includes("chatgpt.com") || url.includes("claude.ai")
