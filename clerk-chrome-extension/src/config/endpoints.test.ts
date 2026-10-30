import { describe, expect, it } from "vitest"

import { ALL_HOST_PATTERNS, buildClaudeDetailUrls, isTargetSite } from "./endpoints"

describe("buildClaudeDetailUrls", () => {
  it("prioritizes Claude's current message-tree endpoint", () => {
    expect(buildClaudeDetailUrls("org-123", "conv-456")[0]).toBe(
      "/api/organizations/org-123/chat_conversations/conv-456?tree=True&rendering_mode=messages&render_all_tools=true&return_dangling_human_message=true"
    )
  })
})

describe("network interception targets", () => {
  it("leaves X to the separate bookmark content script", () => {
    expect(ALL_HOST_PATTERNS).not.toContain("https://x.com/*")
    expect(ALL_HOST_PATTERNS).not.toContain("https://twitter.com/*")
    expect(isTargetSite("https://x.com/i/history")).toBe(false)
    expect(isTargetSite("https://chatgpt.com/c/123")).toBe(true)
  })
})
