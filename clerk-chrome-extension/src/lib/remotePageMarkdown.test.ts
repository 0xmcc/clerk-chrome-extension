import { describe, expect, it, vi } from "vitest"

import {
  buildDefuddleRemotePageMarkdownUrl,
  requestRemotePageMarkdown,
  shouldAttemptRemotePageMarkdown
} from "./remotePageMarkdown"

describe("remotePageMarkdown", () => {
  it("builds the hosted Defuddle URL from a public page URL", () => {
    expect(
      buildDefuddleRemotePageMarkdownUrl(
        "https://example.com/articles/launch-post?ref=homepage"
      )
    ).toBe(
      "https://defuddle.md/example.com/articles/launch-post%3Fref=homepage"
    )
  })

  it("skips localhost and private-network pages", () => {
    expect(
      shouldAttemptRemotePageMarkdown("http://localhost:3000/article")
    ).toBe(false)
    expect(shouldAttemptRemotePageMarkdown("https://192.168.1.45/docs")).toBe(
      false
    )
    expect(
      shouldAttemptRemotePageMarkdown("https://example.com/articles/post")
    ).toBe(true)
  })

  it("returns null when the runtime request fails", async () => {
    chrome.runtime.sendMessage = vi.fn(
      (
        _message: unknown,
        callback?: (response: {
          success: boolean
          status: number
          error: string
        }) => void
      ) => {
        callback?.({ success: false, status: 503, error: "Unavailable" })
      }
    )

    await expect(
      requestRemotePageMarkdown("https://example.com/articles/post")
    ).resolves.toBeNull()
  })

  it("returns the markdown payload from the background worker", async () => {
    chrome.runtime.sendMessage = vi.fn(
      (
        _message: unknown,
        callback?: (response: { success: boolean; markdown: string }) => void
      ) => {
        callback?.({ success: true, markdown: "# Example Article" })
      }
    )

    await expect(
      requestRemotePageMarkdown("https://example.com/articles/post")
    ).resolves.toBe("# Example Article")
  })
})
