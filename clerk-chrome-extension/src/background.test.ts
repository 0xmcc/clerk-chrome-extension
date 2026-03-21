import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CHATGPT_ENDPOINTS, CLAUDE_ENDPOINTS } from "./config/endpoints"

const {
  createClerkClientMock,
  executeScriptMock,
  installNetworkInterceptorMock
} = vi.hoisted(() => ({
  createClerkClientMock: vi.fn(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    session: null
  })),
  executeScriptMock: vi.fn().mockResolvedValue(undefined),
  installNetworkInterceptorMock: vi.fn()
}))

vi.mock("@clerk/chrome-extension/background", () => ({
  createClerkClient: createClerkClientMock
}))

vi.mock("./interceptor", () => ({
  installNetworkInterceptor: installNetworkInterceptorMock
}))

const createChromeMock = () => ({
  cookies: {
    getAll: vi.fn().mockResolvedValue([])
  },
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
    executeScript: executeScriptMock
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

describe("background interceptor injection", () => {
  const originalPublishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
  const originalSyncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST

  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal("chrome", createChromeMock())

    process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_123"
    process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST = "https://sync.example.test"

    createClerkClientMock.mockClear()
    executeScriptMock.mockClear()
    installNetworkInterceptorMock.mockClear()
  })

  afterEach(() => {
    if (originalPublishableKey === undefined) {
      delete process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
    } else {
      process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY = originalPublishableKey
    }

    if (originalSyncHost === undefined) {
      delete process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST
    } else {
      process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST = originalSyncHost
    }
  })

  it("injects the canonical interceptor implementation into the page", async () => {
    const background = (await import("./background")) as {
      injectInterceptor?: (tabId: number) => void
    }

    expect(background.injectInterceptor).toBeTypeOf("function")

    background.injectInterceptor?.(42)

    expect(executeScriptMock).toHaveBeenCalledTimes(1)
    expect(executeScriptMock).toHaveBeenCalledWith({
      target: { tabId: 42 },
      world: "MAIN",
      args: [
        CHATGPT_ENDPOINTS.CONVERSATION_DETAIL_PREFIX,
        CHATGPT_ENDPOINTS.CONVERSATIONS_LIST,
        CLAUDE_ENDPOINTS.ORG_API_PREFIX,
        "/youtubei/v1/get_transcript"
      ],
      func: installNetworkInterceptorMock
    })
  })
})
