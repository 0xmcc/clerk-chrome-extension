import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock("./supabase", () => ({ getSupabaseClient: () => ({ from: mocks.from }) }))

import { backfillMetricsForTweet, checkCompletedTweets, tagExistingTweets } from "./tweet-saver"

describe("bulk save database helpers", () => {
  beforeEach(() => mocks.from.mockReset())

  it("only skips rows with metrics and the current folder tag", async () => {
    const rows = [
      { tweet_id: "1", public_metrics: { like_count: 2 }, tags: ["folder:abc"] },
      { tweet_id: "2", public_metrics: null, tags: ["folder:abc"] },
      { tweet_id: "3", public_metrics: { like_count: 2 }, tags: [] }
    ]
    mocks.from.mockReturnValue({ select: () => ({ in: async () => ({ data: rows, error: null }) }) })

    await expect(checkCompletedTweets(["1", "2", "3"], ["folder:abc"]))
      .resolves.toEqual(new Set(["1"]))
  })

  it("backfills only existing rows with null metrics", async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ tweet_id: "1" }], error: null })
    const is = vi.fn().mockReturnValue({ select })
    const eq = vi.fn().mockReturnValue({ is })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    await expect(backfillMetricsForTweet("1", { like_count: 2 }))
      .resolves.toBe("updated")
    expect(eq).toHaveBeenCalledWith("tweet_id", "1")
    expect(is).toHaveBeenCalledWith("public_metrics", null)
    expect(update).toHaveBeenCalledWith({ public_metrics: { like_count: 2 } })
  })

  it("adds folder tags to saved rows without replacing existing tags", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({
      select: () => ({ in: async () => ({ data: [
        { tweet_id: "1", tags: ["favorite"] },
        { tweet_id: "2", tags: ["folder:abc"] }
      ], error: null }) }),
      update
    })

    await expect(tagExistingTweets(["1", "2"], ["folder:abc"]))
      .resolves.toBe(1)
    expect(update).toHaveBeenCalledWith({ tags: ["favorite", "folder:abc"] })
    expect(eq).toHaveBeenCalledWith("tweet_id", "1")
  })
})
