import { describe, expect, it } from "vitest"

import { extractMetrics, parseCompactNumber, parseEngagementLabel } from "./tweet-metrics"

/**
 * Extension-saved tweets have always landed with public_metrics: null — the
 * scraper never read engagement counts, so only the official API sync ever
 * populated them. That leaves a permanent hole that grows with every save.
 *
 * The counts are already on screen. X renders abbreviated text in the buttons
 * ("1.2M") but puts EXACT figures in the action bar's aria-label, so parsing
 * the label avoids the precision loss that makes like-rate math unusable.
 */
describe("parseCompactNumber", () => {
  it("parses plain and comma-grouped integers", () => {
    expect(parseCompactNumber("0")).toBe(0)
    expect(parseCompactNumber("847")).toBe(847)
    expect(parseCompactNumber("5,390")).toBe(5390)
  })

  it("expands K/M/B suffixes", () => {
    expect(parseCompactNumber("1.2K")).toBe(1200)
    expect(parseCompactNumber("15K")).toBe(15000)
    expect(parseCompactNumber("1.2M")).toBe(1200000)
    expect(parseCompactNumber("2B")).toBe(2000000000)
  })

  it("returns null for anything that is not a count", () => {
    expect(parseCompactNumber("")).toBeNull()
    expect(parseCompactNumber("Reply")).toBeNull()
    expect(parseCompactNumber(null)).toBeNull()
  })
})

describe("parseEngagementLabel", () => {
  it("reads exact counts out of the aria-label", () => {
    expect(
      parseEngagementLabel(
        "23 replies, 45 reposts, 678 likes, 12 bookmarks, 90123 views"
      )
    ).toEqual({
      reply_count: 23,
      retweet_count: 45,
      like_count: 678,
      bookmark_count: 12,
      impression_count: 90123,
    })
  })

  it("handles singular forms and omitted zero buckets", () => {
    expect(parseEngagementLabel("1 reply, 1 like, 5 views")).toEqual({
      reply_count: 1,
      like_count: 1,
      impression_count: 5,
    })
  })

  it("ignores an unrelated label", () => {
    expect(parseEngagementLabel("Timeline: Your Home Timeline")).toEqual({})
    expect(parseEngagementLabel(null)).toEqual({})
  })
})

describe("extractMetrics", () => {
  function article({ label, buttons }: { label?: string; buttons?: Record<string, string> }) {
    const el = document.createElement("article")
    const group = document.createElement("div")
    group.setAttribute("role", "group")
    if (label) group.setAttribute("aria-label", label)
    for (const [testid, text] of Object.entries(buttons ?? {})) {
      const btn = document.createElement("button")
      btn.setAttribute("data-testid", testid)
      btn.textContent = text
      group.appendChild(btn)
    }
    el.appendChild(group)
    document.body.appendChild(el)
    return el
  }

  it("prefers the exact aria-label counts over abbreviated button text", () => {
    const el = article({
      label: "12 replies, 34 reposts, 1194721 likes, 8 bookmarks, 5000000 views",
      buttons: { reply: "12", retweet: "34", like: "1.2M" },
    })
    const m = extractMetrics(el)
    expect(m.like_count).toBe(1194721) // not 1200000
    expect(m.impression_count).toBe(5000000)
  })

  it("falls back to button text when no aria-label is present", () => {
    const el = article({ buttons: { reply: "5", retweet: "10", like: "1.5K" } })
    expect(extractMetrics(el)).toMatchObject({
      reply_count: 5,
      retweet_count: 10,
      like_count: 1500,
    })
  })

  it("returns an empty object when the action bar is absent", () => {
    const el = document.createElement("article")
    document.body.appendChild(el)
    expect(extractMetrics(el)).toEqual({})
  })

  it("never invents a zero for a metric it could not read", () => {
    // A missing count must stay absent, so a real zero stays distinguishable
    // from "we failed to read it" — the mistake that made truncation invisible.
    const el = article({ buttons: { like: "7" } })
    const m = extractMetrics(el)
    expect(m.like_count).toBe(7)
    expect(m).not.toHaveProperty("impression_count")
    expect(m).not.toHaveProperty("bookmark_count")
  })
})

describe("extractTweetData integration", () => {
  it("attaches metrics to the saved tweet payload", async () => {
    const { extractTweetData } = await import("./tweet-extractor")

    const el = document.createElement("article")
    const time = document.createElement("time")
    const link = document.createElement("a")
    link.setAttribute("href", "/someone/status/1998255999757783166")
    link.appendChild(time)
    el.appendChild(link)

    const group = document.createElement("div")
    group.setAttribute("role", "group")
    group.setAttribute("aria-label", "3 replies, 9 reposts, 250 likes, 4 bookmarks, 88000 views")
    el.appendChild(group)
    document.body.appendChild(el)

    const data = extractTweetData(el)
    expect(data?.public_metrics).toEqual({
      reply_count: 3,
      retweet_count: 9,
      like_count: 250,
      bookmark_count: 4,
      impression_count: 88000,
    })
  })
})
