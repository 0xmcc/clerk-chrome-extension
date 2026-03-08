import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ExportCapture } from "~lib/capture"

import { useExportActions } from "./useExportActions"

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

describe("useExportActions", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })

    vi.stubGlobal("URL", URL)
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
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
})
