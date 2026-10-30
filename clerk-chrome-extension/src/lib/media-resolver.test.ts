import { afterEach, describe, expect, it, vi } from "vitest"

import { resolveMediaFromSyndication } from "./media-resolver"

/**
 * X plays video and GIFs through MSE, so the DOM only ever exposes a blob: URL
 * that dies with the tab. The public syndication endpoint — the one embedded
 * tweets use, no auth, no API credits — returns the real permanent URLs:
 * video.twimg.com MP4s and pbs.twimg.com stills. Resolving through it turns a
 * dead media reference into a fetchable one.
 */
function mockFetch(payload: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    status,
    ok: status === 200,
    json: async () => payload,
  })
  vi.stubGlobal("fetch", fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe("resolveMediaFromSyndication", () => {
  it("returns the permanent MP4 and still for an animated GIF", async () => {
    mockFetch({
      mediaDetails: [
        {
          type: "animated_gif",
          media_url_https: "https://pbs.twimg.com/tweet_video_thumb/ABC.jpg",
          video_info: {
            variants: [
              { content_type: "video/mp4", bitrate: 0, url: "https://video.twimg.com/tweet_video/ABC.mp4" },
            ],
          },
        },
      ],
    })

    const media = await resolveMediaFromSyndication("123")

    expect(media).toEqual([
      {
        type: "gif",
        url: "https://video.twimg.com/tweet_video/ABC.mp4",
        thumbnail_url: "https://pbs.twimg.com/tweet_video_thumb/ABC.jpg",
      },
    ])
  })

  it("picks the highest-bitrate MP4 variant for video", async () => {
    mockFetch({
      mediaDetails: [
        {
          type: "video",
          media_url_https: "https://pbs.twimg.com/amplify_video_thumb/1/img/x.jpg",
          video_info: {
            variants: [
              { content_type: "application/x-mpegURL", url: "https://video.twimg.com/x.m3u8" },
              { content_type: "video/mp4", bitrate: 632000, url: "https://video.twimg.com/low.mp4" },
              { content_type: "video/mp4", bitrate: 2176000, url: "https://video.twimg.com/high.mp4" },
            ],
          },
        },
      ],
    })

    const media = await resolveMediaFromSyndication("123")

    expect(media[0].url).toBe("https://video.twimg.com/high.mp4")
    expect(media[0].type).toBe("video")
  })

  it("maps photos to their pbs.twimg.com URL", async () => {
    mockFetch({
      mediaDetails: [
        { type: "photo", media_url_https: "https://pbs.twimg.com/media/PIC.jpg" },
      ],
    })

    expect(await resolveMediaFromSyndication("123")).toEqual([
      { type: "image", url: "https://pbs.twimg.com/media/PIC.jpg", thumbnail_url: null },
    ])
  })

  it("returns an empty list for a deleted or suspended tweet", async () => {
    mockFetch({ tombstone: { text: "This Post is unavailable." } })
    expect(await resolveMediaFromSyndication("123")).toEqual([])
  })

  it("never emits a non-durable URL even if the payload contains one", async () => {
    mockFetch({
      mediaDetails: [
        {
          type: "video",
          media_url_https: "blob:https://x.com/nope",
          video_info: { variants: [{ content_type: "video/mp4", url: "blob:https://x.com/nope" }] },
        },
      ],
    })
    expect(await resolveMediaFromSyndication("123")).toEqual([])
  })

  it("returns an empty list rather than throwing when the endpoint fails", async () => {
    mockFetch({}, 404)
    expect(await resolveMediaFromSyndication("123")).toEqual([])

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect(await resolveMediaFromSyndication("123")).toEqual([])
  })
})
