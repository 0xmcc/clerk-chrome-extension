export const REMOTE_PAGE_MARKDOWN_ACTION = "fetchRemotePageMarkdown"

const DEFUDDLE_REMOTE_BASE_URL = "https://defuddle.md"
const PRIVATE_HOSTNAME_SUFFIXES = [".internal", ".local", ".localhost"]
const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./
]

export interface RemotePageMarkdownResponse {
  success: boolean
  error?: string
  markdown?: string
  status?: number
}

const isPrivateIpv4Address = (hostname: string): boolean =>
  PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname))

const isPrivateHostname = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname === "[::1]" ||
  PRIVATE_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))

export const shouldAttemptRemotePageMarkdown = (sourceUrl: string): boolean => {
  try {
    const parsedUrl = new URL(sourceUrl)
    const hostname = parsedUrl.hostname.toLowerCase()

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false
    }

    if (
      !hostname ||
      isPrivateHostname(hostname) ||
      isPrivateIpv4Address(hostname)
    ) {
      return false
    }

    return true
  } catch {
    return false
  }
}

export const buildDefuddleRemotePageMarkdownUrl = (
  sourceUrl: string
): string => {
  const parsedUrl = new URL(sourceUrl)
  const remotePath = `${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`
    .replace(/\?/g, "%3F")
    .replace(/#/g, "%23")
    .replace(/^\/+/, "")

  return `${DEFUDDLE_REMOTE_BASE_URL}/${remotePath}`
}

export const requestRemotePageMarkdown = async (
  sourceUrl: string
): Promise<string | null> =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: REMOTE_PAGE_MARKDOWN_ACTION,
        sourceUrl
      },
      (response?: RemotePageMarkdownResponse) => {
        if (chrome.runtime.lastError) {
          resolve(null)
          return
        }

        resolve(
          response?.success && typeof response.markdown === "string"
            ? response.markdown
            : null
        )
      }
    )
  })
