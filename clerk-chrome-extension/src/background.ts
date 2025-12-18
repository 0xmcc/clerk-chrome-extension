import { createClerkClient } from "@clerk/chrome-extension/background"

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST

if (!publishableKey) {
  throw new Error("Please add PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file")
}

if (!syncHost) {
  throw new Error("Please add PLASMO_PUBLIC_CLERK_SYNC_HOST to your .env file")
}

let clerkClientPromise: ReturnType<typeof createClerkClient> | null = null
const CLERK_STORAGE_KEY_FRAGMENT = "__clerk_client_jwt"
let refreshPromise: Promise<void> | null = null

const getClerkClient = async () => {
  if (!clerkClientPromise) {
    clerkClientPromise = createClerkClient({
      publishableKey,
      syncHost
    })
  }

  return clerkClientPromise
}

const refreshClerkClient = async (reason: string) => {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const clerkClient = await getClerkClient()
      await clerkClient.load({ standardBrowser: false })
      console.log("[Background] Clerk refreshed", { reason, hasSession: !!clerkClient.session })
    } catch (error) {
      console.error("[Background] Failed to refresh Clerk:", error)
    }
  })()

  try {
    await refreshPromise
  } finally {
    refreshPromise = null
  }
}

async function initializeClerk() {
  try {
    const clerkClient = await getClerkClient()

    console.log("[Background] Clerk initialized", {
      isSignedIn: !!clerkClient.session,
      sessionId: clerkClient.session?.id,
      timestamp: new Date().toISOString()
    })

    // Session will automatically refresh every 60 seconds
    // while this background worker is running
  } catch (error) {
    console.error("[Background] Failed to initialize Clerk:", error)
  }
}

initializeClerk()

// Inject network interceptor into MAIN world for ChatGPT/Claude tabs
const injectInterceptor = (tabId: number) => {
  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      // Prevent double-install
      if ((window as any).__echo_net_hook_installed) {
        console.log("[Interceptor] Hooks already installed, skipping")
        return
      }
      ;(window as any).__echo_net_hook_installed = true

      const MESSAGE_SOURCE = "__echo_network_interceptor__"

      function shouldCapture(urlStr: string): boolean {
        try {
          const u = new URL(urlStr, location.href)
          const p = u.pathname
          if (p.startsWith("/backend-api/conversation/") || p === "/backend-api/conversations") {
            console.log("[Interceptor] shouldCapture: MATCH (ChatGPT)", { url: urlStr, pathname: p })
            return true
          }
          if (p.includes("/api/organizations/") && p.includes("/chat_conversations")) {
            console.log("[Interceptor] shouldCapture: MATCH (Claude)", { url: urlStr, pathname: p })
            return true
          }
          return false
        } catch (e) {
          console.log("[Interceptor] shouldCapture: ERROR parsing URL", { url: urlStr, error: e })
          return false
        }
      }

      function post(payload: any) {
        console.log("[Interceptor] Posting message:", {
          url: payload.url,
          method: payload.method,
          status: payload.status,
          hasData: !!payload.body
        })
        window.postMessage(
          {
            source: MESSAGE_SOURCE,
            url: payload.url,
            method: payload.method,
            status: payload.status,
            ok: payload.ok,
            ts: payload.ts,
            data: payload.body
          },
          "*"
        )
      }

      function installFetchHook() {
        const originalFetch = window.fetch
        console.log("[Interceptor] Patching window.fetch")

        window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
          const requestUrl =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : (input as any).url

          const method =
            init?.method ||
            (typeof input === "object" && input && "method" in input ? (input as Request).method : "GET")

          const response = await originalFetch(input as any, init)

          if (!shouldCapture(requestUrl)) {
            return response
          }

          console.log("[Interceptor] Capturing fetch request:", { url: requestUrl, method, status: response.status })

          const clone = response.clone()

          let body: unknown
          try {
            const ct = clone.headers.get("content-type") || ""
            console.log("[Interceptor] Parsing response body", { contentType: ct })

            if (ct.includes("application/json")) {
              body = await clone.json()
              console.log("[Interceptor] Parsed as JSON")
            } else {
              const text = await clone.text()
              try {
                body = JSON.parse(text)
                console.log("[Interceptor] Parsed text as JSON")
              } catch {
                body = text
                console.log("[Interceptor] Kept as text (not JSON)")
              }
            }
          } catch (e) {
            console.error("[Interceptor] Error parsing response body:", e)
            body = { __parse_error: true, message: String(e) }
          }

          post({
            url: requestUrl,
            method,
            status: response.status,
            ok: response.ok,
            ts: Date.now(),
            body
          })

          return response
        } as any
      }

      function installXhrHook() {
        const XHRProto = XMLHttpRequest.prototype
        const originalOpen = XHRProto.open
        const originalSend = XHRProto.send
        console.log("[Interceptor] Patching XMLHttpRequest")

        XHRProto.open = function (
          method: string,
          url: string | URL,
          async?: boolean,
          username?: string | null,
          password?: string | null
        ) {
          ;(this as any).__echo_method = method
          ;(this as any).__echo_url = typeof url === "string" ? url : url.toString()
          return originalOpen.apply(this, arguments as any)
        }

        XHRProto.send = function (body?: Document | BodyInit | null) {
          const xhr = this
          const prev = (xhr as any).__echo_onloadend
          if (prev) xhr.removeEventListener("loadend", prev)

          const onLoadEnd = () => {
            const url = (xhr as any).__echo_url as string | undefined
            const method = ((xhr as any).__echo_method as string | undefined) || "GET"

            if (!url) {
              console.log("[Interceptor] XHR loadend: no URL stored")
              return
            }

            if (!shouldCapture(url)) {
              return
            }

            console.log("[Interceptor] Capturing XHR request:", { url, method, status: xhr.status })

            let parsed: unknown
            try {
              const ct = xhr.getResponseHeader("content-type") || ""

              if (xhr.responseType === "json" && xhr.response != null) {
                parsed = xhr.response
                console.log("[Interceptor] XHR: Using responseType=json")
              } else if (ct.includes("application/json")) {
                parsed = JSON.parse(xhr.responseText || "null")
                console.log("[Interceptor] XHR: Parsed as JSON from content-type")
              } else {
                const text = xhr.responseText
                try {
                  parsed = JSON.parse(text)
                  console.log("[Interceptor] XHR: Parsed text as JSON")
                } catch {
                  parsed = text
                  console.log("[Interceptor] XHR: Kept as text (not JSON)")
                }
              }
            } catch (e) {
              console.error("[Interceptor] XHR: Error parsing response:", e)
              parsed = { __parse_error: true, message: String(e) }
            }

            post({
              url,
              method,
              status: xhr.status,
              ok: xhr.status >= 200 && xhr.status < 400,
              ts: Date.now(),
              body: parsed
            })
          }

          ;(xhr as any).__echo_onloadend = onLoadEnd
          xhr.addEventListener("loadend", onLoadEnd)

          return originalSend.apply(xhr, arguments as any)
        }
      }

      console.log("[Interceptor] Installing fetch/XHR hooks")
      installFetchHook()
      installXhrHook()
      console.log("[Interceptor] Hooks installed successfully")
    }
  }).catch((err) => {
    console.error("[Background] Failed to inject interceptor:", err)
  })
}

// Inject interceptor when tabs are updated (page loads/navigates)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return

  const url = tab.url
  if (!url) return

  const isTargetSite =
    url.includes("chat.openai.com") ||
    url.includes("chatgpt.com") ||
    url.includes("claude.ai")

  if (isTargetSite) {
    console.log("[Background] Injecting interceptor into tab:", tabId, url)
    injectInterceptor(tabId)
  }
})

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== "local") return
  const updatedKeys = Object.keys(changes)
  if (!updatedKeys.some((key) => key.includes(CLERK_STORAGE_KEY_FRAGMENT))) {
    return
  }

  void refreshClerkClient("storage-change")
})

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage()
    sendResponse({ success: true })
    return true
  }

  if (message.action === "getClerkToken") {
    getClerkClient()
      .then(async (clerkClient) => {
        if (!clerkClient.session) {
          await refreshClerkClient("token-request")
        }
        const token = await clerkClient.session?.getToken()
        sendResponse({
          success: !!token,
          token: token || null
        })
      })
      .catch((error) => {
        console.error("[Background] Failed to fetch Clerk token:", error)
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown Clerk error"
        })
      })

    return true
  }
  if (message.action === "interceptedNetworkData") {
    const tabId = sender.tab?.id
    if (!tabId) {
      console.error("[Background] No sender.tab.id for interceptedNetworkData")
      sendResponse({ success: false, error: "No sender.tab.id" })
      return true
    }

    console.log("[Background] Received intercepted data:", message.payload.url)

    // Forward to content script listeners (your hook is listening here)
    chrome.tabs.sendMessage(tabId, {
      action: "interceptedNetworkData",
      payload: message.payload
    }).catch((err) => {
      console.error("[Background] Failed to forward to tab:", err)
    })

    sendResponse({ success: true })
    return true
  }
  return true
})
