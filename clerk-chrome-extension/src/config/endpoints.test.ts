import { describe, expect, it } from "vitest"

import { buildClaudeDetailUrls } from "./endpoints"

describe("buildClaudeDetailUrls", () => {
  it("prioritizes Claude's current message-tree endpoint", () => {
    expect(buildClaudeDetailUrls("org-123", "conv-456")[0]).toBe(
      "/api/organizations/org-123/chat_conversations/conv-456?tree=True&rendering_mode=messages&render_all_tools=true&return_dangling_human_message=true"
    )
  })
})
