export type Platform = "chatgpt" | "claude" | "linkedin" | "unknown"

export const detectPlatform = (): Platform => {
  const host = window.location.hostname.toLowerCase()
  if (host.includes("linkedin.com")) return "linkedin"
  if (host.includes("claude.ai")) return "claude"
  if (host.includes("chatgpt") || host.includes("openai")) return "chatgpt"
  return "unknown"
}

export const getPlatformLabel = (platform: Platform = detectPlatform()) => {
  if (platform === "linkedin") return "LinkedIn"
  if (platform === "claude") return "Claude"
  if (platform === "chatgpt") return "ChatGPT"
  return "Conversation"
}
