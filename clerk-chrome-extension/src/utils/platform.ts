export type Platform = "chatgpt" | "claude" | "linkedin" | "youtube" | "unknown"

export const detectPlatformFromHost = (host: string): Platform => {
  const normalizedHost = host.toLowerCase()
  if (normalizedHost.includes("youtube.com")) return "youtube"
  if (normalizedHost.includes("linkedin.com")) return "linkedin"
  if (normalizedHost.includes("claude.ai")) return "claude"
  if (normalizedHost.includes("chatgpt") || normalizedHost.includes("openai")) {
    return "chatgpt"
  }
  return "unknown"
}

export const detectPlatformFromUrl = (
  input?: string | URL | null
): Platform => {
  if (!input) return "unknown"

  try {
    const url = typeof input === "string" ? new URL(input) : input
    return detectPlatformFromHost(url.hostname)
  } catch {
    return "unknown"
  }
}

export const detectPlatform = (): Platform => {
  return detectPlatformFromHost(window.location.hostname)
}

export const getPlatformLabel = (platform: Platform = detectPlatform()) => {
  if (platform === "youtube") return "YouTube"
  if (platform === "linkedin") return "LinkedIn"
  if (platform === "claude") return "Claude"
  if (platform === "chatgpt") return "ChatGPT"
  return "Web Page"
}
