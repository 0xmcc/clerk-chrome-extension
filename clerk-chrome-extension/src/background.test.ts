import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CHATGPT_ENDPOINTS, CLAUDE_ENDPOINTS } from "./config/endpoints"

const {
  createClerkClientMock,
  createYouTubeClipJobMock,
  executeScriptMock,
  getYouTubeClipJobStatusMock,
  installNetworkInterceptorMock
} = vi.hoisted(() => ({
  createClerkClientMock: vi.fn(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    session: null
  })),
  createYouTubeClipJobMock: vi.fn(),
  executeScriptMock: vi.fn().mockResolvedValue(undefined),
  getYouTubeClipJobStatusMock: vi.fn(),
  installNetworkInterceptorMock: vi.fn()
}))

vi.mock("@clerk/chrome-extension/background", () => ({
  createClerkClient: createClerkClientMock
}))

vi.mock("./interceptor", () => ({
  installNetworkInterceptor: installNetworkInterceptorMock
}))

vi.mock("./lib/youtube-clip-worker", () => ({
  createYouTubeClipJob: createYouTubeClipJobMock,
  getYouTubeClipJobStatus: getYouTubeClipJobStatusMock
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
    createYouTubeClipJobMock.mockClear()
    executeScriptMock.mockClear()
    getYouTubeClipJobStatusMock.mockClear()
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

  it("creates YouTube clip jobs through the background handler", async () => {
    createYouTubeClipJobMock.mockResolvedValue({
      id: "clip-1",
      status: "success",
      command: "yt-dlp ...",
      createdAt: "2026-03-21T00:00:00.000Z"
    })

    const background = (await import("./background")) as {
      handleCreateYouTubeClipMessage?: (payload: {
        videoUrl: string
        startSeconds: number
        endSeconds: number
      }) => Promise<{
        success: boolean
        clip?: {
          id: string
          status: string
          command: string | null
          createdAt: string
        }
      }>
    }

    await expect(
      background.handleCreateYouTubeClipMessage?.({
        videoUrl: "https://www.youtube.com/watch?v=abc123",
        startSeconds: 30,
        endSeconds: 105
      })
    ).resolves.toEqual({
      success: true,
      clip: {
        id: "clip-1",
        status: "success",
        command: "yt-dlp ...",
        createdAt: "2026-03-21T00:00:00.000Z"
      }
    })

    expect(createYouTubeClipJobMock).toHaveBeenCalledWith({
      videoUrl: "https://www.youtube.com/watch?v=abc123",
      startSeconds: 30,
      endSeconds: 105
    })
  })

  it("loads YouTube clip job status through the background handler", async () => {
    getYouTubeClipJobStatusMock.mockResolvedValue({
      id: "clip-1",
      status: "success",
      command: "yt-dlp ...",
      createdAt: "2026-03-21T00:00:00.000Z"
    })

    const background = (await import("./background")) as {
      handleGetYouTubeClipStatusMessage?: (jobId: string) => Promise<{
        success: boolean
        clip?: {
          id: string
          status: string
          command: string | null
          createdAt: string
        } | null
      }>
    }

    await expect(
      background.handleGetYouTubeClipStatusMessage?.("clip-1")
    ).resolves.toEqual({
      success: true,
      clip: {
        id: "clip-1",
        status: "success",
        command: "yt-dlp ...",
        createdAt: "2026-03-21T00:00:00.000Z"
      }
    })

    expect(getYouTubeClipJobStatusMock).toHaveBeenCalledWith("clip-1")
  })
})
