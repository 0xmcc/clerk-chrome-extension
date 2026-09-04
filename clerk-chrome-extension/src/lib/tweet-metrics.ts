/**
 * Engagement counts, read from the tweet's action bar at save time.
 *
 * Extension-saved tweets have always been written with public_metrics: null —
 * the scraper read text and media but never the counts, so only the official
 * API bookmark sync ever populated them. The result is a hole that grows with
 * every save and can only be closed by paying for API reads later.
 *
 * The numbers are already on screen. X renders abbreviated text inside the
 * buttons ("1.2M") but exposes exact figures in the action bar's aria-label for
 * screen readers, so the label is the primary source and the buttons are a
 * lossy fallback. No network request, no model, no rate limiting — this only
 * reads a page that is already open.
 */

export interface TweetMetrics {
  like_count?: number
  retweet_count?: number
  reply_count?: number
  bookmark_count?: number
  impression_count?: number
}

/** "1.2K" -> 1200, "5,390" -> 5390. Null when the text is not a count. */
export function parseCompactNumber(text?: string | null): number | null {
  if (!text) return null
  const match = text.trim().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i)
  if (!match) return null

  const value = parseFloat(match[1])
  if (Number.isNaN(value)) return null

  const scale = { k: 1e3, m: 1e6, b: 1e9 }[match[2]?.toLowerCase() ?? ""] ?? 1
  return Math.round(value * scale)
}

const LABEL_FIELDS: Array<[RegExp, keyof TweetMetrics]> = [
  [/([\d,.]+[KMB]?)\s+repl(?:y|ies)/i, "reply_count"],
  [/([\d,.]+[KMB]?)\s+(?:repost|retweet)s?/i, "retweet_count"],
  [/([\d,.]+[KMB]?)\s+likes?/i, "like_count"],
  [/([\d,.]+[KMB]?)\s+bookmarks?/i, "bookmark_count"],
  [/([\d,.]+[KMB]?)\s+views?/i, "impression_count"],
]

/**
 * Pull exact counts out of the action bar's aria-label, e.g.
 * "23 replies, 45 reposts, 678 likes, 12 bookmarks, 90123 views".
 * Buckets X omits (a zero count) are simply absent from the result.
 */
export function parseEngagementLabel(label?: string | null): TweetMetrics {
  if (!label) return {}
  const metrics: TweetMetrics = {}
  for (const [pattern, field] of LABEL_FIELDS) {
    const value = parseCompactNumber(label.match(pattern)?.[1])
    if (value !== null) metrics[field] = value
  }
  return metrics
}

/** Abbreviated per-button counts — used only when no aria-label is available. */
const BUTTON_FIELDS: Array<[string, keyof TweetMetrics]> = [
  ["reply", "reply_count"],
  ["retweet", "retweet_count"],
  ["like", "like_count"],
  ["bookmark", "bookmark_count"],
]

function metricsFromButtons(group: Element): TweetMetrics {
  const metrics: TweetMetrics = {}
  for (const [testid, field] of BUTTON_FIELDS) {
    const value = parseCompactNumber(
      group.querySelector(`[data-testid="${testid}"]`)?.textContent
    )
    if (value !== null) metrics[field] = value
  }
  return metrics
}

/**
 * Read whatever engagement counts this article exposes.
 *
 * A metric that cannot be read is left absent rather than defaulted to 0 — a
 * real zero has to stay distinguishable from a failed read, which is exactly
 * the confusion that let silent truncation go unnoticed for months.
 */
export function extractMetrics(article: Element): TweetMetrics {
  const group = article.querySelector('[role="group"]')
  if (!group) return {}

  const fromLabel = parseEngagementLabel(group.getAttribute("aria-label"))
  const fromButtons = metricsFromButtons(group)

  // Label values are exact; button values are abbreviated. Prefer the label,
  // and let buttons fill only what the label did not provide.
  return { ...fromButtons, ...fromLabel }
}
