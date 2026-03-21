# Architecture

**Analysis Date:** 2026-03-20

## Pattern Overview

**Overall:** Multi-entry point Chrome extension with event-driven message capture and React-based UI overlays.

**Key Characteristics:**
- Network interceptor captures API responses from ChatGPT/Claude in the MAIN world context
- Content script injects React overlay (SelectiveExporter) into page shadow DOM
- Background service worker manages Clerk authentication and message relay
- Plasmo framework handles build/dev tooling for multiple entry points (popup, content, background)
- Dual distribution: Chrome extension + Spaces web app (shares UI components)

## Layers

**Network Interception Layer:**
- Purpose: Capture conversation data from ChatGPT and Claude APIs before browser processes
- Location: `src/interceptor.ts`, `src/hooks/useMessageScanner/parsers/*`
- Contains: Raw network interceptor code (runs in MAIN world), platform-specific parsers (ChatGPT, Claude)
- Depends on: Window postMessage API, endpoint configuration (`src/config/endpoints.ts`)
- Used by: Content script to establish message flow

**Message Scanner Hook:**
- Purpose: Unified hook managing conversation state, message aggregation, and persistence
- Location: `src/hooks/useMessageScanner/`
- Contains: `useMessageScanner` hook, conversation store, message ingestion pipeline, rescan logic
- Depends on: IndexedDB (via `store.ts`), network interceptor events, platform detection utilities
- Used by: React components (SelectiveExporter, popup, etc.)

**Authentication Layer:**
- Purpose: Manage Clerk session tokens, sync auth state across extension and web
- Location: `src/background.ts`, `src/utils/clerk.ts`
- Contains: Background service worker message handlers, Clerk client lifecycle, token request/refresh logic
- Depends on: `@clerk/chrome-extension` SDK, Chrome storage and messaging APIs
- Used by: All UI components requesting auth tokens via `requestClerkToken()`

**UI Layer:**
- Purpose: Present exporter, settings, and conversation browsing interface
- Location: `src/components/SelectiveExporter/`, `src/features/`, `spaces/`
- Contains: React components (views, hooks, services), tailwind-styled elements
- Depends on: Message scanner hook, capture logic, Supabase for persistence
- Used by: Content script (as overlay), popup window, Spaces web app

**Storage Layer:**
- Purpose: Persist conversations, settings, and auth state
- Location: `src/hooks/useMessageScanner/store.ts`, Chrome storage, IndexedDB, Supabase
- Contains: IndexedDB conversation store, Chrome local storage for settings, Supabase client
- Depends on: IndexedDB API, Chrome storage API, `@supabase/supabase-js`
- Used by: Message scanner hook, export actions, settings management

## Data Flow

**Message Capture Flow:**

1. User visits ChatGPT/Claude and navigates to conversation
2. Background service worker injects network interceptor into MAIN world (via `chrome.scripting.executeScript`)
3. Interceptor detects API calls to conversation endpoints (via `shouldCaptureUrl()`)
4. Interceptor queues messages and posts to window via `postMessage()`
5. Content script listens for `__echo_network_interceptor__` messages
6. Content script triggers `useMessageScanner` hook with `handleInterceptorEvent()`
7. Hook's ingestion pipeline parses response body (ChatGPT list → triggers fetch detail, Claude → direct parse)
8. Parsed messages upserted into Map-based store (`storeRef.current`)
9. `useConversationStore` state updates trigger React re-renders

**Export Flow:**

1. User clicks floating button → `isExporterOpen` state = true
2. SelectiveExporter component calls `useCaptureSource()` hook
3. Capture source resolves conversation mode (structured vs markdown) based on URL/content
4. User selects export format and confirms
5. `useExportActions` serializes selected messages (JSON, Markdown, or agentmail)
6. Export saved to Downloads, cloud storage, or sent via POST to external service

**Authentication Flow:**

1. Popup opens and mounts ClerkProvider
2. ClerkProvider checks session via `clerkClient.load()`
3. If no session in popup but cookies at syncHost: background re-creates client
4. User clicks "Sign In" → opens external auth tab → posts `CLERK_AUTH_COMPLETE` message back
5. Popup re-mounts ClerkProvider with incremented `refreshKey`
6. New ClerkProvider loads updated session
7. Content script requests tokens via `requestClerkToken()` message → background fetches and returns

## Key Abstractions

**Conversation Store (Map-based):**
- Purpose: In-memory store for conversations, persisted to IndexedDB
- Examples: `src/hooks/useMessageScanner/state.ts`, `src/hooks/useMessageScanner/store.ts`
- Pattern: Immutable updates via `upsertMany()`, merges incoming with existing by `${platform}:${id}` key

**Endpoint Configuration (Single Source of Truth):**
- Purpose: Centralize ChatGPT and Claude API endpoint patterns
- Examples: `src/config/endpoints.ts`
- Pattern: `ENDPOINTS` object defines list/detail templates, matchers (matchChatGPTDetail, matchClaudeList), builders (buildChatGPTDetailUrl)

**Message Parser:**
- Purpose: Extract structured messages from API response body
- Examples: `src/hooks/useMessageScanner/parsers/chatgpt.ts`, `src/hooks/useMessageScanner/parsers/claude.ts`
- Pattern: Platform-specific parse functions return array of `Message` objects (id, role, text, authorName, node)

**Ingestion Pipeline:**
- Purpose: Orchestrate parsing, merging, and storage of incoming API responses
- Examples: `src/hooks/useMessageScanner/ingestion.ts`
- Pattern: Async pipeline triggered by interceptor event, handles ChatGPT list→detail fetches, deduplication

**View State Manager:**
- Purpose: Track UI mode (export, settings, index, analysis)
- Examples: `src/components/SelectiveExporter/hooks/useViewState.ts`
- Pattern: Single `view` enum state with navigation helpers (goToExport, goToSettings, etc.)

## Entry Points

**Content Script (Overlay):**
- Location: `src/content.tsx`
- Triggers: Auto-injects on pages matching `http://*/*`, `https://*/*`
- Responsibilities:
  - Mount floating button via PlasmoOverlay component
  - Render SelectiveExporter in shadow DOM
  - Listen for network interceptor messages
  - Manage message scanner hook

**Background Service Worker:**
- Location: `src/background.ts`
- Triggers: Loads on extension startup, listens to chrome.runtime.onMessage
- Responsibilities:
  - Manage Clerk client lifecycle
  - Inject network interceptor into tabs
  - Handle token requests, sign out, auth refresh
  - Proxy fetch requests for CORS bypass

**Popup Window:**
- Location: `src/popup.tsx`
- Triggers: Click extension icon
- Responsibilities:
  - Display auth state
  - Provide quick counter demo
  - Trigger auth refresh on opening (limited by same-origin restrictions)

**Options Page:**
- Location: `src/options.tsx`
- Triggers: Right-click extension → Options
- Responsibilities: Settings management (minimal, mostly stub)

**Spaces Web App:**
- Location: `spaces/SpacesApp.tsx`
- Triggers: Standalone web deployment
- Responsibilities:
  - Reuse SelectiveExporter and UI components
  - Multi-page routing (landing, signup, workspace, etc.)
  - Transformation and analysis flows

**Web Sync Service:**
- Location: `web/src/main.tsx`
- Triggers: Vite dev/build entry
- Responsibilities: Extension auth sync landing page

## Error Handling

**Strategy:** Layered error handling with debug instrumentation.

**Patterns:**
- Background auth errors logged via `debug.any()` and caught/returned as response objects to content script
- Message parser errors logged but don't crash pipeline (empty messages returned)
- Network errors in ingestion pipeline trigger rescan with cooldown to retry
- Supabase/export errors logged and shown to user via toast/modal (pending implementation)
- Chrome API errors checked via `chrome.runtime.lastError` before proceeding

## Cross-Cutting Concerns

**Logging:**
- Custom `debug.ts` utility with categorized logging (`["auth", "clerk", "messages", "interceptor"]`)
- Development-only logs for sensitive flows (auth state, token operations)
- Performance timing via `performance.now()` instrumentation

**Validation:**
- Endpoint pattern matching via regex matchers (endpoints.ts)
- Platform inference from URL pathname patterns
- Message role validation (must be one of: "user", "assistant", "system", "tool")

**Authentication:**
- Clerk SDK manages session lifecycle (auto-refresh every 60s in background)
- Token stored in Chrome storage keyed by Clerk instance
- Popup auth only updates on reopen (requires manual refresh or external tab completion)

---

*Architecture analysis: 2026-03-20*
