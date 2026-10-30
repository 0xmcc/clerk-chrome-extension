import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  saveTweet: vi.fn(),
  checkCompletedTweets: vi.fn(),
  extractTweetData: vi.fn(),
  expandLongPost: vi.fn()
}))

vi.mock("~config/features", () => ({ ENABLE_TWEET_BOOKMARK: false }))
vi.mock("~lib/tweet-saver", () => ({
  saveTweet: mocks.saveTweet,
  checkSavedTweets: vi.fn(),
  checkCompletedTweets: mocks.checkCompletedTweets,
  backfillMetricsForTweet: vi.fn(),
  tagExistingTweets: vi.fn()
}))
vi.mock("~lib/tweet-extractor", () => ({
  extractTweetData: mocks.extractTweetData,
  expandLongPost: mocks.expandLongPost
}))

import { autoScrollAndSave } from "./twitter-save-button"

function showArticle(id: string) {
  document.body.innerHTML = `<article><a href="https://x.com/user/status/${id}"><time></time></a></article>`
}

describe("bulk bookmark scroll", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
    mocks.checkCompletedTweets.mockResolvedValue(new Set())
    mocks.expandLongPost.mockResolvedValue(undefined)
    mocks.extractTweetData.mockReturnValue({ tweet_id: "123", public_metrics: { like_count: 1 } })
    Object.defineProperty(window, "scrollY", { configurable: true, value: 1000 })
    vi.stubGlobal("scrollBy", vi.fn())
  })

  it("starts from the current position and waits for an in-flight save when stopped", async () => {
    showArticle("123")
    let finishSave!: () => void
    mocks.saveTweet.mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve }))
    const controller = new AbortController()
    const onComplete = vi.fn()
    const run = autoScrollAndSave(document.createElement("button"), controller.signal, { onComplete }, "save", 20000, 1200, 10)

    await vi.waitFor(() => expect(mocks.saveTweet).toHaveBeenCalledTimes(1))
    expect(window.scrollBy).toHaveBeenCalledWith({ top: 1200, behavior: "auto" })
    controller.abort()
    expect(onComplete).not.toHaveBeenCalled()
    finishSave()

    await expect(run).resolves.toMatchObject({ saved: 1, reason: "stopped" })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("skips completed bookmarks on a new pass", async () => {
    showArticle("123")
    mocks.checkCompletedTweets.mockResolvedValue(new Set(["123"]))
    const controller = new AbortController()
    const run = autoScrollAndSave(document.createElement("button"), controller.signal, {}, "save", 20000, 1200, 10)

    await vi.waitFor(() => expect(mocks.checkCompletedTweets).toHaveBeenCalledTimes(1))
    controller.abort()
    await expect(run).resolves.toMatchObject({ saved: 0, skipped: 1, reason: "stopped" })
    expect(mocks.saveTweet).not.toHaveBeenCalled()
  })

  it("does not report an idle finish until queued saves settle", async () => {
    showArticle("123")
    let finishSave!: () => void
    mocks.saveTweet.mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve }))
    const onComplete = vi.fn()
    const run = autoScrollAndSave(document.createElement("button"), new AbortController().signal, { onComplete }, "save", 1, 1200, 10)

    await vi.waitFor(() => expect(mocks.saveTweet).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(onComplete).not.toHaveBeenCalled()
    finishSave()
    await expect(run).resolves.toMatchObject({ saved: 1, reason: "idle" })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
