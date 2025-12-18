import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://*.claude.ai/*"
  ],
  run_at: "document_start",
  world: "MAIN"
}

// Message contract (page -> content script)
const MESSAGE_SOURCE = "__echo_network_interceptor__"

// Prevent double-install in SPA navigations
declare global {
  interface Window {
    __echo_net_hook_installed?: boolean
  }
}

if (!window.__echo_net_hook_installed) {
  window.__echo_net_hook_installed = true
  console.log("[Interceptor] Installing fetch/XHR hooks")
  installFetchHook()
  installXhrHook()
  console.log("[Interceptor] Hooks installed successfully")
} else {
  console.log("[Interceptor] Hooks already installed, skipping")
}

function shouldCapture(urlStr: string): boolean {
  try {
    const u = new URL(urlStr, location.href)
    const p = u.pathname

    // ChatGPT endpoints
    if (p.startsWith("/backend-api/conversation/") || p === "/backend-api/conversations") {
      console.log("[Interceptor] shouldCapture: MATCH (ChatGPT)", { url: urlStr, pathname: p })
      return true
    }

    // Claude endpoints
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

  window.fetch = (async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    const method =
      init?.method ||
      (typeof input === "object" && input && "method" in input
        ? (input as Request).method
        : "GET")

    const response = await originalFetch(input as any, init)

    if (!shouldCapture(requestUrl)) {
      return response
    }

    console.log("[Interceptor] Capturing fetch request:", { url: requestUrl, method, status: response.status })

    // Clone so we don't consume the page's response body
    const clone = response.clone()

    let body: unknown
    try {
      const ct = clone.headers.get("content-type") || ""
      console.log("[Interceptor] Parsing response body", { contentType: ct })

      if (ct.includes("application/json")) {
        body = await clone.json()
        console.log("[Interceptor] Parsed as JSON")
      } else {
        // Try JSON anyway (some endpoints omit content-type)
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
  } as any) satisfies typeof window.fetch
}

function installXhrHook() {
  const XHRProto = XMLHttpRequest.prototype
  const originalOpen = XHRProto.open
  const originalSend = XHRProto.send
  console.log("[Interceptor] Patching XMLHttpRequest")

  XHRProto.open = function (
    this: XMLHttpRequest,
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

  XHRProto.send = function (this: XMLHttpRequest, body?: Document | BodyInit | null) {
    const xhr = this

    const prev = (xhr as any).__echo_onloadend as ((this: XMLHttpRequest) => void) | undefined
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