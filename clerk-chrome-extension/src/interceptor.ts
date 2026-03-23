import type { PlasmoCSConfig } from "plasmo"

import {
  ALL_HOST_PATTERNS,
  CHATGPT_ENDPOINTS,
  CLAUDE_ENDPOINTS,
  YOUTUBE_ENDPOINTS
} from "./config/endpoints"

export const config: PlasmoCSConfig = {
  matches: [...ALL_HOST_PATTERNS],
  run_at: "document_start",
  world: "MAIN"
}

declare global {
  interface Window {
    __echo_net_hook_installed?: boolean
  }
}

export function installNetworkInterceptor(
  chatgptDetailPrefix: string,
  chatgptListPath: string,
  claudeOrgPrefix: string,
  youtubeTranscriptPath: string
) {
  const MESSAGE_SOURCE = "__echo_network_interceptor__"
  const LISTENER_READY_SIGNAL = "__echo_listener_ready__"
  const LISTENER_READY_ACK_SIGNAL = "__echo_listener_ready_ack__"
  const messageQueue: any[] = []
  let listenerReady = false
  let messageSeq = 0

  function isReadySignalEvent(event: MessageEvent) {
    if (event.data !== LISTENER_READY_SIGNAL) {
      return false
    }

    if (event.source === window || event.source == null) {
      return true
    }

    return event.origin === "" || event.origin === window.location.origin
  }

  function logFlow(step: string, details?: Record<string, unknown>) {
    const timestamp = performance.now().toFixed(2)
    console.log(`[Interceptor:FLOW] [${timestamp}ms] ${step}`, details ?? "")
  }

  function isExactChatgptDetailPath(pathname: string) {
    if (!pathname.startsWith(chatgptDetailPrefix)) {
      return false
    }

    const conversationId = pathname.slice(chatgptDetailPrefix.length)
    return conversationId.length > 0 && !conversationId.includes("/")
  }

  function shouldCapture(urlStr: string): boolean {
    try {
      const url = new URL(urlStr, location.href)
      const path = url.pathname

      if (path === chatgptListPath || isExactChatgptDetailPath(path)) {
        console.log("[Interceptor] shouldCapture: MATCH", { url: urlStr })
        return true
      }

      if (path.startsWith(claudeOrgPrefix)) {
        console.log("[Interceptor] shouldCapture: MATCH", { url: urlStr })
        return true
      }

      if (path === youtubeTranscriptPath) {
        console.log("[Interceptor] shouldCapture: MATCH", { url: urlStr })
        return true
      }

      return false
    } catch {
      return false
    }
  }

  function post(payload: any) {
    const seq = ++messageSeq
    const message = {
      source: MESSAGE_SOURCE,
      url: payload.url,
      method: payload.method,
      status: payload.status,
      ok: payload.ok,
      ts: payload.ts,
      data: payload.body,
      headers: payload.headers,
      _seq: seq
    }

    logFlow("MESSAGE_CREATED", {
      seq,
      url: payload.url,
      method: payload.method,
      status: payload.status,
      listenerReady
    })

    if (listenerReady) {
      logFlow("MESSAGE_POST_IMMEDIATE", { seq, url: payload.url })
      window.postMessage(message, "*")
      return
    }

    logFlow("MESSAGE_QUEUED", {
      seq,
      url: payload.url,
      queueLength: messageQueue.length + 1
    })
    messageQueue.push(message)
  }

  function installFetchHook() {
    const originalFetch = window.fetch
    console.log("[Interceptor] Patching window.fetch")

    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (requestUrl.includes("/backend-api/conversation/")) {
        console.log("[Interceptor] FETCH CALLED for conversation endpoint:", {
          url: requestUrl,
          fullInput: input,
          hasInit: !!init
        })
      }

      const method =
        init?.method ||
        (typeof input === "object" && input && "method" in input
          ? (input as Request).method
          : "GET")

      const response = await originalFetch(input as any, init)

      let requestHeaders: Record<string, string> | undefined
      const shouldCaptureRequest = shouldCapture(requestUrl)
      if (requestUrl.includes("/backend-api/") || shouldCaptureRequest) {
        try {
          const headersSource =
            init?.headers ||
            (typeof input === "object" && input && "headers" in input
              ? (input as Request).headers
              : undefined)

          if (headersSource instanceof Headers) {
            requestHeaders = {}
            headersSource.forEach((value, key) => {
              requestHeaders![key] = value
            })
          } else if (
            typeof headersSource === "object" &&
            headersSource !== null
          ) {
            requestHeaders = headersSource as Record<string, string>
          }

          if (
            requestHeaders &&
            (requestHeaders.authorization || requestHeaders.Authorization)
          ) {
            console.log(
              "[Interceptor] Found auth token in backend-api request:",
              {
                url: requestUrl,
                hasAuth: true,
                authPrefix:
                  (
                    requestHeaders.authorization || requestHeaders.Authorization
                  )?.substring(0, 20) + "..."
              }
            )
          }
        } catch (error) {
          console.log("[Interceptor] Error extracting headers:", error)
        }
      }

      if (!shouldCaptureRequest) {
        if (requestUrl.includes("/backend-api/conversation/")) {
          console.log("[Interceptor] Conversation endpoint NOT captured", {
            url: requestUrl
          })
        }

        if (requestHeaders) {
          post({
            url: requestUrl,
            method,
            status: response.status,
            ok: response.ok,
            ts: Date.now(),
            body: null,
            headers: requestHeaders
          })
        }

        return response
      }

      console.log("[Interceptor] Capturing fetch request:", {
        url: requestUrl,
        method,
        status: response.status
      })

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
      } catch (error) {
        console.error("[Interceptor] Error parsing response body:", error)
        body = { __parse_error: true, message: String(error) }
      }

      post({
        url: requestUrl,
        method,
        status: response.status,
        ok: response.ok,
        ts: Date.now(),
        body,
        headers: requestHeaders
      })

      return response
    } as any satisfies typeof window.fetch
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

    XHRProto.send = function (
      this: XMLHttpRequest,
      body?: Document | BodyInit | null
    ) {
      const xhr = this
      const prev = (xhr as any).__echo_onloadend as
        | ((this: XMLHttpRequest) => void)
        | undefined

      if (prev) {
        xhr.removeEventListener("loadend", prev)
      }

      const onLoadEnd = () => {
        const url = (xhr as any).__echo_url as string | undefined
        const method =
          ((xhr as any).__echo_method as string | undefined) || "GET"

        if (!url) {
          console.log("[Interceptor] XHR loadend: no URL stored")
          return
        }

        if (!shouldCapture(url)) {
          return
        }

        console.log("[Interceptor] Capturing XHR request:", {
          url,
          method,
          status: xhr.status
        })

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
        } catch (error) {
          console.error("[Interceptor] XHR: Error parsing response:", error)
          parsed = { __parse_error: true, message: String(error) }
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

  logFlow("INIT", { messageQueueLength: messageQueue.length, listenerReady })

  window.addEventListener("message", (event) => {
    if (isReadySignalEvent(event)) {
      logFlow("READY_SIGNAL_RECEIVED", {
        wasAlreadyReady: listenerReady,
        queuedMessageCount: messageQueue.length,
        origin: event.origin
      })

      if (!listenerReady) {
        listenerReady = true
        window.postMessage(LISTENER_READY_ACK_SIGNAL, "*")
        logFlow("QUEUE_FLUSH_START", { messageCount: messageQueue.length })
        messageQueue.forEach((message, index) => {
          logFlow("QUEUE_FLUSH_ITEM", {
            index,
            url: message.url,
            seq: message._seq
          })
          window.postMessage(message, "*")
        })
        logFlow("QUEUE_FLUSH_COMPLETE", {
          flushedCount: messageQueue.length
        })
        messageQueue.length = 0
      }
    }
  })

  if (window.__echo_net_hook_installed) {
    console.log("[Interceptor] Hooks already installed, skipping")
    return
  }

  window.__echo_net_hook_installed = true
  console.log("[Interceptor] Installing fetch/XHR hooks")
  installFetchHook()
  installXhrHook()
  console.log("[Interceptor] Hooks installed successfully")
}

if (typeof window !== "undefined") {
  installNetworkInterceptor(
    CHATGPT_ENDPOINTS.CONVERSATION_DETAIL_PREFIX,
    CHATGPT_ENDPOINTS.CONVERSATIONS_LIST,
    CLAUDE_ENDPOINTS.ORG_API_PREFIX,
    YOUTUBE_ENDPOINTS.GET_TRANSCRIPT
  )
}
