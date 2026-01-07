import { createClerkClient } from "@clerk/chrome-extension/background"
import {
  ALL_HOST_PATTERNS,
  isTargetSite,
  CHATGPT_ENDPOINTS,
  CLAUDE_ENDPOINTS,
} from "./config/endpoints"
import { debug } from "./utils/debug"

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST

if (!publishableKey) {
  throw new Error("Please add PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file")
}

if (!syncHost) {
  throw new Error("Please add PLASMO_PUBLIC_CLERK_SYNC_HOST to your .env file")
}

let clerkClientPromise: ReturnType<typeof createClerkClient> | null = null
// Clerk stores session JWT with keys containing this fragment (e.g., "clerk.{instance}.session.__clerk_client_jwt")
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
      debug.any(["auth", "clerk", "background"], "Clerk refreshed", { reason, hasSession: !!clerkClient.session })
    } catch (error) {
      console.error("[Background] Failed to refresh Clerk:", error)
      throw error
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
    await clerkClient.load({ standardBrowser: false })

    debug.any(["auth", "clerk", "background"], "Clerk initialized", {
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
// Inject into existing tabs on startup
chrome.tabs.query({ url: [...ALL_HOST_PATTERNS] }, (tabs) => {
  tabs.forEach((tab) => {
    if (tab.id) injectInterceptor(tab.id)
  })
})

// Inject network interceptor into MAIN world for ChatGPT/Claude tabs
// Pass endpoint patterns as arguments to avoid duplication (patterns defined in config/endpoints.ts)
const injectInterceptor = (tabId: number) => {
  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [
      CHATGPT_ENDPOINTS.CONVERSATION_DETAIL_PREFIX,
      CHATGPT_ENDPOINTS.CONVERSATIONS_LIST,
      CLAUDE_ENDPOINTS.ORG_API_PREFIX,
    ],
    func: (
      chatgptDetailPrefix: string,
      chatgptListPath: string,
      claudeOrgPrefix: string
    ) => {
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
          console.log("[Interceptor] Checking URL:", urlStr, "pathname:", p)
          // ChatGPT endpoints (patterns from centralized config)
          if (p.startsWith(chatgptDetailPrefix) || p === chatgptListPath) {
            console.log("[Interceptor] shouldCapture: MATCH (ChatGPT)", { url: urlStr, pathname: p })
            return true
          }
          // Claude: Capture ALL /api/organizations/... URLs (pattern from centralized config)
          if (p.startsWith(claudeOrgPrefix)) {
            console.log("[Interceptor] shouldCapture: MATCH (Claude org URL)", { url: urlStr, pathname: p })
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

  if (isTargetSite(url)) {
    debug.any(["interceptor", "background"], "Injecting interceptor into tab", { tabId, url })
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage()
    sendResponse({ success: true })
    return true
  }

  if (message.action === "openAuthTab") {
    chrome.tabs.create({ url: "https://momentum.ubi.studio/extension/sign-in?source=extension" })
    sendResponse({ success: true })
    return true
  }

  if (message.action === "refreshClerkAuth") {
    debug.any(["auth", "clerk", "background"], "refreshClerkAuth: start")
    ;(async () => {
      try {
        const clerkClient = await getClerkClient()

        const hasSessionBefore = !!clerkClient.session
        debug.any(["auth", "clerk", "background"], "refreshClerkAuth: before load", { hasSessionBefore })

        // Hard refresh: if this fails, we must report failure (don't swallow)
        await clerkClient.load({ standardBrowser: false })

        const hasSessionAfter = !!clerkClient.session
        debug.any(["auth", "clerk", "background"], "refreshClerkAuth: after load", {
          hasSessionAfter,
          sessionId: clerkClient.session?.id ?? null
        })

        sendResponse({
          success: true,
          hasSession: hasSessionAfter
        })
      } catch (error) {
        debug.any(["auth", "clerk", "background"], "refreshClerkAuth: error", {
          error: error instanceof Error ? error.message : String(error)
        })
        console.error("[Background] Manual auth refresh failed:", error)
        sendResponse({
          success: false,
          hasSession: false,
          error: error instanceof Error ? error.message : "Refresh failed"
        })
      }
    })()

    return true
  }

  if (message.action === "getClerkToken") {
    getClerkClient()
      .then(async (clerkClient) => {
        const hasSessionInitially = !!clerkClient.session
        debug.any(["auth", "clerk", "token"], "getClerkToken: entry", { hasSessionInitially })

        if (!clerkClient.session) {
          debug.any(["auth", "clerk", "token"], "getClerkToken: invoking refresh")
          try {
            await refreshClerkClient("token-request")
          } catch (error) {
            debug.any(["auth", "clerk", "token"], "getClerkToken: refresh failed", {
              error: error instanceof Error ? error.message : String(error)
            })
            sendResponse({
              success: false,
              token: null,
              error: error instanceof Error ? error.message : "Session refresh failed"
            })
            return
          }
        }

        // Re-check session after refresh - may still be null if user isn't signed in
        if (!clerkClient.session) {
          debug.any(["auth", "clerk", "token"], "getClerkToken: no session after refresh")
          sendResponse({
            success: false,
            token: null,
            error: "No active session. Please sign in."
          })
          return
        }

        const token = await clerkClient.session.getToken()

        debug.any(["auth", "clerk", "token"], "getClerkToken: result", {
          hasToken: !!token,
          tokenLength: token?.length ?? 0
        })

        sendResponse({
          success: !!token,
          token: token || null
        })
      })
      .catch((error) => {
        debug.any(["auth", "clerk", "token"], "getClerkToken: error", {
          error: error instanceof Error ? error.message : String(error)
        })
        console.error("[Background] Failed to fetch Clerk token:", error)
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown Clerk error"
        })
      })

    return true
  }

  if (message.action === "clerkSignOut") {
    getClerkClient()
      .then(async (clerkClient) => {
        await clerkClient.signOut()
        debug.any(["auth", "clerk", "background"], "Clerk signed out successfully")
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error("[Background] Failed to sign out:", error)
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Sign out failed"
        })
      })

    return true
  }

  return true
})
