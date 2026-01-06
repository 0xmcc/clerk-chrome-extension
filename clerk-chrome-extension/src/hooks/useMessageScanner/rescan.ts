import type { Conversation, CapturedPlatform, InterceptorEvent } from "./types"
import { getActiveConversationIdFromUrl, now } from "./utils"
import { getClaudeOrgId, getChatGPTAuthToken, setChatGPTAuthToken } from "./store"
import { buildChatGPTDetailUrl, buildClaudeDetailUrls } from "../../config/endpoints"
import { debug } from "~utils/debug"

export const INTERCEPTOR_SOURCE = "__echo_network_interceptor__"

// Instrumentation helper for rescan flow tracking
function logRescan(step: string, details?: Record<string, unknown>) {
  debug.any(["messages", "rescan"], step, details ?? "")
}

// Fetch with retry logic - returns Response or null, skips retries on 404
const fetchWithRetry = async (
  url: string,
  maxRetries = 2,
  baseDelay = 300
): Promise<Response | null> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = baseDelay * Math.pow(2, attempt - 1)
      logRescan(`Retry ${attempt}/${maxRetries} for ${url}, waiting ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    try {
      const resp = await fetch(url, {
        credentials: "include",
        headers: { accept: "application/json" }
      })
      logRescan("fetchWithRetry", { url, status: resp.status, ok: resp.ok, attempt })

      if (resp.ok || resp.status === 404) return resp
    } catch (error) {
      logRescan("fetchWithRetry error", { url, error, attempt })
    }
  }
  return null
}

export interface RescanHandlerDeps {
  capturedPlatform: CapturedPlatform | null
  updateAllDerivedState: () => void
  handleInterceptorEvent: (evt: InterceptorEvent) => void
  storeRef: React.MutableRefObject<Map<string, Conversation>>
}

// Discover Claude orgId from page's __NEXT_DATA__ (Next.js embeds this on all pages)
const discoverClaudeOrgId = (): string | null => {
  logRescan("discoverClaudeOrgId - START")

  // Try __NEXT_DATA__ script tag (always present on Claude pages)
  try {
    const nextDataScript = document.getElementById("__NEXT_DATA__")
    if (nextDataScript?.textContent) {
      const data = JSON.parse(nextDataScript.textContent)
      const orgId = data?.props?.pageProps?.organizationId
      if (orgId) {
        logRescan("discoverClaudeOrgId - Found in __NEXT_DATA__", { orgId })
        return orgId
      }
    }
  } catch (e) {
    logRescan("discoverClaudeOrgId - __NEXT_DATA__ parse error", { error: e })
  }

  // Try window.__NEXT_DATA__ global (Next.js also exposes it on window)
  try {
    const win = window as any
    if (win.__NEXT_DATA__?.props?.pageProps?.organizationId) {
      const orgId = win.__NEXT_DATA__.props.pageProps.organizationId
      logRescan("discoverClaudeOrgId - Found in window.__NEXT_DATA__", { orgId })
      return orgId
    }
  } catch (e) {
    logRescan("discoverClaudeOrgId - window check error", { error: e })
  }

  logRescan("discoverClaudeOrgId - No orgId found")
  return null
}

// Helper to hunt for the token in DOM scripts (matches your successful console test)
const extractChatGPTAuthTokenFromDOM = (): string | null => {
  try {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      if (script.textContent && script.textContent.includes('"accessToken":"ey')) {
        const match = script.textContent.match(/"accessToken":"(eyJ[^"]+)"/);
        if (match && match[1]) {
          logRescan("Found auth token in DOM script tag");
          return match[1];
        }
      }
    }
  } catch (e) {
    console.warn("[rescan] DOM token extraction failed", e);
  }
  return null;
};

export const createRescanHandler = (deps: RescanHandlerDeps) => {
  const { capturedPlatform, updateAllDerivedState, handleInterceptorEvent, storeRef } = deps

  return async () => {
    logRescan("========== RESCAN START ==========", {
      capturedPlatform,
      storeSize: storeRef.current.size,
      storeKeys: Array.from(storeRef.current.keys())
    })

    logRescan("STEP 1: updateAllDerivedState")
    updateAllDerivedState()

    if (!capturedPlatform) {
      logRescan("STEP 2: EXIT - No captured platform")
      return
    }

    logRescan("STEP 3: Extracting activeId", { capturedPlatform })
    const activeId = getActiveConversationIdFromUrl(capturedPlatform)
    logRescan("STEP 3: Result", { activeId, currentPath: window.location.pathname })

    if (!activeId) {
      logRescan("STEP 4: EXIT - No active conversation ID")
      return
    }

    logRescan("STEP 5: Platform routing", { platform: capturedPlatform, activeId })

    try {
      if (capturedPlatform === "chatgpt") {
        logRescan("STEP 6: ChatGPT branch")
        const url = buildChatGPTDetailUrl(activeId)
        logRescan("STEP 7: ChatGPT fetch", { url })

        // STRATEGY: 1. Try Cache, 2. Try DOM, 3. Give up
        let authToken = getChatGPTAuthToken()

        if (!authToken) {
           logRescan("Cache empty. Attempting DOM extraction...")
           authToken = extractChatGPTAuthTokenFromDOM()
           logRescan("DOM auth token extraction result", { hasToken: !!authToken })
           if (authToken) {
             // Cache it for next time so we don't have to parse DOM every time
             setChatGPTAuthToken(authToken)
           }
        }

        const headers: Record<string, string> = {
          "accept": "*/*",
          "accept-language": "en-US,en;q=0.9",
          "referer": window.location.href,
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
        }

        if (authToken) {
          headers["authorization"] = `Bearer ${authToken}`
          logRescan("Using Auth Token", { length: authToken.length })
        } else {
          logRescan("CRITICAL WARNING: No ChatGPT auth token found in Cache OR DOM. Request will likely 404.")
        }

        logRescan("Request details", {
          url,
          method: "GET",
          hasAuth: !!authToken,
          headerKeys: Object.keys(headers),
          referer: headers["referer"]
        })

        // Match ChatGPT's request headers to avoid 404 - explicitly set method
        const resp = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers
        })

        logRescan("STEP 8: ChatGPT response", {
          status: resp.status,
          ok: resp.ok,
          contentType: resp.headers.get("content-type")
        })

        if (!resp.ok) {
          logRescan("STEP 9: EXIT - ChatGPT fetch failed", { status: resp.status, statusText: resp.statusText })
          return
        }

        logRescan("STEP 10: ChatGPT parsing JSON")
        const json = await resp.json().catch((e) => {
          logRescan("STEP 10: EXIT - ChatGPT JSON parse failed", { error: e })
          return null
        })

        if (!json) {
          logRescan("STEP 11: EXIT - ChatGPT no JSON data")
          return
        }

        logRescan("STEP 12: ChatGPT calling handleInterceptorEvent", {
          hasData: !!json,
          dataKeys: Object.keys(json || {})
        })
        handleInterceptorEvent({
          source: INTERCEPTOR_SOURCE,
          url: new URL(url, window.location.origin).href,
          method: "GET",
          status: resp.status,
          ok: resp.ok,
          ts: now(),
          data: json
        })
        logRescan("STEP 13: ChatGPT SUCCESS - handler called")
      }

      if (capturedPlatform === "claude") {
        logRescan("STEP 6: Claude branch")

        logRescan("STEP 7: Claude orgId discovery - checking cache")
        let orgId = getClaudeOrgId()
        logRescan("STEP 7a: Cached orgId", { orgId })

        if (!orgId) {
          logRescan("STEP 7b: Checking store for orgId", { activeId })
          const convo = storeRef.current.get(`claude:${activeId}`)
          orgId = convo?.orgId || null
          logRescan("STEP 7b: Store result", {
            hasConvo: !!convo,
            orgIdFromStore: orgId,
            convoOrgId: convo?.orgId
          })
        }

        if (!orgId) {
          logRescan("STEP 7c: Extracting from page data")
          orgId = discoverClaudeOrgId()
          logRescan("STEP 7c: Page extraction result", { orgId })
        }

        if (!orgId) {
          logRescan("STEP 8: EXIT - Could not determine Claude orgId", {
            cachedOrgId: getClaudeOrgId(),
            storeSize: storeRef.current.size,
            storeKeys: Array.from(storeRef.current.keys())
          })
          return
        }

        logRescan("STEP 9: Claude orgId resolved", { orgId, activeId })

        // Try both endpoint formats (Claude uses both) - patterns from centralized config
        const endpoints = buildClaudeDetailUrls(orgId, activeId)

        let resp: Response | null = null
        let lastError: string | null = null
        const MAX_RETRIES = 2
        const BASE_DELAY = 300

        for (const url of endpoints) {
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
              const delay = BASE_DELAY * Math.pow(2, attempt - 1) // 300ms, 600ms
              logRescan(`Retry ${attempt}/${MAX_RETRIES} for ${url}, waiting ${delay}ms`)
              await new Promise(resolve => setTimeout(resolve, delay))
            }

            logRescan("STEP 10: Claude fetch attempt", { url, attempt })

            try {
              resp = await fetch(url, {
                credentials: "include",
                headers: { accept: "application/json" }
              })

              logRescan("STEP 11: Claude response", {
                url,
                status: resp.status,
                ok: resp.ok,
                contentType: resp.headers.get("content-type"),
                attempt
              })

              if (resp.ok) {
                logRescan("STEP 11a: Success with endpoint", { url })
                break // Found working endpoint
              } else if (resp.status === 404) {
                logRescan("STEP 11b: 404 - endpoint doesn't exist, skipping retries", { url })
                lastError = `${url} returned 404`
                break // Don't retry 404s
              } else {
                lastError = `${url} returned ${resp.status}`
                logRescan("STEP 11b: Endpoint failed", { url, status: resp.status, attempt })
              }
            } catch (error) {
              lastError = `${url} threw ${error}`
              logRescan("STEP 11c: Endpoint error", { url, error, attempt })
            }
          }

          if (resp?.ok) break // Exit endpoint loop if successful
        }

        if (!resp || !resp.ok) {
          logRescan("STEP 12: EXIT - All Claude endpoints failed after retries", {
            endpoints,
            lastError,
            maxRetries: MAX_RETRIES
          })
          return
        }

        // Continue with existing logic using the successful resp
        logRescan("STEP 13: Claude parsing JSON")
        const json = await resp.json().catch((e) => {
          logRescan("STEP 13: EXIT - Claude JSON parse failed", { error: e })
          return null
        })

        if (!json) {
          logRescan("STEP 14: EXIT - Claude no JSON data")
          return
        }

        logRescan("STEP 15: Claude calling handleInterceptorEvent", {
          hasData: !!json,
          dataKeys: Object.keys(json || {}),
          dataType: typeof json
        })
        handleInterceptorEvent({
          source: INTERCEPTOR_SOURCE,
          url: new URL(resp.url, window.location.origin).href, // Use resp.url for the final URL
          method: "GET",
          status: resp.status,
          ok: resp.ok,
          ts: now(),
          data: json
        })
        logRescan("STEP 16: Claude SUCCESS - handler called")
      }

      logRescan("========== RESCAN COMPLETE ==========")
    } catch (error) {
      console.error("[rescan] ========== RESCAN EXCEPTION ==========", error)
      console.error("[rescan] Exception details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        capturedPlatform,
        activeId: getActiveConversationIdFromUrl(capturedPlatform || "claude")
      })
    }
  }
}
