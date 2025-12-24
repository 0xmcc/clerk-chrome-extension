# Message Scanner Flow & Pitfalls Documentation

## Overview

This document describes the message scanning architecture, the flow of data capture, and critical pitfalls encountered during development.

## Architecture Flow

### 1. Interceptor Layer (Network Hooks)

**Files:** `src/interceptor.ts`, `src/background.ts`

**Purpose:** Intercept network requests at the browser level before they reach the page.

**Flow:**
```
Page makes fetch/XHR request
  ↓
Interceptor hooks installed (document_start or tab complete)
  ↓
shouldCapture() checks URL pattern
  ↓
If matches → Clone response, parse body, postMessage to content script
  ↓
Content script receives message
```

**Key Functions:**
- `shouldCapture(urlStr)`: Determines which URLs to capture
- `installFetchHook()`: Patches `window.fetch`
- `installXhrHook()`: Patches `XMLHttpRequest`
- `post(payload)`: Sends intercepted data via `window.postMessage`

### 2. Content Script Layer

**File:** `src/hooks/useMessageScanner/useMessageScanner.ts`

**Purpose:** React hook that listens for intercepted messages and manages scanning state.

**Flow:**
```
useMessageScanner hook initializes
  ↓
Sets up message listener (window.addEventListener("message"))
  ↓
Receives InterceptorEvent from interceptor
  ↓
Calls handleInterceptorEvent()
  ↓
Handler processes event (extracts data, updates store)
```

**Key Functions:**
- `handleInterceptorEvent(evt)`: Processes intercepted network events
- `rescan()`: Manually fetches conversation data when store is empty

### 3. Handler Layer

**File:** `src/hooks/useMessageScanner/handlers.ts`

**Purpose:** Platform-specific logic for processing intercepted events.

**Flow:**
```
Handler receives InterceptorEvent
  ↓
Infer platform from URL (ChatGPT/Claude)
  ↓
Extract metadata (orgId for Claude)
  ↓
Match URL pattern (list vs detail endpoint)
  ↓
Parse response data
  ↓
Update store via upsertMany()
```

**Key Functions:**
- `createInterceptorEventHandler()`: Creates handler with dependencies
- `extractOrgIdFromUrl()`: Extracts Claude orgId from URL pathname
- Platform-specific parsers: `parseClaudeList()`, `parseClaudeDetail()`, etc.

### 4. Rescan Layer

**File:** `src/hooks/useMessageScanner/rescan.ts`

**Purpose:** Fallback mechanism to fetch conversation data when interceptor missed it.

**Flow:**
```
Exporter opens → Store empty → Trigger rescan
  ↓
Get active conversation ID from URL
  ↓
Discover orgId (cache → store → API)
  ↓
Fetch conversation endpoint
  ↓
Process response through handler
```

**Key Functions:**
- `createRescanHandler()`: Creates rescan handler
- `discoverClaudeOrgId()`: Attempts to find orgId via API
- Tries both endpoint formats: `/conversations/` and `/chat_conversations/`

## Critical Pitfalls & Solutions

### Pitfall #1: Timing Race Condition - Extension Loads After API Calls

**Problem:**
- Claude page loads and fetches conversation data immediately (T=0.1s)
- Extension injects interceptor later (T=0.3-0.5s)
- Conversation endpoints called before extension ready → **MISSED**
- Store remains empty → Rescan fails

**Symptoms:**
- Store empty when exporter opens
- Rescan triggered but fails
- No messages in sidemenu

**Root Cause:**
```
Timeline:
T=0.0s: Page starts loading
T=0.1s: Claude fetches /api/organizations/{orgId}/conversations/{uuid} ← MISSED
T=0.3s: Extension injects interceptor
T=0.5s: Interceptor ready
T=0.6s: Exporter opens → Store empty → Rescan fails
```

**Solution:**
1. **Rescan mechanism** - When store is empty, manually fetch conversation data
2. **Dual endpoint support** - Try both `/conversations/` and `/chat_conversations/` formats
3. **orgId caching** - Extract orgId from ANY organization URL (not just conversations)

**Code Changes:**
- `rescan.ts`: Added endpoint fallback logic (lines 169-205)
- `rescan.ts`: Added orgId discovery with multiple fallback methods

---

### Pitfall #2: orgId Not Cached - Only Conversation Endpoints Captured

**Problem:**
- `shouldCapture()` only captured conversation endpoints
- Other org URLs like `/api/organizations/{orgId}/feature_settings` were checked but not captured
- Handler extracts orgId from URLs, but only sees captured requests
- Result: orgId never cached → Rescan fails with "Could not determine Claude orgId"

**Symptoms:**
```
[rescan] STEP 7a: Cached orgId {orgId: null}
[rescan] STEP 8: EXIT - Could not determine Claude orgId
```

**Root Cause:**
```typescript
// OLD CODE - Only captured conversation endpoints
if (/^\/api\/organizations\/[^/]+\/(chat_)?conversations(\/[^/]+)?$/.test(p)) {
  return true
}
// Other org URLs like /feature_settings were checked but not captured
```

**Solution:**
Capture ALL `/api/organizations/` URLs, let handler filter:

```typescript
// NEW CODE - Capture all org URLs
if (p.startsWith("/api/organizations/")) {
  return true
}
```

Handler already extracts orgId from any Claude org URL (line 119-122), then filters conversation endpoints for full processing.

**Code Changes:**
- `background.ts` line 104: Changed to `p.startsWith("/api/organizations/")`
- `interceptor.ts` line 46: Should be updated to match (currently still old logic)

**Architecture Benefit:**
- Interceptor stays generic (no platform-specific logic)
- Handler owns all platform-specific filtering
- Single Responsibility Principle maintained

---

### Pitfall #3: Claude Uses Two Endpoint Formats

**Problem:**
- Claude API uses both `/conversations/` and `/chat_conversations/` formats
- Rescan only tried one format → 404 errors
- Different conversations use different formats

**Symptoms:**
```
GET /api/organizations/{orgId}/conversations/{uuid} 404 (Not Found)
[rescan] STEP 12: EXIT - Claude fetch failed
```

**Root Cause:**
```typescript
// OLD CODE - Only tried one format
const url = `/api/organizations/${orgId}/conversations/${activeId}`
```

**Solution:**
Try both endpoint formats with fallback:

```typescript
// NEW CODE - Try both formats
const endpoints = [
  `/api/organizations/${orgId}/conversations/${activeId}`,
  `/api/organizations/${orgId}/chat_conversations/${activeId}`
]

for (const url of endpoints) {
  const resp = await fetch(url, ...)
  if (resp.ok) break // Found working endpoint
}
```

**Code Changes:**
- `rescan.ts` lines 169-205: Added endpoint fallback loop

---

### Pitfall #4: Redundant Interceptor Implementations

**Problem:**
- Two interceptor implementations: `interceptor.ts` (content script) and `background.ts` (injected)
- Both have `shouldCapture()` with different logic
- `interceptor.ts` runs at `document_start` (earlier)
- `background.ts` runs on tab `"complete"` (later, usually skipped due to `__echo_net_hook_installed` check)
- Inconsistency risk: different logic in each

**Symptoms:**
- Confusion about which interceptor is active
- Potential for logic drift between implementations

**Root Cause:**
```typescript
// interceptor.ts - Content script, runs at document_start
if (p.includes("/api/organizations/") && (p.includes("/chat_conversations") || p.includes("/conversations"))) {
  return true
}

// background.ts - Injected script, runs on tab complete
if (p.startsWith("/api/organizations/")) {
  return true
}
```

**Solution:**
1. **Immediate:** Update `interceptor.ts` to match `background.ts` logic
2. **Future:** Consider removing redundant `background.ts` interceptor (since `interceptor.ts` runs first)

**Code Changes Needed:**
- `interceptor.ts` line 46: Update to `p.startsWith("/api/organizations/")`

---

### Pitfall #5: orgId Discovery Fallback Chain

**Problem:**
- Rescan needs orgId but it might not be cached
- Multiple fallback methods needed
- `/api/me` endpoint returns 404 (doesn't exist)

**Symptoms:**
```
[rescan] STEP: discoverClaudeOrgId - Fetching /api/me
GET /api/me 404 (Not Found)
[rescan] STEP 7c: API discovery result {orgId: null}
```

**Solution:**
Multi-tier fallback chain:

1. **Cache check** - `getClaudeOrgId()` from store
2. **Store check** - Extract from existing conversation in store
3. **Performance API** - Query past network requests (retroactive)
4. **API discovery** - Try `/api/me` (currently fails, but kept as fallback)

**Code Changes:**
- `rescan.ts` lines 137-155: Multi-tier orgId discovery
- `discoverClaudeOrgId()`: Should add Performance API check (currently only tries `/api/me`)

---

## Key Learnings

### 1. Timing is Critical
- Extension injection timing vs page load timing
- Always assume critical API calls happen before extension is ready
- Rescan mechanism is essential, not optional

### 2. Capture Broader, Filter Later
- Better to capture more URLs and filter in handler
- Keeps interceptor generic, handler owns platform logic
- Performance trade-off acceptable for MVP

### 3. Platform APIs Are Inconsistent
- Claude uses multiple endpoint formats
- Always implement fallback logic
- Don't assume single endpoint format

### 4. Metadata Extraction Should Be Separate
- Extract orgId from ANY org URL (not just conversations)
- Handler should extract metadata before filtering
- Enables rescan to work even when conversations missed

### 5. Avoid Redundancy
- Two interceptors create maintenance burden
- Keep implementations in sync or remove redundancy
- Document which one is primary

## Current State

### Working:
✅ orgId caching from all org URLs  
✅ Rescan with dual endpoint fallback  
✅ Handler extracts orgId before filtering  
✅ Messages appear in sidemenu when captured  

### Needs Attention:
⚠️ `interceptor.ts` still has old `shouldCapture` logic (should match `background.ts`)  
⚠️ Redundant interceptor implementations  
⚠️ `discoverClaudeOrgId()` could use Performance API fallback  

## Recommended Next Steps

1. **Update `interceptor.ts`** to match `background.ts` logic
2. **Add Performance API fallback** to `discoverClaudeOrgId()`
3. **Consider removing** redundant `background.ts` interceptor (if `interceptor.ts` is sufficient)
4. **Add tests** for rescan endpoint fallback logic
5. **Document** which interceptor is primary



Perfect Prompt: Implement Network-Based Message Scanner for Chrome Extension
Context
Build a Chrome extension that captures conversation messages from ChatGPT and Claude.ai by intercepting network requests. The extension must work even when:
The page loads before the extension is ready
Users navigate to already-loaded conversations
The extension is installed after the page has loaded
Requirements
1. Network Interception Architecture
Create a 4-layer architecture:
Layer 1: Interceptor (Generic)
File: src/interceptor.ts (content script, runs at document_start)
Patch window.fetch and XMLHttpRequest in MAIN world
Implement shouldCapture(urlStr) that captures:
ChatGPT: All /backend-api/conversation/ and /backend-api/conversations URLs
Claude: ALL /api/organizations/ URLs (not just conversations - see critical note below)
Clone response bodies, parse JSON, send via window.postMessage to content script
Use __echo_net_hook_installed flag to prevent double-install on SPA navigation
Layer 2: Content Script (React Hook)
File: src/hooks/useMessageScanner/useMessageScanner.ts
Listen for window.postMessage events from interceptor
Manage scanning state (enabled when exporter UI opens)
Route intercepted events to handler layer
Layer 3: Handler (Platform-Specific)
File: src/hooks/useMessageScanner/handlers.ts
Extract platform from URL (ChatGPT vs Claude)
For Claude: Extract orgId from ANY /api/organizations/{orgId}/... URL and cache it
Filter URLs: Process conversation endpoints fully, return early for others
Parse response data using platform-specific parsers
Update shared store via upsertMany()
Layer 4: Rescan (Fallback)
File: src/hooks/useMessageScanner/rescan.ts
Trigger when exporter opens and store is empty
Multi-tier orgId discovery:
Check cache (getClaudeOrgId())
Check store for existing conversation
Query Performance API for past requests (retroactive)
Try API discovery (fallback)
Fetch conversation with dual endpoint support (see critical note)
2. Critical Design Decisions
A. Capture Broader, Filter Later
Interceptor MUST capture ALL /api/organizations/ URLs for Claude (not just /conversations)
Handler extracts orgId from any org URL, then filters conversation endpoints
Rationale: orgId appears in URLs like /feature_settings that are called after page load
This keeps interceptor generic, handler owns platform logic
B. Rescan is Essential, Not Optional
Assume conversation endpoints are called before extension is ready (timing race condition)
Rescan must work even when interceptor missed initial requests
Implement as first-class feature, not afterthought
C. Claude Endpoint Format Inconsistency
Claude uses BOTH /conversations/ and /chat_conversations/ formats
Rescan must try both formats with fallback
Don't assume single endpoint format
D. orgId Caching Strategy
Extract orgId from ANY organization URL (not just conversations)
Cache immediately when extracted (enables rescan)
Store in module-level singleton (src/hooks/useMessageScanner/store.ts)
3. Implementation Details
Interceptor (shouldCapture function):
// ChatGPT endpoints
if (p.startsWith("/backend-api/conversation/") || p === "/backend-api/conversations") {
  return true
}

// Claude: Capture ALL org URLs (handler will filter)
if (p.startsWith("/api/organizations/")) {
  return true
}
// ChatGPT endpointsif (p.startsWith("/backend-api/conversation/") || p === "/backend-api/conversations") {  return true}// Claude: Capture ALL org URLs (handler will filter)if (p.startsWith("/api/organizations/")) {  return true}
Handler (orgId extraction):
// Extract orgId from ANY Claude org URL (before filtering)
if (inferred === "claude") {
  const extractedOrgId = extractOrgIdFromUrl(url.pathname)
  if (extractedOrgId) {
    setClaudeOrgId(extractedOrgId) // Cache immediately
  }
  
  // Then filter: only process conversation endpoints fully
  if (matchClaudeList(url) || matchClaudeDetail(url)) {
    // Process conversation data
  } else {
    return // Early return for non-conversation endpoints
  }
}
// Extract orgId from ANY Claude org URL (before filtering)if (inferred === "claude") {  const extractedOrgId = extractOrgIdFromUrl(url.pathname)  if (extractedOrgId) {    setClaudeOrgId(extractedOrgId) // Cache immediately  }    // Then filter: only process conversation endpoints fully  if (matchClaudeList(url) || matchClaudeDetail(url)) {    // Process conversation data  } else {    return // Early return for non-conversation endpoints  }}
Rescan (dual endpoint support):
const endpoints = [
  `/api/organizations/${orgId}/conversations/${activeId}`,
  `/api/organizations/${orgId}/chat_conversations/${activeId}`
]

for (const url of endpoints) {
  const resp = await fetch(url, ...)
  if (resp.ok) {
    // Process response
    break
  }
}
const endpoints = [  `/api/organizations/${orgId}/conversations/${activeId}`,  `/api/organizations/${orgId}/chat_conversations/${activeId}`]for (const url of endpoints) {  const resp = await fetch(url, ...)  if (resp.ok) {    // Process response    break  }}
4. Edge Cases to Handle
Extension loads after page API calls → Rescan fetches missed data
orgId not in conversation URLs → Extract from other org URLs
Claude endpoint format varies → Try both formats
Store empty on exporter open → Trigger rescan automatically
SPA navigation → Prevent double-install, maintain state
5. Architecture Principles
Single Responsibility: Interceptor = generic capture, Handler = platform logic
Separation of Concerns: No platform-specific code in interceptor
Fail-Safe Design: Rescan as fallback, not primary path
Performance: Acceptable to capture more URLs (handler filters quickly)
6. Testing Scenarios
Fresh page load → Extension ready before API calls
Already-loaded page → Extension injects after API calls
SPA navigation → State maintained, no double-install
Different Claude endpoint formats → Both work
orgId from non-conversation URLs → Cached correctly
Expected Outcome
Messages captured from network requests
Works on fresh page loads and already-loaded pages
orgId discovered and cached reliably
Rescan works as fallback when interceptor misses requests
Clean architecture with clear separation of concerns
This prompt includes the pitfalls discovered during development, so the implementation should avoid them from the start.
