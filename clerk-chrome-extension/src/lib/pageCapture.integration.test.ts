import { describe, expect, it } from "vitest"

import { extractPageMarkdownCapture } from "./pageCapture"

describe("pageCapture integration", () => {
  it("converts extracted article content to markdown instead of leaking raw HTML", () => {
    const sourceDocument = new DOMParser().parseFromString(
      `<!doctype html>
      <html>
        <head>
          <title>Example Article</title>
        </head>
        <body>
          <article>
            <h1>Example Article</h1>
            <p>This introduction should stay readable after extraction.</p>
            <h2>Key takeaways</h2>
            <p>Hello <a href="https://example.com/world">world</a>.</p>
            <ul>
              <li>First point</li>
              <li>Second point</li>
            </ul>
          </article>
        </body>
      </html>`,
      "text/html"
    )

    const result = extractPageMarkdownCapture({
      sourceDocument,
      sourceUrl: "https://example.com/articles/example-article",
      fallbackTitle: "Example Article",
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

    expect(result.markdown).toContain(
      "This introduction should stay readable after extraction."
    )
    expect(result.markdown).toContain("## Key takeaways")
    expect(result.markdown).toContain("[world](https://example.com/world)")
    expect(result.markdown).toContain("- First point")
    expect(result.markdown).toContain("- Second point")
    expect(result.markdown).not.toContain("<article>")
    expect(result.markdown).not.toContain("<p>")
  })

  it("prefers article prose over sidebar and author chrome inside broad wrappers", () => {
    const sourceDocument = new DOMParser().parseFromString(
      `<!doctype html>
      <html>
        <head>
          <title>AI Content Wasn't Good Enough. Now It Is.</title>
        </head>
        <body>
          <div id="content">
            <div class="post-content">
              <div class="author-desktop">
                <p>Ryan Law is the Director of Content Marketing at Ahrefs.</p>
                <p>He has helped dozens of companies improve their SEO.</p>
              </div>
              <div class="post-navigation-left no-content">Contents</div>
              <span>
                <div class="intro-txt">It's a common belief that AI-generated blog posts are inherently low-quality and inferior to their human-made equivalents.</div>
                <p>Companies that scale AI-generated content do so with the knowledge that they are making a trade-off.</p>
                <p>I now think this belief is outdated.</p>
                <p>AI has become a more thorough researcher, a more compliant adherent to brand and voice guidelines, faster, and more efficient.</p>
                <h2>Great writing is simpler than it seems</h2>
                <p>Most content marketers spend most of their time creating informational content.</p>
              </span>
            </div>
          </div>
        </body>
      </html>`,
      "text/html"
    )

    const result = extractPageMarkdownCapture({
      sourceDocument,
      sourceUrl: "https://example.com/articles/ai-content",
      fallbackTitle: "AI Content Wasn't Good Enough. Now It Is.",
      baseCapture: {
        captureMode: "page_markdown",
        conversationKey: "example.com/articles/ai-content",
        metadata: {
          sourceUrl: "https://example.com/articles/ai-content",
          pageTitle: "AI Content Wasn't Good Enough. Now It Is.",
          capturedAt: "2026-03-23T03:10:01.665Z",
          platform: "Web Page",
          surface: "generic_page"
        }
      }
    })

    expect(result.markdown).toContain(
      "AI-generated blog posts are inherently low-quality"
    )
    expect(result.markdown).toContain("## Great writing is simpler than it seems")
    expect(result.markdown).not.toContain("Ryan Law is the Director of Content Marketing")
    expect(result.markdown).not.toContain("Contents")
  })
})
