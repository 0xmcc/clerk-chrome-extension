/**
 * Conversation utilities for extracting conversation identifiers.
 */

/**
 * Derive a conversation ID from the current URL.
 * Supports LinkedIn, Claude, and ChatGPT URL patterns.
 * Falls back to a sanitized path-based ID or timestamp-based ID.
 *
 * @returns A string identifier for the current conversation
 */
export const deriveConversationId = (): string => {
  const path = window.location.pathname

  // LinkedIn messaging thread
  const linkedinMatch = path.match(/messaging\/thread\/([^/?#]+)/)
  if (linkedinMatch?.[1]) return linkedinMatch[1]

  // Claude chat
  const claudeMatch = path.match(/\/chat\/([^/?#]+)/)
  if (claudeMatch?.[1]) return claudeMatch[1]

  // ChatGPT conversation
  const chatMatch = path.match(/\/c\/([^/?#]+)/)
  if (chatMatch?.[1]) return chatMatch[1]

  // Fallback: sanitize the full path
  const combinedPath = `${window.location.hostname}${path}`
  const fallback = combinedPath.replace(/[^\w-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  if (fallback) return fallback

  // Final fallback: timestamp-based ID
  return `conversation-${Date.now()}`
}

/**
 * Derive a stable conversation ID from a source URL.
 * Supports YouTube watch pages, ChatGPT conversations, and Claude chats.
 *
 * @param input - Source URL to inspect
 * @param fallbackKey - Optional fallback identifier when URL parsing fails
 * @returns A stable conversation identifier
 */
export const deriveConversationIdFromUrl = (
  input: string,
  fallbackKey?: string
): string => {
  try {
    const url = new URL(input)
    const videoId = url.searchParams.get("v")
    if (videoId) return videoId

    const chatMatch = url.pathname.match(/\/c\/([^/?#]+)/)
    if (chatMatch?.[1]) return chatMatch[1]

    const claudeMatch = url.pathname.match(/\/chat\/([^/?#]+)/)
    if (claudeMatch?.[1]) return claudeMatch[1]

    const sanitized = `${url.hostname}${url.pathname}`
      .replace(/[^\w-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")

    if (sanitized) return sanitized
  } catch {
    // Fall back to the provided key or a timestamp-based identifier below.
  }

  if (fallbackKey) {
    return fallbackKey.replace(/[^\w-]/g, "-")
  }

  return `conversation-${Date.now()}`
}

/**
 * Sanitize a string for use as a filename.
 * Removes invalid characters, collapses whitespace, and replaces spaces with dashes.
 *
 * @param name - The string to sanitize
 * @returns Sanitized filename string, or null if input is empty/undefined
 */
export const sanitizeFilename = (name: string | undefined): string | null => {
  if (!name) return null
  const sanitized = name
    .replace(/[/\\:*?"<>|]/g, "")  // Remove invalid filename chars
    .replace(/\s+/g, " ")          // Collapse whitespace
    .trim()
    .replace(/ /g, "-")            // Replace spaces with dashes
  return sanitized || null
}
