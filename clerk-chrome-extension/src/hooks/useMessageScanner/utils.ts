import type { Platform } from "~utils/platform"
import type { CapturedPlatform } from "./types"
import { inferPlatformFromPath } from "../../config/endpoints"

export const now = () => Date.now()

export const toMillis = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    // ChatGPT often uses seconds (float), sometimes ms
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value)
  }
  if (typeof value === "string") {
    const n = Number(value)
    if (Number.isFinite(n)) return toMillis(n)
    const d = Date.parse(value)
    if (!Number.isNaN(d)) return d
  }
  return undefined
}

export const createDetachedNode = (id: string): Element => {
  const el = document.createElement("div")
  el.setAttribute("data-echo-message-id", id)
  return el
}

export const normalizeText = (text: string): string => {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

export const isCapturedPlatform = (p: Platform): p is CapturedPlatform => p === "chatgpt" || p === "claude"

export const inferCapturedPlatformFromUrl = (u: URL): CapturedPlatform | null => {
  const host = u.hostname.toLowerCase()
  if (host.includes("claude.ai")) return "claude"
  if (host.includes("chatgpt") || host.includes("openai")) return "chatgpt"

  // Fallback by path matching (patterns from centralized config)
  return inferPlatformFromPath(u.pathname)
}

export const extractPathSegment = (pathname: string, indexFromEnd: number): string | null => {
  const parts = pathname.split("/").filter(Boolean)
  const idx = parts.length - 1 - indexFromEnd
  if (idx < 0 || idx >= parts.length) return null
  return parts[idx] || null
}

export const getConversationKey = () => `${window.location.hostname}${window.location.pathname}${window.location.search}`

export const getActiveConversationIdFromUrl = (platform: CapturedPlatform): string | null => {
  const path = window.location.pathname
  console.log("[getActiveConversationIdFromUrl] Extracting ID", { platform, path })

  // Claude uses /chat/{uuid}
  if (platform === "claude") {
    const m = path.match(/\/chat\/([^/?#]+)/)
    const result = m?.[1] || null
    console.log("[getActiveConversationIdFromUrl] Claude result", { result, match: m })
    return result
  }

  // ChatGPT commonly uses /c/{id}
  if (platform === "chatgpt") {
    const m = path.match(/\/c\/([^/?#]+)/)
    const result = m?.[1] || null
    console.log("[getActiveConversationIdFromUrl] ChatGPT result", { result, match: m })
    return result
  }

  console.log("[getActiveConversationIdFromUrl] No match", { platform, path })
  return null
}
