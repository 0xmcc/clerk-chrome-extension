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
