import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("twitter-save-button regression guard", () => {
  it("keeps the tweet save flow isolated from page markdown fallback", () => {
    const source = readFileSync(
      resolve(__dirname, "twitter-save-button.ts"),
      "utf8"
    )

    expect(source).toContain('extractTweetData')
    expect(source).toContain('saveTweet')
    expect(source).not.toContain('defuddle')
    expect(source).not.toContain('extractPageMarkdownCapture')
    expect(source).not.toContain('useCaptureSource')
  })
})
