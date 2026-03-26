import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ExportCapture } from "~lib/capture"
import { saveRecentCapture } from "~lib/recentCaptures"
import { requestClerkToken } from "~utils/clerk"

import { useExportActions } from "./useExportActions"

vi.mock("~utils/clerk", () => ({
  requestClerkToken: vi.fn().mockResolvedValue("test-token")
}))

vi.mock("~lib/recentCaptures", () => ({
  saveRecentCapture: vi.fn().mockResolvedValue([])
}))

const structuredCapture: ExportCapture = {
  captureMode: "structured_conversation",
  conversationKey: "chatgpt.com/c/test-conversation",
  title: "Test Conversation",
  messages: [
    {
      id: "conv_test::m_0001",
      role: "user",
      text: "How does the structured export work?",
      authorName: "User",
      node: document.createElement("div")
    },
    {
      id: "conv_test::m_0002",
      role: "assistant",
      text: "It keeps the transcript path intact.",
      authorName: "Assistant",
      node: document.createElement("div")
    }
  ],
  metadata: {
    sourceUrl: "https://chatgpt.com/c/test-conversation",
    pageTitle: "Test Conversation",
    capturedAt: "2026-03-08T01:00:00.000Z",
    platform: "ChatGPT",
    surface: "chatgpt_conversation"
  }
}

const pageMarkdownCapture: ExportCapture = {
  captureMode: "page_markdown",
  conversationKey: "claude.ai/projects/example",
  title: "Project Overview",
  markdown: "# Summary\n\nThis is a generic page capture.",
  metadata: {
    sourceUrl: "https://claude.ai/projects/example",
    pageTitle: "Project Overview",
    capturedAt: "2026-03-08T02:00:00.000Z",
    platform: "Claude",
    surface: "claude_page"
  }
}

const youtubeTranscriptCapture: ExportCapture = {
  captureMode: "youtube_transcript",
  conversationKey: "youtube:abc123",
  videoId: "abc123",
  videoTitle: "Jensen Huang Interview",
  videoUrl: "https://www.youtube.com/watch?v=abc123",
  segments: [
    { seconds: 30, text: "Intro line" },
    { seconds: 60, text: "Second line", section: "Opening" }
  ],
  metadata: {
    sourceUrl: "https://www.youtube.com/watch?v=abc123",
    pageTitle: "Jensen Huang Interview - YouTube",
    capturedAt: "2026-03-08T03:00:00.000Z",
    platform: "YouTube",
    surface: "youtube_watch"
  }
}

describe("useExportActions", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()

    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })

    const urlWithBlobApis = URL as typeof URL & {
      createObjectURL: ReturnType<typeof vi.fn>
      revokeObjectURL: ReturnType<typeof vi.fn>
    }

    if (!("createObjectURL" in urlWithBlobApis)) {
      Object.defineProperty(urlWithBlobApis, "createObjectURL", {
        configurable: true,
        writable: true,
        value: vi.fn()
      })
    }

    if (!("revokeObjectURL" in urlWithBlobApis)) {
      Object.defineProperty(urlWithBlobApis, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: vi.fn()
      })
    }

    vi.stubGlobal("URL", urlWithBlobApis)
    vi.mocked(urlWithBlobApis.createObjectURL).mockReturnValue("blob:test")
    vi.mocked(urlWithBlobApis.revokeObjectURL).mockImplementation(() => {})
    vi.stubGlobal("fetch", vi.fn())
    vi.mocked(requestClerkToken).mockResolvedValue("test-token")
    vi.mocked(saveRecentCapture).mockResolvedValue([])
  })

  it("keeps the structured transcript markdown path working", () => {
    const { result } = renderHook(() =>
      useExportActions({
        capture: structuredCapture,
        historyFormat: "markdown",
        platformLabel: "ChatGPT",
        conversationTitle: "Test Conversation"
      })
    )

    const markdown = result.current.generateMarkdown()

    expect(markdown).toContain("--- BEGIN HEADER ---")
    expect(markdown).toContain("Conversation ID:")
    expect(markdown).toContain("How does the structured export work?")
    expect(markdown).not.toContain("captureMode: page_markdown")
  })

  it("copies page markdown with page metadata and without transcript-only fields", async () => {
    const { result } = renderHook(() =>
      useExportActions({
        capture: pageMarkdownCapture,
        historyFormat: "markdown",
        platformLabel: "Claude",
        conversationTitle: "Project Overview"
      })
    )

    await act(async () => {
      await result.current.handleCopy()
    })

    const clipboardSpy = vi.mocked(navigator.clipboard.writeText)
    const copied = clipboardSpy.mock.calls[0]?.[0]

    expect(copied).toContain("sourceUrl: https://claude.ai/projects/example")
    expect(copied).toContain("pageTitle: Project Overview")
    expect(copied).toContain("capturedAt: 2026-03-08T02:00:00.000Z")
    expect(copied).toContain("platform: Claude")
    expect(copied).toContain("surface: claude_page")
    expect(copied).toContain("captureMode: page_markdown")
    expect(copied).not.toContain("Conversation ID:")
    expect(copied).not.toContain("Truncated Ranges:")
  })

  it("exports different filenames and content for transcript and page markdown modes", async () => {
    const originalCreateElement = document.createElement.bind(document)
    const clickSpy = vi.fn()
    let exportedBlob: Blob | null = null
    let lastDownload = ""

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName === "a") {
        Object.defineProperty(element, "click", {
          value: clickSpy
        })
        Object.defineProperty(element, "download", {
          get() {
            return lastDownload
          },
          set(value) {
            lastDownload = value
          }
        })
      }
      return element
    })

    vi.mocked(URL.createObjectURL).mockImplementation((blob: Blob) => {
      exportedBlob = blob
      return "blob:test"
    })

    const structured = renderHook(() =>
      useExportActions({
        capture: structuredCapture,
        historyFormat: "json",
        platformLabel: "ChatGPT",
        conversationTitle: "Test Conversation"
      })
    )

    act(() => {
      structured.result.current.handleExport()
    })

    expect(lastDownload).toBe("Test-Conversation.json")
    expect(await exportedBlob?.text()).toContain('"role": "user"')

    const page = renderHook(() =>
      useExportActions({
        capture: pageMarkdownCapture,
        historyFormat: "markdown",
        platformLabel: "Claude",
        conversationTitle: "Project Overview"
      })
    )

    act(() => {
      page.result.current.handleExport()
    })

    expect(lastDownload).toBe("page-Project-Overview.md")
    expect(await exportedBlob?.text()).toContain("captureMode: page_markdown")
    expect(clickSpy).toHaveBeenCalledTimes(2)
  })

  it("copies and exports YouTube transcript markdown from the standard export flow", async () => {
    let exportedBlob: Blob | null = null
    let lastDownload = ""
    const originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName === "a") {
        Object.defineProperty(element, "click", {
          value: vi.fn()
        })
        Object.defineProperty(element, "download", {
          get() {
            return lastDownload
          },
          set(value) {
            lastDownload = value
          }
        })
      }
      return element
    })

    vi.mocked(URL.createObjectURL).mockImplementation((blob: Blob) => {
      exportedBlob = blob
      return "blob:test"
    })

    const { result } = renderHook(() =>
      useExportActions({
        capture: youtubeTranscriptCapture,
        historyFormat: "markdown",
        platformLabel: "YouTube",
        conversationTitle: "Jensen Huang Interview"
      })
    )

    await act(async () => {
      await result.current.handleCopy()
    })

    const clipboardSpy = vi.mocked(navigator.clipboard.writeText)
    const copied = clipboardSpy.mock.calls.at(-1)?.[0]

    expect(copied).toContain("captureMode: youtube_transcript")
    expect(copied).toContain("videoId: abc123")
    expect(copied).toContain("`0:30` Intro line")

    act(() => {
      result.current.handleExport()
    })

    expect(lastDownload).toBe("Jensen-Huang-Interview.md")
    expect(await exportedBlob?.text()).toContain("## Opening")
  })

  it("saves YouTube transcripts with the popup-compatible payload shape", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        conversation: { id: "saved-youtube-convo" }
      })
    } as unknown as Response)

    const { result } = renderHook(() =>
      useExportActions({
        capture: youtubeTranscriptCapture,
        historyFormat: "markdown",
        platformLabel: "YouTube",
        conversationTitle: "Jensen Huang Interview"
      })
    )

    await act(async () => {
      await result.current.handleSaveToDatabase()
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/conversations/export"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    )

    const [, requestInit] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(String(requestInit?.body))

    expect(body.title).toBe("Jensen Huang Interview")
    expect(body.model).toBe("youtube")
    expect(body.metadata.captureMode).toBe("youtube_transcript")
    expect(body.metadata.videoId).toBe("abc123")
    expect(body.messages[0].metadata.timestamp).toBe("0:30")
    expect(saveRecentCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "saved-youtube-convo",
        captureMode: "youtube_transcript"
      })
    )
    expect(result.current.statusMessage).toBe("Transcript saved successfully.")
  })
})
