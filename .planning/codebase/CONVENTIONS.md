# Coding Conventions

**Analysis Date:** 2026-03-20

## Naming Patterns

**Files:**
- Components: PascalCase with `.tsx` extension (e.g., `FloatingButton.tsx`, `SelectiveExporter.tsx`)
- Utilities/hooks: camelCase with `.ts` or `.tsx` extension (e.g., `proxyFetch.ts`, `useViewState.ts`)
- Tests: file name + `.test.ts` or `.test.tsx` (e.g., `proxyFetch.test.ts`, `keyboardPropagation.test.tsx`)
- Config files: kebab-case (e.g., `api.ts`, `endpoints.ts`, `features.ts`)

**Functions:**
- camelCase for all functions and exports
- Event handlers: `handle<EventName>` pattern (e.g., `handleClick`, `handleStorageChange`, `handleProxyFetchMessage`)
- Custom hooks: `use<HookName>` pattern (e.g., `useViewState`, `useMessageScanner`, `useActivityMetrics`)
- Utility functions: descriptive camelCase (e.g., `requestClerkToken`, `sendAgentMailMessage`, `parseProxyFetchUrl`)

**Variables:**
- camelCase for all variable declarations
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `PLASMO_DEBUG`, `PROXY_FETCH_DEV_ALLOWED_HOSTS`, `API_BASE_URL`)
- State variables: camelCase (e.g., `isEnabled`, `isActive`, `view`)
- Boolean variables: `is<Adjective>` or `has<Noun>` prefix (e.g., `isEnabled`, `hasSession`, `hasFullHistory`)

**Types:**
- PascalCase for all types and interfaces
- Props interfaces: `<ComponentName>Props` (e.g., `FloatingButtonProps`, `SelectiveExporterProps`)
- Type suffixes for compound types: `<Name>Result`, `<Name>Message`, `<Name>Options`, etc. (e.g., `ProxyFetchResult`, `ProxyFetchMessage`, `HandleProxyFetchOptions`)
- Branded types: `<Concept><Type>` (e.g., `AgentMailAttachment`, `AgentMailMessage`, `CapturedPlatform`)

## Code Style

**Formatting:**
- Prettier with the following settings (from `.prettierrc.mjs`):
  - Print width: 80 characters
  - Tab width: 2 spaces
  - No semicolons
  - Double quotes (not single)
  - No trailing commas
  - Bracket spacing enabled
  - Bracket on same line

**Linting:**
- No explicit ESLint configuration in the project root (may inherit from Plasmo framework)
- Code uses TypeScript strict mode through `tsconfig.json` extending Plasmo base config

## Import Organization

**Order (enforced by Prettier import sort plugin):**
1. Node.js built-in modules (`import path from "node:path"`)
2. Third-party modules (`import React from "react"`, `import { vi } from "vitest"`)
3. Plasmo framework imports (empty line before)
4. Plasmo HQ imports (`@plasmohq/*`)
5. Path aliases (empty line before) - `~*` maps to `src/*`
6. Relative imports (empty line before) - `./` and `../` paths

**Examples:**
```typescript
// Order illustrated in src/background.ts
import { createClerkClient } from "@clerk/chrome-extension/background"

import { ALL_HOST_PATTERNS, isTargetSite } from "./config/endpoints"
import { IS_DEVELOPMENT } from "./config/features"
import { installNetworkInterceptor } from "./interceptor"
import { debug } from "./utils/debug"
import { handleProxyFetchMessage } from "./utils/proxyFetch"
```

**Path Aliases:**
- `~*` → `src/*` (configured in `tsconfig.json`)
- Used throughout for cleaner imports: `import type { Conversation } from "~hooks/useMessageScanner/types"`

## Error Handling

**Patterns:**
- Throw errors for exceptional cases (invalid state, failed operations):
  ```typescript
  if (!parsedUrl) {
    return { success: false, status: 400, error: "Invalid proxyFetch URL" }
  }
  ```
- Use try-catch blocks for async operations with explicit error messages:
  ```typescript
  try {
    const response = await fetchImpl(parsedUrl.toString(), { ... })
    // ...
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Fetch failed"
    }
  }
  ```
- Return result objects with `{ success, error?, data? }` shape from utility functions (`ProxyFetchResult` pattern)
- Chrome API errors: check `chrome.runtime.lastError` after async callbacks and handle gracefully
- Async function errors: wrap in Promise and resolve with error object instead of rejecting (see `requestClerkSignOut`)

## Logging

**Framework:** Native `console` object (no logging library)

**Patterns:**
- Use the `debug` utility from `src/utils/debug.ts` for tagged debug logging
- `debug.any(tags, ...args)` - logs if ANY tag is enabled
- `debug.all(tags, ...args)` - logs if ALL tags are enabled
- `debug.error(...args)` - always logs errors, not gated by debug flags
- Console.error for critical failures:
  ```typescript
  console.error("[Background] Failed to refresh Clerk:", error)
  ```
- Console.log for user-facing events:
  ```typescript
  console.log("[FloatingButton] Clicked - opening exporter")
  ```

**Debug tag conventions:**
- Functional tags: `["auth"]`, `["clerk"]`, `["token"]`
- Hierarchical tags: `["auth", "clerk", "background"]` - logs if any tag is enabled
- Environment-specific: No production logging of sensitive data

## Comments

**When to Comment:**
- JSDoc blocks for exported functions and public APIs (see `src/utils/clerk.ts` for examples)
- Inline comments for non-obvious logic or workarounds
- No comments for self-documenting code

**JSDoc/TSDoc:**
- Use for all exported functions and utilities
- Include `@param`, `@returns`, `@throws` tags
- Include context/reasoning for non-obvious behavior:
  ```typescript
  /**
   * Clerk stores session JWT with keys containing this fragment
   * (e.g., "clerk.{instance}.session.__clerk_client_jwt")
   */
  const CLERK_STORAGE_KEY_FRAGMENT = "__clerk_client_jwt"
  ```
- Bug documentation: include "Bug:" context in JSDoc (see `src/components/SelectiveExporter/__tests__/keyboardPropagation.test.tsx`)

## Function Design

**Size:** Functions should be small and focused. No strict line limits, but generally under 50 lines for most utilities.

**Parameters:**
- Use named object parameters for functions with multiple arguments (except simple utility functions):
  ```typescript
  export const sendAgentMailMessage = async ({
    fromAddress,
    apiKey,
    ...message
  }: SendAgentMailMessageParams): Promise<void>
  ```
- Type the parameter object explicitly with its own interface/type

**Return Values:**
- Async functions return typed Promises: `Promise<ReturnType>`
- Utility functions return result objects: `{ success, error?, data? }`
- React components return JSX.Element or null
- Hooks return typed objects with clear property names

## Module Design

**Exports:**
- Use named exports exclusively (no default exports)
- Example: `export const functionName = ...` and `export type TypeName = ...`
- Services/utilities export a single primary function plus helper types

**Barrel Files:**
- Used sparingly (e.g., `src/components/SelectiveExporter/hooks/index.ts`)
- Only when grouping closely related exports
- Pattern: `export * from "./useHookName"`

**File organization:**
- One primary export per file (usually a component or hook)
- Helper types in separate `types.ts` files for components
- Utility functions grouped by domain (e.g., `src/utils/` for general utilities)
- Services grouped by feature (e.g., `src/components/SelectiveExporter/services/`)

## React Patterns

**Component Structure:**
- Functional components with hooks (no class components)
- Props interface defined above component:
  ```typescript
  interface FloatingButtonProps {
    onOpenExporter?: () => void
  }

  export const FloatingButton = ({ onOpenExporter }: FloatingButtonProps) => {
    // component body
  }
  ```
- Inline styles for dynamic styling; CSS-in-JS for animations (`@keyframes`)
- No CSS files; Tailwind classes with `plasmo-` prefix for scoping

**Hooks:**
- All hooks are custom hooks, no third-party hook libraries
- State management via `useState` and `useCallback`
- Effect cleanup: always return cleanup function from `useEffect` with proper dependency arrays
- Event handlers wrapped with `useCallback` to prevent unnecessary re-renders

**Chrome APIs:**
- `chrome.storage.*`, `chrome.runtime.*`, `chrome.tabs.*` called directly in components/hooks
- Mock in tests via `vi.fn()` and `vi.mock()` (see test setup)
- Message passing pattern: `chrome.runtime.sendMessage({ action: "...", ... })` with typed result

## TypeScript

**General:**
- Strict mode enabled (via Plasmo base tsconfig)
- Use `type` imports for types: `import type { Type } from "..."`
- Avoid `any` - always provide explicit types
- Use utility types for derived types: `Omit`, `Partial`, `Record`, etc.

**Branded Types Pattern:**
- Service functions are typed with combined parameter/return objects:
  ```typescript
  type SendAgentMailMessageParams = {
    fromAddress: string
    apiKey: string
  } & AgentMailMessage
  ```
