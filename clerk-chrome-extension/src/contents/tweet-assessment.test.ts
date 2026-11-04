// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

import { attachIndicator, closePopover, shouldShowIndicator, tweetIdOf } from "./tweet-assessment"
import type { Assessment } from "~lib/bookmark-assessment"

const assessed: Assessment = {
  tweet_id: "1", status: "assessed", evaluated_at: "2026-11-02T12:00:00Z", recommendation: null,
  setup_changes_since: 0, takeaway: "<img src=x onerror=alert(1)>", why: "w", staleness: "current",
  still_applies: "yes", adopted: "yes", no_recommendation_reason: "Already in your setup"
}

function article(saved = false): HTMLElement {
  const a = document.createElement("article")
  a.innerHTML = `<a href="https://x.com/dev/status/1"><time></time></a><p id="t">tweet</p>
    <div role="group"><button data-tweet-saver data-state="${saved ? "saved" : "default"}"></button></div>`
  document.body.appendChild(a)
  return a
}

describe("tweet assessment indicator", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    closePopover()
  })

  it("shows for evaluated bookmarks and saved tweets, not for strangers' tweets", () => {
    expect(shouldShowIndicator({ ok: true, assessment: assessed }, false)).toBe(true)
    expect(shouldShowIndicator({ ok: true, assessment: { ...assessed, status: "not_evaluated" } }, true)).toBe(true)
    expect(shouldShowIndicator({ ok: true, assessment: { ...assessed, status: "not_evaluated" } }, false)).toBe(false)
    expect(shouldShowIndicator({ ok: false }, false)).toBe(false)
    expect(shouldShowIndicator({ ok: false }, true)).toBe(true)
  })

  it("reads the tweet id from the timestamp link", () => {
    expect(tweetIdOf(article())).toBe("1")
  })

  it("falls back to the tweet's own link when X renders no timestamp", () => {
    const a = document.createElement("article")
    a.innerHTML = `<a href="/dev/status/55"><span>Oct 30</span></a>`
    expect(tweetIdOf(a)).toBe("55")
  })

  it("on a tweet's own page, prefers that tweet over a quoted one", () => {
    window.history.pushState({}, "", "/dev/status/77")
    const a = document.createElement("article")
    a.innerHTML = `<a href="/other/status/99"></a><a href="/dev/status/77"></a>`
    expect(tweetIdOf(a)).toBe("77")
    window.history.pushState({}, "", "/")
  })

  it("adds one indicator and leaves the tweet and save button alone", () => {
    const a = article(true)
    const before = a.querySelector("#t")!.outerHTML
    const saveBtn = a.querySelector("[data-tweet-saver]")!.outerHTML
    attachIndicator(a, { ok: true, assessment: assessed })
    attachIndicator(a, { ok: true, assessment: assessed })
    expect(a.querySelectorAll('[data-testid="tweet-assessment-button"]').length).toBe(1)
    expect(a.querySelector("#t")!.outerHTML).toBe(before)
    expect(a.querySelector("[data-tweet-saver]")!.outerHTML).toBe(saveBtn)
  })

  it("opens only on demand, and the click does not open the tweet", () => {
    const a = article(true)
    const nav = vi.fn()
    a.addEventListener("click", nav)
    attachIndicator(a, { ok: true, assessment: assessed })
    expect(document.querySelector('[data-testid="tweet-assessment-popover"]')).toBeNull()
    ;(a.querySelector('[data-testid="tweet-assessment-button"]') as HTMLElement).click()
    expect(document.querySelector('[data-testid="tweet-assessment-popover"]')).not.toBeNull()
    expect(nav).not.toHaveBeenCalled()
  })

  it("renders agent text as text, never as markup", () => {
    const a = article(true)
    attachIndicator(a, { ok: true, assessment: assessed })
    ;(a.querySelector('[data-testid="tweet-assessment-button"]') as HTMLElement).click()
    const p = document.querySelector('[data-testid="tweet-assessment-popover"]')!
    expect(p.querySelector("img")).toBeNull()
    expect(p.textContent).toContain("<img src=x")
  })

  it("closes on Escape", () => {
    const a = article(true)
    attachIndicator(a, { ok: true, assessment: assessed })
    ;(a.querySelector('[data-testid="tweet-assessment-button"]') as HTMLElement).click()
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    expect(document.querySelector('[data-testid="tweet-assessment-popover"]')).toBeNull()
  })

  it("says the service is unavailable rather than guessing", () => {
    const a = article(true)
    attachIndicator(a, { ok: false })
    ;(a.querySelector('[data-testid="tweet-assessment-button"]') as HTMLElement).click()
    const p = document.querySelector('[data-testid="tweet-assessment-popover"]')!
    expect(p.textContent).toContain("unavailable")
    expect(p.textContent).not.toContain("Not yet evaluated")
  })
})
