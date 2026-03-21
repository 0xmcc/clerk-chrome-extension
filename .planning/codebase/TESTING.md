# Testing Patterns

**Analysis Date:** 2026-03-20

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`
- Environment: jsdom (browser-like environment)
- Setup file: `test/setup.ts`

**Assertion Library:**
- Vitest built-in assertions (no separate library)
- @testing-library/react for component testing
- @testing-library/jest-dom for DOM matchers

**Run Commands:**
```bash
pnpm test              # Run all tests once
pnpm test:watch       # Watch mode for development
```

## Test File Organization

**Location:**
- Co-located with source files (same directory as implementation)
- Example: `src/utils/proxyFetch.ts` paired with `src/utils/proxyFetch.test.ts`
- Component tests: `src/components/SelectiveExporter/__tests__/keyboardPropagation.test.tsx`

**Naming:**
- `<filename>.test.ts` for TypeScript files
- `<filename>.test.tsx` for React components
- Test files live in same directory or `__tests__` subdirectory

**Structure:**
```
src/
├── components/
│   └── SelectiveExporter/
│       └── __tests__/
│           └── keyboardPropagation.test.tsx
├── utils/
│   ├── proxyFetch.ts
│   └── proxyFetch.test.ts
├── hooks/
│   └── useMessageScanner/
│       └── ingestion.test.ts
└── lib/
    ├── capture.ts
    └── capture.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it, vi } from "vitest"

describe("feature name or module name", () => {
  beforeEach(() => {
    // Setup before each test
  })

  afterEach(() => {
    // Cleanup after each test
  })

  it("should do specific thing", () => {
    // Arrange
    const input = setupData()

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toBe(expected)
  })
})
```

**Patterns:**
- Setup: `beforeEach()` for common test fixtures; module-level constants for shared data
- Teardown: `afterEach()` for cleanup (see `test/setup.ts` for global cleanup)
- Assertion: Direct `expect()` calls; use @testing-library matchers for DOM

## Mocking

**Framework:**
- Vitest's `vi` module for mocking and stubbing
- `vi.fn()` for function mocks
- `vi.mock()` for module mocking (hoisted auto-mocking)
- `vi.stub()` for global stubs

**Patterns:**

Module mocking with hoisted factory:
```typescript
const { createClerkClientMock, executeScriptMock } = vi.hoisted(() => ({
  createClerkClientMock: vi.fn(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    session: null
  })),
  executeScriptMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock("@clerk/chrome-extension/background", () => ({
  createClerkClient: createClerkClientMock
}))
```

Function mocking with return values:
```typescript
const fetchImpl = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  text: vi.fn().mockResolvedValue(JSON.stringify({ id: "msg_123" }))
})
```

Chrome API stubbing (see `test/setup.ts`):
```typescript
const createChromeMock = () => ({
  runtime: {
    sendMessage: vi.fn(),
    getManifest: vi.fn(() => ({
      name: "MomentumAI Test",
      version: "1.0.0"
    }))
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn()
    }
  }
  // ... other Chrome APIs
})

beforeEach(() => {
  vi.stubGlobal("chrome", createChromeMock())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
```

**What to Mock:**
- External APIs (fetch, Chrome APIs, third-party SDKs)
- Side effects (storage, messaging, DOM operations)
- Slow operations (network requests, timers)

**What NOT to Mock:**
- Core business logic (parsing, validation, data transformation)
- Internal function calls within the same module
- Pure utility functions (unless testing integration)

## Fixtures and Factories

**Test Data:**

Simple object patterns:
```typescript
await handleProxyFetchMessage({
  url: "https://api.agentmail.to/v0/inboxes/sender%40example.com/messages/send",
  method: "POST",
  headers: {
    Authorization: "Bearer secret-key",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ subject: "AI Handoff Test" })
})
```

Factory functions (implicit in setup):
```typescript
const createChromeMock = () => ({
  // returns a fresh mock object
})
```

**Location:**
- Inline in test files (co-located with tests)
- Factories defined at module level in `beforeEach()` or top-level
- No separate fixture files

## Coverage

**Requirements:** No explicit coverage enforcer configured

**View Coverage:**
- No coverage command defined in package.json
- Can run: `vitest run --coverage` if coverage integration is needed

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities (proxyFetch, Clerk auth, AgentMail service)
- Approach: Test function inputs/outputs with mocked dependencies
- Examples:
  - `src/utils/proxyFetch.test.ts` - Tests URL validation, fetch behavior, error handling
  - `src/components/SelectiveExporter/services/agentmail.test.ts` - Tests message serialization, error detection, address normalization

**Integration Tests:**
- Scope: Component interaction with hooks and services
- Approach: Render component with mocked Chrome APIs, simulate user interaction
- Examples:
  - `src/components/SelectiveExporter/__tests__/keyboardPropagation.test.tsx` - Tests event propagation with nested inputs
  - `src/background.test.ts` - Tests background service worker initialization and Clerk client refresh

**E2E Tests:**
- Framework: Not currently used
- Browser automation would use Plasmo's built-in testing support if added

## Common Patterns

**Async Testing:**
```typescript
it("allows AgentMail requests in development and returns parsed JSON", async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(JSON.stringify({ id: "msg_123" }))
  })

  await expect(
    handleProxyFetchMessage(
      { url: "https://api.agentmail.to/...", method: "POST" },
      { fetchImpl, isDevelopment: true }
    )
  ).resolves.toEqual({
    success: true,
    status: 200,
    data: { id: "msg_123" }
  })
})
```

**Error Testing:**
```typescript
it("throws a friendly error when the API returns Inbox not found", async () => {
  chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
    success: false,
    error: "Inbox not found",
    status: 404
  })

  await expect(
    sendAgentMailMessage({
      fromAddress: "me@agentmail.to",
      apiKey: "secret-key",
      to: ["markobot@agentmail.to"],
      subject: "Subject",
      text: "Body"
    })
  ).rejects.toThrow(
    /Inbox not found for your "From" address \(me@agentmail\.to\)/
  )
})
```

**React Component Testing:**
```typescript
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"

describe("SelectiveExporter keyboard event propagation", () => {
  it("stops keyboard events from propagating past the container", () => {
    const parentHandlers = {
      keydown: vi.fn(),
      keyup: vi.fn(),
      keypress: vi.fn(),
    }

    const { getByPlaceholderText } = render(
      <div
        onKeyDown={parentHandlers.keydown}
        onKeyUp={parentHandlers.keyup}
        onKeyPress={parentHandlers.keypress}
      >
        <StopPropagationWrapper>
          <input placeholder="My AI Email" />
        </StopPropagationWrapper>
      </div>
    )

    const input = getByPlaceholderText("My AI Email")
    fireEvent.keyDown(input, { key: "a" })

    expect(parentHandlers.keydown).not.toHaveBeenCalled()
  })
})
```

**Testing with Realistic Mock Values:**
```typescript
it("normalizes From address to lowercase in the inbox URL", async () => {
  const sendMessage = vi.fn().mockResolvedValue({ success: true })
  chrome.runtime.sendMessage = sendMessage

  await sendAgentMailMessage({
    fromAddress: "Markobot@agentmail.to",  // Mixed case
    apiKey: "secret-key",
    to: ["other@example.com"],
    subject: "Subject",
    text: "Body"
  })

  expect(sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      url: "https://api.agentmail.to/v0/inboxes/markobot%40agentmail.to/messages/send"  // lowercase
    })
  )
})
```

**Testing Public Module Behavior (not implementation details):**
- Focus on function contracts: inputs and outputs
- Avoid testing internal state or private functions
- Use `vi.mock()` to replace entire dependencies, not spy on them

## Global Test Setup

**File:** `test/setup.ts`

**Responsibilities:**
1. Setup testing library cleanup: `afterEach(() => cleanup())`
2. Mock global Chrome API with realistic methods and return values
3. Mock testing-library jest-dom matchers
4. Reset mocks and globals between tests

**Key Chrome Mock:**
```typescript
const createChromeMock = () => ({
  runtime: {
    sendMessage: vi.fn(),
    getManifest: vi.fn(() => ({
      name: "MomentumAI Test",
      version: "1.0.0"
    })),
    openOptionsPage: vi.fn(),
    onMessage: {
      addListener: vi.fn()
    }
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue(undefined)
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn()
    },
    onChanged: {
      addListener: vi.fn()
    }
  },
  tabs: {
    create: vi.fn(),
    query: vi.fn(
      (
        _queryInfo: chrome.tabs.QueryInfo,
        callback: (tabs: chrome.tabs.Tab[]) => void
      ) => callback([])
    ),
    onUpdated: {
      addListener: vi.fn()
    }
  }
})
```

## Test Coverage Areas

**Covered:**
- Utility functions: `proxyFetch.ts`, `capture.ts` - URL parsing, fetch handling, capture mode selection
- Services: `agentmail.ts` - Message sending, error handling, address normalization
- Background script: `background.ts` - Clerk client initialization, token refresh logic
- Component behavior: `SelectiveExporter` - Keyboard event propagation, render logic
- Integration points: Message passing, Clerk auth refresh

**Not Currently Tested:**
- Full E2E user flows
- Content script injection and DOM manipulation
- React component visual rendering (only event behavior tested)
- State persistence across browser sessions
