import { describe, expect, it } from "vitest"

import { expandLongPost, extractMedia, isDurableMediaUrl } from "./tweet-extractor"

/**
 * X collapses posts over ~280 chars: the tweetText node holds a preview plus a
 * "Show more" anchor, and reading textContent without expanding first silently
 * truncates the body. These cover the expansion contract; the live-DOM
 * behaviour still needs a manual pass on x.com.
 */
function buildArticle({
  preview,
  full,
  withShowMore
}: {
  preview: string
  full: string
  withShowMore: boolean
}) {
  const article = document.createElement("article")
  const text = document.createElement("div")
  text.setAttribute("data-testid", "tweetText")
  text.textContent = preview
  article.appendChild(text)

  if (withShowMore) {
    const link = document.createElement("a")
    link.setAttribute("data-testid", "tweet-text-show-more-link")
    link.href = "https://x.com/someone/status/123"
    // Stand in for X's own expand handler.
    link.addEventListener("click", () => {
      text.textContent = full
      link.remove()
    })
    article.appendChild(link)
  }

  document.body.appendChild(article)
  return { article, text }
}

describe("expandLongPost", () => {
  it("expands a collapsed long post so the full body is readable", async () => {
    const full = "A".repeat(900)
    const { article, text } = buildArticle({
      preview: "truncated preview…",
      full,
      withShowMore: true
    })

    const expanded = await expandLongPost(article)

    expect(expanded).toBe(true)
    expect(text.textContent).toBe(full)
    expect(text.textContent!.length).toBeGreaterThan(280)
  })

  it("suppresses the anchor navigation that would abort the save", async () => {
    let defaultPrevented = false
    const { article } = buildArticle({
      preview: "preview",
      full: "B".repeat(500),
      withShowMore: true
    })
    article
      .querySelector('[data-testid="tweet-text-show-more-link"]')!
      .addEventListener("click", (event) => {
        defaultPrevented = event.defaultPrevented
      })

    await expandLongPost(article)

    expect(defaultPrevented).toBe(true)
  })

  it("is a no-op for short posts with no Show more control", async () => {
    const { article, text } = buildArticle({
      preview: "a short tweet",
      full: "unused",
      withShowMore: false
    })

    expect(await expandLongPost(article)).toBe(false)
    expect(text.textContent).toBe("a short tweet")
  })

  it("gives up rather than hanging when the control never expands", async () => {
    const article = document.createElement("article")
    const text = document.createElement("div")
    text.setAttribute("data-testid", "tweetText")
    text.textContent = "stuck preview"
    const link = document.createElement("a")
    link.setAttribute("data-testid", "tweet-text-show-more-link")
    article.append(text, link)
    document.body.appendChild(article)

    expect(await expandLongPost(article)).toBe(false)
    expect(text.textContent).toBe("stuck preview")
  })
})

/**
 * Regression guard for the dead-URL class of bug.
 *
 * X plays video and GIFs through MSE, so `video.src` is a `blob:` URL scoped to
 * the tab that created it — dead the moment it closes. The scraper stored those
 * verbatim, leaving 288 corpus rows whose media can never be fetched, with
 * nothing to distinguish them from healthy rows.
 *
 * The rule: never persist a URL we cannot fetch later. `<video poster>` carries
 * a real pbs.twimg.com thumbnail and is the correct fallback.
 */
describe("isDurableMediaUrl", () => {
  it("rejects blob: URLs, which die with the tab", () => {
    expect(isDurableMediaUrl("blob:https://x.com/9f8a-4c2b-11ee")).toBe(false)
  })

  it("rejects data: and relative URLs", () => {
    expect(isDurableMediaUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(false)
    expect(isDurableMediaUrl("/media/abc.jpg")).toBe(false)
    expect(isDurableMediaUrl("")).toBe(false)
    expect(isDurableMediaUrl(null)).toBe(false)
  })

  it("accepts http(s) URLs", () => {
    expect(isDurableMediaUrl("https://pbs.twimg.com/media/ABC123.jpg")).toBe(true)
    expect(isDurableMediaUrl("http://pbs.twimg.com/media/ABC123.jpg")).toBe(true)
  })
})

describe("extractMedia durability", () => {
  function articleWithVideo({ src, poster }: { src: string; poster?: string }) {
    const article = document.createElement("article")
    const video = document.createElement("video")
    video.setAttribute("src", src)
    if (poster) video.setAttribute("poster", poster)
    article.appendChild(video)
    document.body.appendChild(article)
    return article
  }

  it("never emits a blob: URL", () => {
    const article = articleWithVideo({
      src: "blob:https://x.com/9f8a-4c2b-11ee",
      poster: "https://pbs.twimg.com/tweet_video_thumb/XYZ.jpg"
    })
    const urls = extractMedia(article).map((m) => m.url)
    expect(urls.every((u) => !u?.startsWith("blob:"))).toBe(true)
  })

  it("falls back to the poster thumbnail when the source is a blob", () => {
    const article = articleWithVideo({
      src: "blob:https://x.com/9f8a-4c2b-11ee",
      poster: "https://pbs.twimg.com/tweet_video_thumb/XYZ.jpg"
    })
    expect(extractMedia(article)[0]?.url).toBe(
      "https://pbs.twimg.com/tweet_video_thumb/XYZ.jpg"
    )
  })

  it("records the media with no URL rather than dropping it silently", () => {
    // A row that knows it has unfetchable media is auditable; a row that
    // silently forgot the media existed is the bug we are fixing.
    const article = articleWithVideo({ src: "blob:https://x.com/dead" })
    const media = extractMedia(article)
    expect(media).toHaveLength(1)
    expect(media[0].url).toBeNull()
  })
})
