import { describe, expect, it } from "vitest"

import {
  getCaptureSurface,
  resolveCaptureMode
} from "./capture"

describe("capture mode resolution", () => {
  it("keeps structured conversation capture on ChatGPT even if page markdown is available", () => {
    expect(
      resolveCaptureMode({
        platform: "chatgpt",
        pathname: "/c/abc123",
        hasStructuredMessages: true,
        hasPageMarkdown: true
      })
    ).toBe("structured_conversation")
  })

  it("does not let page markdown fallback steal supported primary surfaces before messages are ready", () => {
    expect(
      resolveCaptureMode({
        platform: "chatgpt",
        pathname: "/c/abc123",
        hasStructuredMessages: false,
        hasPageMarkdown: true
      })
    ).toBeNull()
  })

  it("uses page markdown fallback on non-conversation ChatGPT routes", () => {
    expect(
      resolveCaptureMode({
        platform: "chatgpt",
        pathname: "/g/g-abc123",
        hasStructuredMessages: false,
        hasPageMarkdown: true
      })
    ).toBe("page_markdown")
    expect(getCaptureSurface("chatgpt", "/g/g-abc123")).toBe("chatgpt_page")
  })

  it("activates page markdown fallback on non-chat Claude surfaces", () => {
    expect(
      resolveCaptureMode({
        platform: "claude",
        pathname: "/projects/example",
        hasStructuredMessages: false,
        hasPageMarkdown: true
      })
    ).toBe("page_markdown")
    expect(getCaptureSurface("claude", "/projects/example")).toBe("claude_page")
  })
})
