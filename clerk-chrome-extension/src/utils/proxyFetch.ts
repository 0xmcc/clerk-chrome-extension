import { IS_DEVELOPMENT } from "../config/features"

const PROXY_FETCH_DEV_ALLOWED_HOSTS = new Set(["api.agentmail.to"])

type ProxyFetchMessage = {
  url?: unknown
  method?: string
  headers?: Record<string, string>
  body?: BodyInit | null
}

type ProxyFetchResult = {
  success: boolean
  status?: number
  error?: string
  data?: unknown
}

type HandleProxyFetchOptions = {
  fetchImpl?: typeof fetch
  isDevelopment?: boolean
}

export const parseProxyFetchUrl = (rawUrl: string): URL | null => {
  try {
    return new URL(rawUrl)
  } catch {
    return null
  }
}

export const isProxyFetchAllowed = (
  url: URL,
  isDevelopment = IS_DEVELOPMENT
): boolean => {
  if (url.protocol !== "https:") return false
  if (!isDevelopment) return false

  return PROXY_FETCH_DEV_ALLOWED_HOSTS.has(url.hostname)
}

export const handleProxyFetchMessage = async (
  message: ProxyFetchMessage,
  {
    fetchImpl = fetch,
    isDevelopment = IS_DEVELOPMENT
  }: HandleProxyFetchOptions = {}
): Promise<ProxyFetchResult> => {
  const requestUrl = typeof message.url === "string" ? message.url : ""
  const parsedUrl = parseProxyFetchUrl(requestUrl)

  if (!parsedUrl) {
    return { success: false, status: 400, error: "Invalid proxyFetch URL" }
  }

  if (!isProxyFetchAllowed(parsedUrl, isDevelopment)) {
    return {
      success: false,
      status: 403,
      error: !isDevelopment
        ? "proxyFetch is disabled in production builds"
        : `proxyFetch host not allowed: ${parsedUrl.hostname}`
    }
  }

  try {
    const response = await fetchImpl(parsedUrl.toString(), {
      method: message.method || "GET",
      headers: message.headers || {},
      body: message.body || undefined
    })
    const text = await response.text()
    let data: unknown

    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return { success: response.ok, status: response.status, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Fetch failed"
    }
  }
}
