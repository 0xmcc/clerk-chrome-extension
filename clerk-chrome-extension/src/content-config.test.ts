import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

describe("content script host targeting", () => {
  it("does not inject the exporter on arbitrary web pages", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "src/content.tsx"), "utf8")

    expect(source).toContain('"https://chat.openai.com/*"')
    expect(source).toContain('"https://chatgpt.com/*"')
    expect(source).toContain('"https://claude.ai/*"')
    expect(source).toContain('"https://*.claude.ai/*"')
    expect(source).toContain('"https://x.com/*"')
    expect(source).toContain('"https://twitter.com/*"')
    expect(source).toContain('"https://www.youtube.com/*"')
    expect(source).not.toContain('"http://*/*"')
    expect(source).not.toContain('"https://*/*"')
  })
})
