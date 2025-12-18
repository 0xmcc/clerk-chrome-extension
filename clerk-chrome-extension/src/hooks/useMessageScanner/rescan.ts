import type { Conversation, CapturedPlatform, InterceptorEvent } from "./types"
import { getActiveConversationIdFromUrl, now } from "./utils"
import { getClaudeOrgId } from "./store"

export const INTERCEPTOR_SOURCE = "__echo_network_interceptor__"

export interface RescanHandlerDeps {
  capturedPlatform: CapturedPlatform | null
  flushAllState: () => void
  handleInterceptorEvent: (evt: InterceptorEvent) => void
  storeRef: React.MutableRefObject<Map<string, Conversation>>
}

// Discover Claude orgId by fetching /api/me
const discoverClaudeOrgId = async (): Promise<string | null> => {
  console.log("[rescan] STEP: discoverClaudeOrgId - START")
  try {
    console.log("[rescan] STEP: discoverClaudeOrgId - Fetching /api/me")
    const resp = await fetch("/api/me", {
      credentials: "include",
      headers: { accept: "application/json" }
    })
    console.log("[rescan] STEP: discoverClaudeOrgId - Response status:", resp.status, resp.ok)
    
    if (!resp.ok) {
      console.log("[rescan] STEP: discoverClaudeOrgId - FAILED: Response not OK")
      return null
    }
    
    const data = await resp.json().catch((e) => {
      console.log("[rescan] STEP: discoverClaudeOrgId - FAILED: JSON parse error", e)
      return null
    })
    
    if (!data) {
      console.log("[rescan] STEP: discoverClaudeOrgId - FAILED: No data")
      return null
    }
    
    const orgId = data?.default_organization_id || data?.organization_id || data?.uuid || null
    console.log("[rescan] STEP: discoverClaudeOrgId - SUCCESS", { 
      orgId, 
      hasDefaultOrgId: !!data?.default_organization_id,
      hasOrgId: !!data?.organization_id,
      hasUuid: !!data?.uuid,
      dataKeys: Object.keys(data || {})
    })
    return orgId
  } catch (error) {
    console.error("[rescan] STEP: discoverClaudeOrgId - EXCEPTION", error)
    return null
  }
}

export const createRescanHandler = (deps: RescanHandlerDeps) => {
  const { capturedPlatform, flushAllState, handleInterceptorEvent, storeRef } = deps

  return async () => {
    console.log("[rescan] ========== RESCAN START ==========", { 
      capturedPlatform,
      storeSize: storeRef.current.size,
      storeKeys: Array.from(storeRef.current.keys())
    })
    
    console.log("[rescan] STEP 1: flushAllState")
    flushAllState()

    if (!capturedPlatform) {
      console.log("[rescan] STEP 2: EXIT - No captured platform")
      return
    }
    
    console.log("[rescan] STEP 3: Extracting activeId", { capturedPlatform })
    const activeId = getActiveConversationIdFromUrl(capturedPlatform)
    console.log("[rescan] STEP 3: Result", { activeId, currentPath: window.location.pathname })
    
    if (!activeId) {
      console.log("[rescan] STEP 4: EXIT - No active conversation ID")
      return
    }

    console.log("[rescan] STEP 5: Platform routing", { platform: capturedPlatform, activeId })

    try {
      if (capturedPlatform === "chatgpt") {
        console.log("[rescan] STEP 6: ChatGPT branch")
        const url = `/backend-api/conversation/${activeId}`
        console.log("[rescan] STEP 7: ChatGPT fetch", { url })
        
        const resp = await fetch(url, {
          credentials: "include",
          headers: { accept: "application/json" }
        })
        
        console.log("[rescan] STEP 8: ChatGPT response", { 
          status: resp.status, 
          ok: resp.ok,
          contentType: resp.headers.get("content-type")
        })
        
        if (!resp.ok) {
          console.log("[rescan] STEP 9: EXIT - ChatGPT fetch failed", { status: resp.status, statusText: resp.statusText })
          return
        }
        
        console.log("[rescan] STEP 10: ChatGPT parsing JSON")
        const json = await resp.json().catch((e) => {
          console.log("[rescan] STEP 10: EXIT - ChatGPT JSON parse failed", e)
          return null
        })
        
        if (!json) {
          console.log("[rescan] STEP 11: EXIT - ChatGPT no JSON data")
          return
        }
        
        console.log("[rescan] STEP 12: ChatGPT calling handleInterceptorEvent", {
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
        console.log("[rescan] STEP 13: ChatGPT SUCCESS - handler called")
      }

      if (capturedPlatform === "claude") {
        console.log("[rescan] STEP 6: Claude branch")
        
        console.log("[rescan] STEP 7: Claude orgId discovery - checking cache")
        let orgId = getClaudeOrgId()
        console.log("[rescan] STEP 7a: Cached orgId", { orgId })

        if (!orgId) {
          console.log("[rescan] STEP 7b: Checking store for orgId", { activeId })
          const convo = storeRef.current.get(`claude:${activeId}`)
          orgId = convo?.orgId || null
          console.log("[rescan] STEP 7b: Store result", { 
            hasConvo: !!convo, 
            orgIdFromStore: orgId,
            convoOrgId: convo?.orgId
          })
        }

        if (!orgId) {
          console.log("[rescan] STEP 7c: Attempting API discovery")
          orgId = await discoverClaudeOrgId()
          console.log("[rescan] STEP 7c: API discovery result", { orgId })
        }

        if (!orgId) {
          console.log("[rescan] STEP 8: EXIT - Could not determine Claude orgId", {
            cachedOrgId: getClaudeOrgId(),
            storeSize: storeRef.current.size,
            storeKeys: Array.from(storeRef.current.keys())
          })
          return
        }

        console.log("[rescan] STEP 9: Claude orgId resolved", { orgId, activeId })
        const url = `/api/organizations/${orgId}/conversations/${activeId}`
        console.log("[rescan] STEP 10: Claude fetch", { url })
        
        const resp = await fetch(url, {
          credentials: "include",
          headers: { accept: "application/json" }
        })
        
        console.log("[rescan] STEP 11: Claude response", { 
          status: resp.status, 
          ok: resp.ok,
          contentType: resp.headers.get("content-type")
        })
        
        if (!resp.ok) {
          console.log("[rescan] STEP 12: EXIT - Claude fetch failed", { 
            status: resp.status, 
            statusText: resp.statusText,
            url
          })
          return
        }
        
        console.log("[rescan] STEP 13: Claude parsing JSON")
        const json = await resp.json().catch((e) => {
          console.log("[rescan] STEP 13: EXIT - Claude JSON parse failed", e)
          return null
        })
        
        if (!json) {
          console.log("[rescan] STEP 14: EXIT - Claude no JSON data")
          return
        }
        
        console.log("[rescan] STEP 15: Claude calling handleInterceptorEvent", {
          hasData: !!json,
          dataKeys: Object.keys(json || {}),
          dataType: typeof json
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
        console.log("[rescan] STEP 16: Claude SUCCESS - handler called")
      }
      
      console.log("[rescan] ========== RESCAN COMPLETE ==========")
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
