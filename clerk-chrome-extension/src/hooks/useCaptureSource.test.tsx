import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useCaptureSource } from "./useCaptureSource"

const {
  detectPlatformMock,
  resolvePageMarkdownCaptureMock,
  shouldAttemptRemotePageMarkdownMock
} = vi.hoisted(() => ({
  detectPlatformMock: vi.fn(),
  resolvePageMarkdownCaptureMock: vi.fn(),
  shouldAttemptRemotePageMarkdownMock: vi.fn()
}))

vi.mock("~utils/platform", async () => {
  const actual =
    await vi.importActual<typeof import("~utils/platform")>("~utils/platform")

  return {
    ...actual,
    detectPlatform: detectPlatformMock
  }
})

vi.mock("~lib/pageCapture", () => ({
  resolvePageMarkdownCapture: resolvePageMarkdownCaptureMock
}))

vi.mock("~lib/remotePageMarkdown", () => ({
  requestRemotePageMarkdown: vi.fn(),
  shouldAttemptRemotePageMarkdown: shouldAttemptRemotePageMarkdownMock
}))

describe("useCaptureSource", () => {
  beforeEach(() => {
    detectPlatformMock.mockReset()
    resolvePageMarkdownCaptureMock.mockReset()
    shouldAttemptRemotePageMarkdownMock.mockReset()
    resolvePageMarkdownCaptureMock.mockResolvedValue(null)

    document.title = "Example Article"
    window.history.pushState({}, "", "/articles/example-article")
  })

  it("loads page markdown asynchronously for generic pages and enables the hosted fallback", async () => {
    detectPlatformMock.mockReturnValue("unknown")
    shouldAttemptRemotePageMarkdownMock.mockReturnValue(true)
    resolvePageMarkdownCaptureMock.mockResolvedValue({
      captureMode: "page_markdown",
      conversationKey: "example.com/articles/example-article",
      title: "Example Article",
      markdown: "Hosted markdown body.",
      metadata: {
        sourceUrl: "http://localhost:3000/articles/example-article",
        pageTitle: "Example Article",
        capturedAt: "2026-03-23T02:40:01.665Z",
        platform: "Web Page",
        surface: "generic_page"
      }
    })

    const { result } = renderHook(() =>
      useCaptureSource({
        isOpen: true,
        messages: [],
        conversationKey: "example.com/articles/example-article",
        conversationTitle: "Example Article"
      })
    )

    expect(result.current.capture).toBeNull()
    expect(result.current.emptyStateMessage).toContain(
      "Preparing page markdown"
    )

    await waitFor(() => {
      expect(result.current.capture?.captureMode).toBe("page_markdown")
    })

    expect(resolvePageMarkdownCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferRemote: true,
        fallbackTitle: "Example Article",
        sourceUrl: "http://localhost:3000/articles/example-article",
        remoteMarkdownLoader: expect.any(Function)
      })
    )
  })

  it("keeps structured conversation capture synchronous and skips page extraction", () => {
    detectPlatformMock.mockReturnValue("chatgpt")
    shouldAttemptRemotePageMarkdownMock.mockReturnValue(false)
    window.history.pushState({}, "", "/c/test-conversation")

    const { result } = renderHook(() =>
      useCaptureSource({
        isOpen: true,
        messages: [
          {
            id: "m_0001",
            role: "user",
            text: "Hello",
            authorName: "User",
            node: document.createElement("div")
          }
        ],
        conversationKey: "chatgpt:test",
        conversationTitle: "Test Chat"
      })
    )

    expect(result.current.capture?.captureMode).toBe("structured_conversation")
    expect(resolvePageMarkdownCaptureMock).not.toHaveBeenCalled()
  })
})
