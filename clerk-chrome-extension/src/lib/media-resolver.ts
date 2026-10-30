/**
 * Resolve permanent media URLs for a tweet.
 *
 * X plays video and GIFs through MSE, so the only thing in the DOM is a `blob:`
 * URL scoped to the tab that created it — useless the moment it closes. The
 * public syndication endpoint (what embedded tweets on other sites use) returns
 * the real, permanent URLs instead: video.twimg.com MP4s and pbs.twimg.com
 * stills. It needs no auth and consumes no X API credits.
 *
 * Only works while the tweet is still live; a deleted or suspended tweet comes
 * back as a tombstone and yields nothing.
 */

import { isDurableMediaUrl, type TweetMedia } from "./tweet-extractor"

export interface ResolvedMedia extends TweetMedia {
  /** Still frame — the OCR-able surface for video and GIFs. */
  thumbnail_url: string | null
}

interface SyndicationVariant {
  content_type?: string
  bitrate?: number
  url?: string
}

interface SyndicationMedia {
  type?: string
  media_url_https?: string
  video_info?: { variants?: SyndicationVariant[] }
}

/** Token X's own embed widgets derive from the tweet id. */
function syndicationToken(tweetId: string): string {
  return ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "")
}

/** Highest-bitrate MP4; HLS variants are unusable as an archived asset. */
function bestMp4(variants: SyndicationVariant[] = []): string | null {
  const mp4s = variants
    .filter((v) => v.content_type === "video/mp4" && isDurableMediaUrl(v.url))
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
  return mp4s[0]?.url ?? null
}

function mapItem(item: SyndicationMedia): ResolvedMedia | null {
  const still = isDurableMediaUrl(item.media_url_https) ? item.media_url_https! : null

  if (item.type === "photo") {
    return still ? { type: "image", url: still, thumbnail_url: null } : null
  }

  if (item.type === "video" || item.type === "animated_gif") {
    const url = bestMp4(item.video_info?.variants)
    if (!url) return null
    return {
      type: item.type === "animated_gif" ? "gif" : "video",
      url,
      thumbnail_url: still,
    }
  }

  return null
}

export async function resolveMediaFromSyndication(
  tweetId: string
): Promise<ResolvedMedia[]> {
  const url =
    `https://cdn.syndication.twimg.com/tweet-result` +
    `?id=${encodeURIComponent(tweetId)}&token=${syndicationToken(tweetId)}&lang=en`

  try {
    const response = await fetch(url)
    if (response.status !== 200) return []

    const payload = (await response.json()) as {
      tombstone?: unknown
      mediaDetails?: SyndicationMedia[]
    }
    if (payload.tombstone) return []

    return (payload.mediaDetails ?? [])
      .map(mapItem)
      .filter((m): m is ResolvedMedia => m !== null)
  } catch {
    // Network failure, rate limit, shape change — the caller keeps whatever the
    // DOM gave it rather than losing the save.
    return []
  }
}
