import { beforeEach, describe, expect, it, vi } from "vitest"

const { parseMock, defuddleConstructorMock } = vi.hoisted(() => {
  const parse = vi.fn()
  const constructor = vi.fn(function MockDefuddle() {
    return {
      parse,
      parseAsync: vi.fn()
    }
  })

  return {
    parseMock: parse,
    defuddleConstructorMock: constructor
  }
})

vi.mock("defuddle", () => ({
  default: defuddleConstructorMock
}))

import {
  buildDefuddleOptions,
  extractPageMarkdownCapture
} from "./pageCapture"

describe("pageCapture", () => {
  beforeEach(() => {
    parseMock.mockReset()
    defuddleConstructorMock.mockClear()
  })

  it("pins Defuddle to an explicit local-only configuration", () => {
    expect(buildDefuddleOptions("https://claude.ai/projects/example")).toEqual({
      markdown: true,
      url: "https://claude.ai/projects/example",
      useAsync: false
    })
  })

  it("extracts page markdown without using async fallback", () => {
    parseMock.mockReturnValue({
      title: "Project Overview",
      content: "Useful markdown content from the page body."
    })

    const result = extractPageMarkdownCapture({
      sourceDocument: document,
      sourceUrl: "https://claude.ai/projects/example",
      fallbackTitle: "Claude Project",
      baseCapture: {
        captureMode: "page_markdown",
        conversationKey: "claude.ai/projects/example",
        metadata: {
          sourceUrl: "https://claude.ai/projects/example",
          pageTitle: "Claude Project",
          capturedAt: "2026-03-08T01:00:00.000Z",
          platform: "Claude",
          surface: "claude_page"
        }
      }
    })

    expect(defuddleConstructorMock).toHaveBeenCalledTimes(1)
    expect(defuddleConstructorMock.mock.calls[0]?.[1]).toEqual({
      markdown: true,
      url: "https://claude.ai/projects/example",
      useAsync: false
    })
    expect(result.title).toBe("Project Overview")
    expect(result.markdown).toBe("Useful markdown content from the page body.")
  })

  it("rejects empty or title-only fallback output", () => {
    parseMock.mockReturnValue({
      title: "Claude Project",
      content: "Claude Project"
    })

    expect(() =>
      extractPageMarkdownCapture({
        sourceDocument: document,
        sourceUrl: "https://claude.ai/projects/example",
        fallbackTitle: "Claude Project",
        baseCapture: {
          captureMode: "page_markdown",
          conversationKey: "claude.ai/projects/example",
          metadata: {
            sourceUrl: "https://claude.ai/projects/example",
            pageTitle: "Claude Project",
            capturedAt: "2026-03-08T01:00:00.000Z",
            platform: "Claude",
            surface: "claude_page"
          }
        }
      })
    ).toThrow("No meaningful page content found for page markdown export.")
  })
})
