/**
 * DOM extraction logic for Twitter/X tweets.
 *
 * Given a tweet <article> element, extracts structured tweet data
 * including text, media, link cards, quote tweets, and reply context.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TweetMedia {
  type: "image" | "video" | "gif"
  url: string
}

export interface TweetLinkCard {
  url: string
  title: string
  description: string
  image: string
  site_name: string
}

export interface TweetData {
  tweet_id: string
  tweet_text: string
  author_handle: string
  author_display_name: string
  author_avatar_url: string
  timestamp: string | null
  source_url: string
  media: TweetMedia[]
  link_cards: TweetLinkCard[]
  quoted_tweet_id: string | null
  in_reply_to_tweet_id: string | null
  conversation_id: string | null
  raw_json: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract tweet ID from a permalink anchor inside the article.
 * Twitter permalinks look like: /username/status/1234567890
 */
function extractTweetId(article: Element): string | null {
  // Try time > a[href] pattern (most reliable)
  const timeLinks = article.querySelectorAll("time")
  for (const time of timeLinks) {
    const anchor = time.closest("a")
    if (anchor) {
      const match = anchor.href.match(/\/status\/(\d+)/)
      if (match) return match[1]
    }
  }

  // Fallback: any link matching /status/\d+
  const allLinks = article.querySelectorAll('a[href*="/status/"]')
  for (const link of allLinks) {
    const href = (link as HTMLAnchorElement).href
    const match = href.match(/\/status\/(\d+)/)
    if (match) return match[1]
  }

  return null
}

/**
 * Extract the author handle from the article.
 * Looks for the permalink pattern: /@handle or /handle/status/
 */
function extractAuthorHandle(article: Element): string {
  // Find the user profile link near the avatar/name area
  const userLinks = article.querySelectorAll('a[href*="/"][role="link"]')
  for (const link of userLinks) {
    const href = (link as HTMLAnchorElement).pathname
    // Match /@handle or /handle pattern (no /status/)
    const match = href.match(/^\/@?([A-Za-z0-9_]+)$/)
    if (match) return `@${match[1]}`
  }

  // Fallback: extract from permalink
  const timeEl = article.querySelector("time")
  if (timeEl) {
    const anchor = timeEl.closest("a")
    if (anchor) {
      const match = anchor.href.match(/\/([A-Za-z0-9_]+)\/status\//)
      if (match) return `@${match[1]}`
    }
  }

  return ""
}

/**
 * Extract the author's display name from the tweet header.
 * Twitter shows the display name in a bold span near the user profile link.
 */
function extractAuthorDisplayName(article: Element): string {
  // Twitter wraps the display name in div[data-testid="User-Name"]
  const userNameContainer = article.querySelector('[data-testid="User-Name"]')
  if (userNameContainer) {
    // The display name is typically the first link's text content
    const firstLink = userNameContainer.querySelector('a[role="link"]')
    if (firstLink) {
      // Get the text but exclude the @handle part
      const spans = firstLink.querySelectorAll("span")
      for (const span of spans) {
        const text = span.textContent?.trim()
        if (text && !text.startsWith("@")) {
          return text
        }
      }
    }
  }

  // Fallback: look for bold-styled span near the user link
  const userLinks = article.querySelectorAll('a[href*="/"][role="link"]')
  for (const link of userLinks) {
    const href = (link as HTMLAnchorElement).pathname
    if (href.match(/^\/@?[A-Za-z0-9_]+$/)) {
      const span = link.querySelector("span")
      if (span) {
        const text = span.textContent?.trim()
        if (text && !text.startsWith("@")) return text
      }
    }
  }

  return ""
}

/**
 * Extract the author's profile avatar URL from the tweet.
 * Twitter uses circular img elements with pbs.twimg.com/profile_images sources.
 */
function extractAuthorAvatarUrl(article: Element): string {
  // Look for profile image within or near the article
  const avatarImg = article.querySelector('img[src*="pbs.twimg.com/profile_images"]')
  if (avatarImg) {
    return (avatarImg as HTMLImageElement).src
  }

  // Fallback: look in the avatar container (data-testid="Tweet-User-Avatar")
  const avatarContainer = article.querySelector('[data-testid="Tweet-User-Avatar"]')
  if (avatarContainer) {
    const img = avatarContainer.querySelector("img")
    if (img) return img.src
  }

  return ""
}

/**
 * Extract tweet text from the article's tweetText div.
 */
function extractTweetText(article: Element): string {
  // Twitter wraps tweet text in div[data-testid="tweetText"]
  const textEl = article.querySelector('[data-testid="tweetText"]')
  if (textEl) return textEl.textContent?.trim() || ""

  // Fallback: try lang attribute divs (tweet text containers)
  const langDiv = article.querySelector("div[lang]")
  if (langDiv) return langDiv.textContent?.trim() || ""

  return ""
}

/**
 * Extract timestamp from the article.
 * Tries the datetime attribute first, then falls back to parsing the text content.
 */
function extractTimestamp(article: Element): string | null {
  // Try all time elements (there can be multiple — retweet header vs actual tweet)
  const timeEls = article.querySelectorAll("time")
  for (const timeEl of timeEls) {
    const dt = timeEl.getAttribute("datetime")
    if (dt) return dt
  }

  // Fallback: extract from the permalink URL's time element text
  // Twitter sometimes shows "Jan 15" or "3h" — not ideal but better than null
  for (const timeEl of timeEls) {
    const text = timeEl.textContent?.trim()
    if (text) {
      // Try to parse relative/absolute date text
      const parsed = Date.parse(text)
      if (!isNaN(parsed)) return new Date(parsed).toISOString()
    }
  }

  return null
}

/**
 * Extract source URL (permalink) from the article.
 */
function extractSourceUrl(article: Element): string {
  const timeEl = article.querySelector("time")
  if (timeEl) {
    const anchor = timeEl.closest("a")
    if (anchor) return anchor.href
  }
  return window.location.href
}

/**
 * Extract media (images, videos, GIFs) from the tweet.
 */
function extractMedia(article: Element): TweetMedia[] {
  const media: TweetMedia[] = []
  const seen = new Set<string>()

  // Skip quoted tweet media — only extract from the main tweet
  const quotedTweet = article.querySelector('[data-testid="quoteTweet"]')

  // Images in the tweet photo container
  const photoContainer = article.querySelector('[data-testid="tweetPhoto"]')?.closest('[aria-label]')?.parentElement || article
  const images = article.querySelectorAll('img[src*="pbs.twimg.com/media"]')
  for (const img of images) {
    // Skip if inside quoted tweet
    if (quotedTweet?.contains(img)) continue
    const src = (img as HTMLImageElement).src
    if (src && !seen.has(src)) {
      seen.add(src)
      media.push({ type: "image", url: src })
    }
  }

  // Videos
  const videos = article.querySelectorAll("video")
  for (const video of videos) {
    if (quotedTweet?.contains(video)) continue
    const src = video.src || video.querySelector("source")?.src
    if (src && !seen.has(src)) {
      seen.add(src)
      // Check if it's a GIF (Twitter marks them)
      const isGif = video.closest('[data-testid="videoPlayer"]')
        ?.querySelector('[data-testid="gifLabel"]') !== null ||
        video.closest('[data-testid="tweetPhoto"]') !== null
      media.push({ type: isGif ? "gif" : "video", url: src })
    }
  }

  return media
}

/**
 * Extract link cards (URL previews) from the tweet.
 */
function extractLinkCards(article: Element): TweetLinkCard[] {
  const cards: TweetLinkCard[] = []

  // Twitter card containers
  const cardLinks = article.querySelectorAll('[data-testid="card.wrapper"] a[href]')
  for (const link of cardLinks) {
    const anchor = link as HTMLAnchorElement
    const container = anchor.closest('[data-testid="card.wrapper"]')
    if (!container) continue

    // Don't extract cards from quoted tweets
    const quotedTweet = article.querySelector('[data-testid="quoteTweet"]')
    if (quotedTweet?.contains(container)) continue

    const card: TweetLinkCard = {
      url: anchor.href,
      title: container.querySelector('[data-testid="card.layoutLarge.header"], [data-testid="card.layoutSmall.detail"] span')?.textContent?.trim() || "",
      description: container.querySelector('[data-testid="card.layoutLarge.body"], [data-testid="card.layoutSmall.detail"]')?.textContent?.trim() || "",
      image: (container.querySelector("img") as HTMLImageElement)?.src || "",
      site_name: container.querySelector('[data-testid="card.layoutSmall.detail"] span:first-child')?.textContent?.trim() || ""
    }

    if (card.url) cards.push(card)
  }

  return cards
}

/**
 * Extract quoted tweet ID if this tweet quotes another.
 */
function extractQuotedTweetId(article: Element): string | null {
  const quotedTweet = article.querySelector('[data-testid="quoteTweet"]')
  if (!quotedTweet) return null

  const links = quotedTweet.querySelectorAll('a[href*="/status/"]')
  for (const link of links) {
    const match = (link as HTMLAnchorElement).href.match(/\/status\/(\d+)/)
    if (match) return match[1]
  }

  return null
}

/**
 * Extract in_reply_to tweet ID if this tweet is a reply.
 * Twitter shows "Replying to @user" with a link to the parent.
 */
function extractInReplyToTweetId(article: Element): string | null {
  // Check for "Replying to" indicator
  const replyingTo = article.querySelector('[data-testid="reply"]')
  if (replyingTo) {
    const link = replyingTo.querySelector('a[href*="/status/"]')
    if (link) {
      const match = (link as HTMLAnchorElement).href.match(/\/status\/(\d+)/)
      if (match) return match[1]
    }
  }

  // On tweet detail pages, check if this is part of a thread
  // The conversation_id from the URL can indicate the parent
  const url = window.location.href
  const urlMatch = url.match(/\/status\/(\d+)/)
  const tweetId = extractTweetId(article)
  if (urlMatch && tweetId && urlMatch[1] !== tweetId) {
    // We're viewing a thread and this tweet is not the main one
    return urlMatch[1]
  }

  return null
}

/**
 * Extract conversation ID from the page URL or tweet context.
 */
function extractConversationId(article: Element): string | null {
  // On a tweet detail page, the URL contains the conversation root
  const urlMatch = window.location.href.match(/\/status\/(\d+)/)
  if (urlMatch) return urlMatch[1]
  return null
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract structured tweet data from a tweet article element.
 *
 * @param article - The <article> DOM element representing a tweet
 * @returns TweetData object, or null if tweet_id cannot be determined
 */
export function extractTweetData(article: Element): TweetData | null {
  const tweet_id = extractTweetId(article)
  if (!tweet_id) return null

  const data: TweetData = {
    tweet_id,
    tweet_text: extractTweetText(article),
    author_handle: extractAuthorHandle(article),
    author_display_name: extractAuthorDisplayName(article),
    author_avatar_url: extractAuthorAvatarUrl(article),
    timestamp: extractTimestamp(article),
    source_url: extractSourceUrl(article),
    media: extractMedia(article),
    link_cards: extractLinkCards(article),
    quoted_tweet_id: extractQuotedTweetId(article),
    in_reply_to_tweet_id: extractInReplyToTweetId(article),
    conversation_id: extractConversationId(article),
    raw_json: {}
  }

  // Store the full extracted data as raw_json for future use
  data.raw_json = { ...data }

  return data
}

/**
 * Find the tweet article element for a given tweet ID on the page.
 */
export function findTweetArticle(tweetId: string): Element | null {
  const articles = document.querySelectorAll("article")
  for (const article of articles) {
    const id = extractTweetId(article)
    if (id === tweetId) return article
  }
  return null
}
