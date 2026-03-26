import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildDefuddleOptions,
  buildDocumentForExtraction,
  extractPageMarkdownCapture,
  findPrimaryContentRoot,
  isDefuddleMarkdownFailure,
  parseMarkdownFrontmatter,
  resolvePageMarkdownCapture
} from "./pageCapture"

const { parseMock, defuddleConstructorMock, createMarkdownContentMock } =
  vi.hoisted(() => {
    const parse = vi.fn()
    const createMarkdownContent = vi.fn()
    const constructor = vi.fn(function MockDefuddle() {
      return {
        parse,
        parseAsync: vi.fn()
      }
    })

    return {
      parseMock: parse,
      defuddleConstructorMock: constructor,
      createMarkdownContentMock: createMarkdownContent
    }
  })

vi.mock("defuddle", () => ({
  default: defuddleConstructorMock
}))

vi.mock("../../node_modules/defuddle/dist/markdown.js", () => ({
  createMarkdownContent: createMarkdownContentMock
}))

describe("pageCapture", () => {
  beforeEach(() => {
    parseMock.mockReset()
    defuddleConstructorMock.mockClear()
    createMarkdownContentMock.mockReset()
  })

  it("pins Defuddle to an explicit local-only configuration", () => {
    expect(buildDefuddleOptions("https://claude.ai/projects/example")).toEqual({
      url: "https://claude.ai/projects/example",
      useAsync: false
    })
  })

  it("converts extracted HTML to markdown", () => {
    parseMock.mockReturnValue({
      title: "Project Overview",
      content: "<article><p>Useful HTML fallback.</p></article>"
    })
    createMarkdownContentMock.mockReturnValue(
      "Useful markdown content from the page body."
    )

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
    const firstConstructorCall = defuddleConstructorMock.mock
      .calls[0] as unknown as [
      unknown,
      {
        url: string
        useAsync: boolean
      }
    ]
    expect(firstConstructorCall[1]).toEqual({
      url: "https://claude.ai/projects/example",
      useAsync: false
    })
    expect(createMarkdownContentMock).toHaveBeenCalledWith(
      "<article><p>Useful HTML fallback.</p></article>",
      "https://claude.ai/projects/example"
    )
    expect(result.title).toBe("Project Overview")
    expect(result.markdown).toBe("Useful markdown content from the page body.")
  })

  it("narrows broad article wrappers down to the main prose subtree", () => {
    const sourceDocument = new DOMParser().parseFromString(
      `<!doctype html>
      <html>
        <head>
          <title>Example Article</title>
        </head>
        <body>
          <div class="post-content">
            <div class="author-desktop">
              <p>Ryan Law is the Director of Content Marketing at Ahrefs.</p>
              <p>He has helped dozens of companies improve their SEO.</p>
            </div>
            <div class="post-navigation-left no-content">Contents</div>
            <span>
              <div class="intro-txt">It’s a common belief that AI-generated blog posts are inherently low-quality.</div>
              <p>Companies that scale AI-generated content do so with the knowledge that they are making a trade-off.</p>
              <p>I now think this belief is outdated.</p>
              <p>AI has become a more thorough researcher, a more compliant adherent to brand guidelines, faster, and more efficient.</p>
              <h2>Great writing is simpler than it seems</h2>
              <p>Most content marketers spend most of their time creating informational content.</p>
            </span>
          </div>
        </body>
      </html>`,
      "text/html"
    )

    const root = findPrimaryContentRoot(sourceDocument)

    expect(root?.tagName).toBe("SPAN")
    expect(root?.textContent).toContain(
      "AI-generated blog posts are inherently low-quality"
    )
    expect(root?.textContent).not.toContain(
      "Ryan Law is the Director of Content Marketing"
    )
    expect(root?.textContent).not.toContain("Contents")

    const extractionDocument = buildDocumentForExtraction(sourceDocument)

    expect(extractionDocument.body.textContent).toContain(
      "AI-generated blog posts are inherently low-quality"
    )
    expect(extractionDocument.body.textContent).not.toContain(
      "Ryan Law is the Director of Content Marketing"
    )
    expect(extractionDocument.body.textContent).not.toContain("Contents")
  })

  it("falls back to extracted HTML when Defuddle's markdown conversion fails", () => {
    parseMock.mockReturnValue({
      title: "Project Overview",
      content: "<article><p>Useful HTML fallback.</p></article>"
    })
    createMarkdownContentMock.mockReturnValue(
      "Partial conversion completed with errors. Original HTML:\n\n<article><p>Useful HTML fallback.</p></article>"
    )

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

    expect(isDefuddleMarkdownFailure(result.markdown)).toBe(false)
    expect(result.markdown).toBe(
      "<article><p>Useful HTML fallback.</p></article>"
    )
  })

  it("prefers hosted Defuddle markdown when it produces a better public-page capture", async () => {
    parseMock.mockReturnValue({
      title: "Example Article",
      content:
        "<article><h2>Later section</h2><p>This local fallback starts after the introduction.</p></article>"
    })
    createMarkdownContentMock.mockReturnValue(
      "## Later section\n\nThis local fallback starts after the introduction."
    )

    const result = await resolvePageMarkdownCapture({
      sourceDocument: document,
      sourceUrl: "https://example.com/articles/example-article",
      fallbackTitle: "Example Article",
      preferRemote: true,
      remoteMarkdownLoader: vi.fn().mockResolvedValue(`---
title: "Example Article"
source: "https://example.com/articles/example-article"
---

This introduction should win because it matches the hosted Defuddle output.

## Later section

This local fallback starts after the introduction.`),
      baseCapture: {
        captureMode: "page_markdown",
        conversationKey: "example.com/articles/example-article",
        metadata: {
          sourceUrl: "https://example.com/articles/example-article",
          pageTitle: "Example Article",
          capturedAt: "2026-03-23T02:40:01.665Z",
          platform: "Web Page",
          surface: "generic_page"
        }
      }
    })

    expect(result.title).toBe("Example Article")
    expect(result.markdown).toContain(
      "This introduction should win because it matches the hosted Defuddle output."
    )
    expect(result.markdown.startsWith("---")).toBe(false)
  })

  it("ignores hosted markdown when the response source does not match the current page", async () => {
    parseMock.mockReturnValue({
      title: "Project Overview",
      content: "<article><p>Useful local fallback.</p></article>"
    })
    createMarkdownContentMock.mockReturnValue("Useful local fallback.")

    const result = await resolvePageMarkdownCapture({
      sourceDocument: document,
      sourceUrl: "https://claude.ai/projects/example",
      fallbackTitle: "Claude Project",
      preferRemote: true,
      remoteMarkdownLoader: vi.fn().mockResolvedValue(`---
title: "Different page"
source: "https://example.com/other-page"
---

Remote markdown that should be ignored.`),
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

    expect(result.title).toBe("Project Overview")
    expect(result.markdown).toBe("Useful local fallback.")
  })

  it("uses hosted markdown when local extraction has no meaningful content", async () => {
    parseMock.mockReturnValue({
      title: "Empty page",
      content: "Empty page"
    })
    createMarkdownContentMock.mockReturnValue("Empty page")

    const result = await resolvePageMarkdownCapture({
      sourceDocument: document,
      sourceUrl: "https://example.com/articles/remote-only",
      fallbackTitle: "Remote Only Article",
      preferRemote: true,
      remoteMarkdownLoader: vi.fn().mockResolvedValue(`---
title: "Remote Only Article"
source: "https://example.com/articles/remote-only"
---

This hosted markdown becomes the fallback when the live DOM has nothing useful.

## Key point

The content should still be exportable.`),
      baseCapture: {
        captureMode: "page_markdown",
        conversationKey: "example.com/articles/remote-only",
        metadata: {
          sourceUrl: "https://example.com/articles/remote-only",
          pageTitle: "Remote Only Article",
          capturedAt: "2026-03-23T02:40:01.665Z",
          platform: "Web Page",
          surface: "generic_page"
        }
      }
    })

    expect(result.title).toBe("Remote Only Article")
    expect(result.markdown).toContain(
      "This hosted markdown becomes the fallback when the live DOM has nothing useful."
    )
  })

  it("rejects empty or title-only fallback output", () => {
    parseMock.mockReturnValue({
      title: "Claude Project",
      content: "Claude Project"
    })
    createMarkdownContentMock.mockReturnValue("Claude Project")

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

  it("parses hosted Defuddle frontmatter and strips it from the body", () => {
    expect(
      parseMarkdownFrontmatter(`---
title: "Example Article"
source: "https://example.com/articles/example-article"
author: "Jane Doe"
---

Body copy`)
    ).toEqual({
      attributes: {
        title: "Example Article",
        source: "https://example.com/articles/example-article",
        author: "Jane Doe"
      },
      body: "Body copy"
    })
  })
})
