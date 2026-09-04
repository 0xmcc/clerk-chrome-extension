import { describe, expect, it } from "vitest"

import { isBookmarksPage } from "./twitter-save-button"

/**
 * X relocated bookmarks from /i/bookmarks to /i/history without preserving the
 * old path, which silently removed the bulk scroll-and-save controls — the page
 * still rendered, the button just never mounted. Pinning both paths so the next
 * relocation fails a test instead of quietly disabling the feature.
 */
describe("isBookmarksPage", () => {
  it("matches the current /i/history location", () => {
    expect(isBookmarksPage("/i/history")).toBe(true)
  })

  it("still matches the legacy /i/bookmarks location", () => {
    expect(isBookmarksPage("/i/bookmarks")).toBe(true)
  })

  it("matches nested tabs under those pages", () => {
    expect(isBookmarksPage("/i/history/all")).toBe(true)
    expect(isBookmarksPage("/i/bookmarks/all")).toBe(true)
  })

  it("does not match unrelated pages", () => {
    expect(isBookmarksPage("/home")).toBe(false)
    expect(isBookmarksPage("/explore")).toBe(false)
    expect(isBookmarksPage("/jack/status/123")).toBe(false)
    expect(isBookmarksPage("/i/notifications")).toBe(false)
  })
})
