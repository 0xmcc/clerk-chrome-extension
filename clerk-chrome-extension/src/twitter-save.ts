import type { PlasmoCSConfig } from "plasmo"

import { SUPABASE_ANON_KEY, SUPABASE_TWEETS_TABLE, SUPABASE_URL } from "~config/supabase"
import { requestClerkToken } from "~utils/clerk"

export const config: PlasmoCSConfig = {
  matches: ["https://x.com/*", "https://twitter.com/*"],
  run_at: "document_idle"
}

const TWEET_SELECTOR = 'article[data-testid="tweet"], article[role="article"]'
const ACTION_ROW_SELECTOR = 'div[role="group"]'
const STYLE_ID = "tweet-save-style"

const SAVE_ACTION_CLASS = "tweet-save-action"
const SAVE_BUTTON_CLASS = "tweet-save-button"
const SAVE_LABEL_CLASS = "tweet-save-label"

type TweetMedia = {
  type: string
  url: string | null
  width: number | null
  height: number | null
  duration: number | null
  thumbnail: string | null
}

type TweetLinkCard = {
  url: string
  title: string | null
  description: string | null
  image: string | null
  site_name: string | null
}

type ExtractedTweet = {
  tweetId: string
  tweetText: string | null
  authorHandle: string | null
  timestamp: string | null
  sourceUrl: string | null
  lang: string | null
  media: TweetMedia[]
  linkCards: TweetLinkCard[]
  quotedTweetId: string | null
  quotedTweet: ExtractedTweet | null
  inReplyToTweetId: string | null
  conversationId: string | null
  rawJson: Record<string, unknown>
}

type TweetRow = {
  tweet_id: string
  tweet_text: string | null
  author_handle: string | null
  timestamp: string | null
  source_url: string | null
  lang: string | null
  media: TweetMedia[]
  link_cards: TweetLinkCard[]
  quoted_tweet_id: string | null
  in_reply_to_tweet_id: string | null
  conversation_id: string | null
  raw_json: Record<string, unknown>
  saved_at: string
  last_seen_at: string
  user_id: string
}

const savedTweetIds = new Set<string>()
const savingTweetIds = new Set<string>()

const scanQueue = new Set<Element>()
let scanScheduled = false

const start = () => {
  ensureStyles()
  scanAndInject(document)
  observeForTweets()
}

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .${SAVE_ACTION_CLASS} {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      min-width: 0;
    }
    .${SAVE_BUTTON_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0;
      border: none;
      background: transparent;
      color: rgb(113, 118, 123);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      line-height: 1;
    }
    .${SAVE_BUTTON_CLASS}[data-state="saving"] {
      color: rgb(29, 155, 240);
    }
    .${SAVE_BUTTON_CLASS}[data-state="saved"] {
      color: rgb(0, 186, 124);
    }
    .${SAVE_BUTTON_CLASS}[data-state="error"] {
      color: rgb(244, 33, 46);
    }
    .${SAVE_BUTTON_CLASS}:disabled {
      cursor: default;
      opacity: 0.7;
    }
    .${SAVE_LABEL_CLASS} {
      font-weight: 500;
      white-space: nowrap;
    }
  `
  document.head.appendChild(style)
}

const observeForTweets = () => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          scanQueue.add(node)
        }
      })
    }
    scheduleScan()
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

const scheduleScan = () => {
  if (scanScheduled) return
  scanScheduled = true
  requestAnimationFrame(() => {
    scanScheduled = false
    if (scanQueue.size === 0) return
    scanQueue.forEach((node) => scanAndInject(node))
    scanQueue.clear()
  })
}

const scanAndInject = (root: ParentNode) => {
  if (root instanceof Element && root.matches(TWEET_SELECTOR)) {
    injectSaveButton(root)
  }

  const tweets = root.querySelectorAll(TWEET_SELECTOR)
  tweets.forEach((tweet) => injectSaveButton(tweet))
}

const injectSaveButton = (tweetNode: Element) => {
  const actionRow = findActionRow(tweetNode)
  if (!actionRow) return
  if (actionRow.querySelector(`.${SAVE_ACTION_CLASS}`)) return

  const tweetId = extractTweetId(tweetNode)
  if (!tweetId) return

  const container = document.createElement("div")
  container.className = SAVE_ACTION_CLASS

  const button = document.createElement("button")
  button.type = "button"
  button.className = SAVE_BUTTON_CLASS
  button.dataset.tweetId = tweetId
  button.setAttribute("aria-label", "Save tweet")
  button.title = "Save tweet"

  const label = document.createElement("span")
  label.className = SAVE_LABEL_CLASS
  label.textContent = savedTweetIds.has(tweetId) ? "Saved" : "Save"

  button.dataset.state = savedTweetIds.has(tweetId) ? "saved" : "idle"
  button.appendChild(label)

  button.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (savingTweetIds.has(tweetId)) return
    void handleSaveClick(button, tweetNode)
  })

  container.appendChild(button)
  actionRow.appendChild(container)
}

const handleSaveClick = async (button: HTMLButtonElement, tweetNode: Element) => {
  const tweetId = button.dataset.tweetId
  if (!tweetId) return

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[TweetSave] Missing Supabase configuration")
    updateButtonState(button, "error")
    return
  }

  updateButtonState(button, "saving")
  savingTweetIds.add(tweetId)

  try {
    const token = await requestClerkToken()
    const userId = extractUserIdFromToken(token)
    if (!userId) {
      throw new Error("Unable to identify user from Clerk token.")
    }

    const extracted = extractTweetFromArticle(tweetNode)
    if (!extracted) {
      throw new Error("Unable to extract tweet data.")
    }

    const now = new Date().toISOString()
    const rows = buildTweetRows(extracted, { now, userId })

    await upsertTweets(rows, token)

    savedTweetIds.add(tweetId)
    updateButtonState(button, "saved")
  } catch (error) {
    console.error("[TweetSave] Save failed:", error)
    updateButtonState(button, "error")
  } finally {
    savingTweetIds.delete(tweetId)
  }
}

const updateButtonState = (button: HTMLButtonElement, state: "idle" | "saving" | "saved" | "error") => {
  const label = button.querySelector(`.${SAVE_LABEL_CLASS}`) as HTMLSpanElement | null
  const labels = {
    idle: "Save",
    saving: "Saving...",
    saved: "Saved",
    error: "Retry"
  }

  button.dataset.state = state
  if (label) {
    label.textContent = labels[state]
  }
  button.disabled = state === "saving"
}

const findActionRow = (tweetNode: Element): Element | null => {
  const groups = tweetNode.querySelectorAll(ACTION_ROW_SELECTOR)
  for (const group of Array.from(groups)) {
    if (group.querySelector('[data-testid="reply"]')) {
      return group
    }
  }
  return tweetNode.querySelector(ACTION_ROW_SELECTOR)
}

const extractTweetFromArticle = (tweetNode: Element, opts?: { includeQuoted?: boolean }): ExtractedTweet | null => {
  const includeQuoted = opts?.includeQuoted ?? true

  const sourceUrl = extractTweetUrl(tweetNode)
  const tweetId = extractTweetId(tweetNode, sourceUrl)
  if (!tweetId) return null

  const stateTweet = getTweetState(tweetId)
  const tweetText = extractTweetText(tweetNode) || stateTweet?.full_text || stateTweet?.text || null
  const authorHandle = extractAuthorHandle(tweetNode) || stateTweet?.user?.screen_name || null
  const timestamp = extractTimestamp(tweetNode) || normalizeTimestamp(stateTweet?.created_at)
  const lang = extractLanguage(tweetNode) || stateTweet?.lang || null
  const media = mergeMedia(extractMediaFromDom(tweetNode), extractMediaFromState(stateTweet))
  const linkCards = mergeLinkCards(extractLinkCardsFromDom(tweetNode), extractLinkCardsFromState(stateTweet))
  const inReplyToTweetId =
    stateTweet?.in_reply_to_status_id_str ||
    stateTweet?.in_reply_to_status_id ||
    extractReplyIdFromDom(tweetNode) ||
    null
  const conversationId =
    stateTweet?.conversation_id_str ||
    stateTweet?.conversation_id ||
    extractConversationIdFromDom(tweetNode) ||
    tweetId

  let quotedTweetId =
    stateTweet?.quoted_status_id_str ||
    stateTweet?.quoted_status_id ||
    extractQuotedIdFromDom(tweetNode) ||
    null
  let quotedTweet: ExtractedTweet | null = null

  if (includeQuoted) {
    const quotedNode = findQuotedTweetNode(tweetNode, quotedTweetId)
    if (quotedNode) {
      quotedTweet = extractTweetFromArticle(quotedNode, { includeQuoted: false })
      if (quotedTweet?.tweetId) {
        quotedTweetId = quotedTweet.tweetId
      }
    }
  }

  const rawJson: Record<string, unknown> = {
    source: stateTweet ? "state" : "dom",
    extracted_at: new Date().toISOString(),
    tweet_id: tweetId,
    source_url: sourceUrl,
    text: tweetText,
    author_handle: authorHandle,
    timestamp,
    lang,
    in_reply_to_tweet_id: inReplyToTweetId,
    quoted_tweet_id: quotedTweetId,
    conversation_id: conversationId,
    media,
    link_cards: linkCards,
    state: stateTweet ?? null
  }

  return {
    tweetId,
    tweetText,
    authorHandle,
    timestamp,
    sourceUrl,
    lang,
    media,
    linkCards,
    quotedTweetId,
    quotedTweet,
    inReplyToTweetId,
    conversationId,
    rawJson
  }
}

const extractTweetUrl = (tweetNode: Element): string | null => {
  const timeElement = tweetNode.querySelector("time")
  const timeLink = timeElement?.closest("a") as HTMLAnchorElement | null
  if (timeLink?.href) return timeLink.href

  const link = tweetNode.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null
  return link?.href || null
}

const extractTweetId = (tweetNode: Element, sourceUrl?: string | null): string | null => {
  const fromUrl = extractTweetIdFromUrl(sourceUrl)
  if (fromUrl) return fromUrl

  const link = tweetNode.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null
  return extractTweetIdFromUrl(link?.href)
}

const extractTweetIdFromUrl = (url?: string | null): string | null => {
  if (!url) return null
  const match = url.match(/\/status\/(\d+)/)
  return match?.[1] || null
}

const extractTweetText = (tweetNode: Element): string | null => {
  const textElement = tweetNode.querySelector('div[data-testid="tweetText"]') as HTMLElement | null
  const text = textElement?.innerText?.trim()
  return text || null
}

const extractAuthorHandle = (tweetNode: Element): string | null => {
  const userName = tweetNode.querySelector('div[data-testid="User-Name"]')
  const text = userName?.textContent || ""
  const match = text.match(/@([A-Za-z0-9_]+)/)
  return match?.[1] || null
}

const extractTimestamp = (tweetNode: Element): string | null => {
  const timeElement = tweetNode.querySelector("time")
  const datetime = timeElement?.getAttribute("datetime")
  if (!datetime) return null
  return new Date(datetime).toISOString()
}

const normalizeTimestamp = (timestamp?: string | null): string | null => {
  if (!timestamp) return null
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const extractLanguage = (tweetNode: Element): string | null => {
  const textElement = tweetNode.querySelector('div[data-testid="tweetText"]')
  return textElement?.getAttribute("lang") || document.documentElement.lang || null
}

const extractConversationIdFromDom = (tweetNode: Element): string | null => {
  const attr = tweetNode.getAttribute("data-conversation-id")
  if (attr) return attr
  const el = tweetNode.querySelector("[data-conversation-id]") as HTMLElement | null
  return el?.dataset.conversationId || null
}

const extractReplyIdFromDom = (tweetNode: Element): string | null => {
  const attr = tweetNode.getAttribute("data-in-reply-to")
  if (attr) return attr
  const el = tweetNode.querySelector("[data-in-reply-to]") as HTMLElement | null
  return el?.dataset.inReplyTo || null
}

const extractQuotedIdFromDom = (tweetNode: Element): string | null => {
  const attr = tweetNode.getAttribute("data-quoted-tweet-id")
  if (attr) return attr
  const el = tweetNode.querySelector("[data-quoted-tweet-id]") as HTMLElement | null
  return el?.dataset.quotedTweetId || null
}

const extractMediaFromDom = (tweetNode: Element): TweetMedia[] => {
  const media: TweetMedia[] = []
  const seenUrls = new Set<string>()

  const photoNodes = tweetNode.querySelectorAll('div[data-testid="tweetPhoto"] img')
  photoNodes.forEach((img) => {
    const url = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || null
    if (!url || seenUrls.has(url)) return
    seenUrls.add(url)
    media.push({
      type: "image",
      url,
      width: (img as HTMLImageElement).naturalWidth || null,
      height: (img as HTMLImageElement).naturalHeight || null,
      duration: null,
      thumbnail: url
    })
  })

  const videoNodes = tweetNode.querySelectorAll('div[data-testid="videoPlayer"] video')
  videoNodes.forEach((video) => {
    const htmlVideo = video as HTMLVideoElement
    const url = htmlVideo.currentSrc || htmlVideo.src || null
    if (url && seenUrls.has(url)) return
    if (url) seenUrls.add(url)
    media.push({
      type: "video",
      url,
      width: htmlVideo.videoWidth || null,
      height: htmlVideo.videoHeight || null,
      duration: Number.isFinite(htmlVideo.duration) ? htmlVideo.duration : null,
      thumbnail: htmlVideo.poster || null
    })
  })

  return media
}

const extractMediaFromState = (stateTweet: any): TweetMedia[] => {
  const media = stateTweet?.extended_entities?.media || stateTweet?.entities?.media
  if (!Array.isArray(media)) return []

  return media.map((item: any) => {
    const base = {
      type: item?.type || "image",
      url: item?.media_url_https || item?.media_url || null,
      width: item?.original_info?.width || item?.sizes?.large?.w || null,
      height: item?.original_info?.height || item?.sizes?.large?.h || null,
      duration: item?.video_info?.duration_millis
        ? item.video_info.duration_millis / 1000
        : null,
      thumbnail: item?.media_url_https || item?.media_url || null
    }

    if (Array.isArray(item?.video_info?.variants)) {
      const mp4Variants = item.video_info.variants.filter((v: any) => v?.content_type === "video/mp4")
      const best = mp4Variants.sort((a: any, b: any) => (b?.bitrate || 0) - (a?.bitrate || 0))[0]
      if (best?.url) {
        return { ...base, url: best.url }
      }
    }

    return base
  })
}

const mergeMedia = (domMedia: TweetMedia[], stateMedia: TweetMedia[]): TweetMedia[] => {
  const merged = new Map<string, TweetMedia>()
  domMedia.forEach((item) => {
    if (item.url) merged.set(item.url, item)
  })
  stateMedia.forEach((item) => {
    const key = item.url || `${item.type}-${item.thumbnail || "media"}`
    if (!merged.has(key)) {
      merged.set(key, item)
    }
  })
  return Array.from(merged.values())
}

const extractLinkCardsFromDom = (tweetNode: Element): TweetLinkCard[] => {
  const cards: TweetLinkCard[] = []
  const wrappers = tweetNode.querySelectorAll('[data-testid="card.wrapper"]')

  wrappers.forEach((wrapper) => {
    const link = wrapper.querySelector("a[href]") as HTMLAnchorElement | null
    const url = link?.href
    if (!url) return

    const image = (wrapper.querySelector("img") as HTMLImageElement | null)?.currentSrc || null
    const textNodes = Array.from(wrapper.querySelectorAll('[dir="auto"]'))
      .map((node) => node.textContent?.trim() || "")
      .filter(Boolean)
    const uniqueTexts = Array.from(new Set(textNodes))

    cards.push({
      url,
      title: uniqueTexts[0] || null,
      description: uniqueTexts[1] || null,
      image,
      site_name: uniqueTexts[uniqueTexts.length - 1] || null
    })
  })

  return cards
}

const extractLinkCardsFromState = (stateTweet: any): TweetLinkCard[] => {
  const urls = stateTweet?.entities?.urls
  if (!Array.isArray(urls)) return []

  return urls
    .map((url: any) => {
      const expanded = url?.expanded_url || url?.url
      if (!expanded) return null
      return {
        url: expanded,
        title: null,
        description: null,
        image: null,
        site_name: url?.display_url || null
      }
    })
    .filter((card): card is TweetLinkCard => Boolean(card))
}

const mergeLinkCards = (domCards: TweetLinkCard[], stateCards: TweetLinkCard[]): TweetLinkCard[] => {
  const merged = new Map<string, TweetLinkCard>()
  domCards.forEach((card) => merged.set(card.url, card))
  stateCards.forEach((card) => {
    if (!merged.has(card.url)) merged.set(card.url, card)
  })
  return Array.from(merged.values())
}

const findQuotedTweetNode = (tweetNode: Element, quotedTweetId: string | null): Element | null => {
  if (quotedTweetId) {
    const byId = findTweetNodeById(quotedTweetId)
    if (byId && tweetNode.contains(byId)) {
      return byId
    }
  }

  const nestedArticles = tweetNode.querySelectorAll(TWEET_SELECTOR)
  for (const nested of Array.from(nestedArticles)) {
    if (nested === tweetNode) continue
    return nested
  }
  return null
}

const findTweetNodeById = (tweetId: string): Element | null => {
  const link = document.querySelector(`a[href*="/status/${tweetId}"]`)
  return link?.closest("article") || null
}

const getTweetState = (tweetId: string): any | null => {
  const win = window as any

  const apollo = win.__APOLLO_STATE__
  if (apollo && typeof apollo === "object") {
    const direct = apollo[`Tweet:${tweetId}`]
    if (direct) return direct

    const key = Object.keys(apollo).find((k) => k.startsWith(`Tweet:${tweetId}`))
    if (key) return apollo[key]
  }

  const initial = win.__INITIAL_STATE__
  const entityTweet =
    initial?.entities?.tweets?.entities?.[tweetId] ||
    initial?.entities?.tweets?.[tweetId] ||
    null
  if (entityTweet) return entityTweet

  return null
}

const buildTweetRows = (
  extracted: ExtractedTweet,
  options: { now: string; userId: string }
): TweetRow[] => {
  const rows = new Map<string, TweetRow>()
  const baseUrl = `https://x.com/i/web/status/`

  const addRow = (tweet: ExtractedTweet, overrides?: Partial<TweetRow>) => {
    const sourceUrl = tweet.sourceUrl || `${baseUrl}${tweet.tweetId}`
    rows.set(tweet.tweetId, {
      tweet_id: tweet.tweetId,
      tweet_text: tweet.tweetText,
      author_handle: tweet.authorHandle,
      timestamp: tweet.timestamp,
      source_url: sourceUrl,
      lang: tweet.lang,
      media: tweet.media,
      link_cards: tweet.linkCards,
      quoted_tweet_id: tweet.quotedTweetId,
      in_reply_to_tweet_id: tweet.inReplyToTweetId,
      conversation_id: tweet.conversationId,
      raw_json: tweet.rawJson,
      saved_at: options.now,
      last_seen_at: options.now,
      user_id: options.userId,
      ...overrides
    })
  }

  addRow(extracted)

  if (extracted.inReplyToTweetId && !rows.has(extracted.inReplyToTweetId)) {
    const parentNode = findTweetNodeById(extracted.inReplyToTweetId)
    const parentTweet = parentNode
      ? extractTweetFromArticle(parentNode, { includeQuoted: false })
      : null

    if (parentTweet) {
      addRow(parentTweet)
    } else {
      rows.set(extracted.inReplyToTweetId, {
        tweet_id: extracted.inReplyToTweetId,
        tweet_text: null,
        author_handle: null,
        timestamp: null,
        source_url: `${baseUrl}${extracted.inReplyToTweetId}`,
        lang: null,
        media: [],
        link_cards: [],
        quoted_tweet_id: null,
        in_reply_to_tweet_id: null,
        conversation_id: extracted.conversationId,
        raw_json: {
          source: "fallback",
          tweet_id: extracted.inReplyToTweetId,
          extracted_at: options.now
        },
        saved_at: options.now,
        last_seen_at: options.now,
        user_id: options.userId
      })
    }
  }

  if (extracted.quotedTweetId && !rows.has(extracted.quotedTweetId)) {
    if (extracted.quotedTweet) {
      addRow(extracted.quotedTweet)
    } else {
      rows.set(extracted.quotedTweetId, {
        tweet_id: extracted.quotedTweetId,
        tweet_text: null,
        author_handle: null,
        timestamp: null,
        source_url: `${baseUrl}${extracted.quotedTweetId}`,
        lang: null,
        media: [],
        link_cards: [],
        quoted_tweet_id: null,
        in_reply_to_tweet_id: null,
        conversation_id: extracted.conversationId,
        raw_json: {
          source: "fallback",
          tweet_id: extracted.quotedTweetId,
          extracted_at: options.now
        },
        saved_at: options.now,
        last_seen_at: options.now,
        user_id: options.userId
      })
    }
  }

  return Array.from(rows.values())
}

const upsertTweets = async (rows: TweetRow[], token: string) => {
  const baseUrl = SUPABASE_URL.replace(/\/$/, "")
  const endpoint = `${baseUrl}/rest/v1/${SUPABASE_TWEETS_TABLE}?on_conflict=tweet_id`

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Supabase upsert failed (${response.status})`)
  }
}

const extractUserIdFromToken = (token: string): string | null => {
  const payload = decodeJwtPayload(token)
  if (!payload) return null
  return (
    (payload.sub as string | undefined) ||
    (payload.user_id as string | undefined) ||
    (payload.uid as string | undefined) ||
    null
  )
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split(".")
  if (parts.length < 2) return null
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true })
} else {
  start()
}
