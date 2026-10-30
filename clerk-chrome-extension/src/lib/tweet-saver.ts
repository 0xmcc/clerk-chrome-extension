/**
 * Supabase upsert logic for saving tweets.
 *
 * Handles upserting tweets, recursively saving quoted tweets,
 * and batch-checking which tweets are already saved.
 */

import { getSupabaseClient } from "./supabase"
import type { TweetData } from "./tweet-extractor"
import { extractTweetData, expandLongPost, findTweetArticle } from "./tweet-extractor"
import { folderTagsFrom, mergeTags } from "./folder-tags"
import { resolveMediaFromSyndication } from "./media-resolver"

// ---------------------------------------------------------------------------
// Save tweet
// ---------------------------------------------------------------------------

/**
 * Upsert a tweet into the Supabase `tweets` table.
 *
 * - If the tweet already exists (matched on tweet_id), updates saved_at and raw_json.
 * - If quoted_tweet_id is present, attempts to save the quoted tweet first.
 * - If in_reply_to_tweet_id is present, attempts best-effort save of the parent.
 *
 * @param tweetData - Extracted tweet data
 * @returns The upserted tweet row, or throws on failure
 */
export async function saveTweet(tweetData: TweetData): Promise<void> {
  const supabase = getSupabaseClient()

  // Recursively save quoted tweet first (if present)
  if (tweetData.quoted_tweet_id) {
    try {
      const quotedArticle = findTweetArticle(tweetData.quoted_tweet_id)
      if (quotedArticle) {
        await expandLongPost(quotedArticle)
        const quotedData = extractTweetData(quotedArticle)
        if (quotedData) {
          await saveTweet(quotedData)
        }
      } else {
        // Quoted tweet not in DOM — insert a stub so the FK reference works
        await supabase.from("tweets").upsert(
          {
            tweet_id: tweetData.quoted_tweet_id,
            saved_at: new Date().toISOString()
          },
          { onConflict: "tweet_id", ignoreDuplicates: true }
        )
      }
    } catch (err) {
      console.warn("[TweetSaver] Failed to save quoted tweet:", err)
      // Don't fail the main save
    }
  }

  // Best-effort save of reply parent (if present)
  if (tweetData.in_reply_to_tweet_id && tweetData.in_reply_to_tweet_id !== tweetData.quoted_tweet_id) {
    try {
      const parentArticle = findTweetArticle(tweetData.in_reply_to_tweet_id)
      if (parentArticle) {
        await expandLongPost(parentArticle)
        const parentData = extractTweetData(parentArticle)
        if (parentData) {
          await saveTweet(parentData)
        }
      }
      // If parent not in DOM, just store the ID reference — don't create a stub
    } catch (err) {
      console.warn("[TweetSaver] Failed to save reply parent:", err)
      // Don't fail the main save
    }
  }

  // X exposes video and GIFs only as blob: URLs, which die with the tab. When
  // the DOM gave us nothing durable, resolve the real video.twimg.com /
  // pbs.twimg.com URLs before writing — otherwise the row records media that
  // can never be fetched again. Best-effort: keep the DOM media on failure.
  let media = tweetData.media
  if (media.some((m) => !m.url)) {
    const resolved = await resolveMediaFromSyndication(tweetData.tweet_id)
    if (resolved.length > 0) media = resolved
  }

  // Compute content type flags
  const has_media = media.length > 0
  const has_article = tweetData.link_cards.length > 0  // Has rich preview card
  const has_link = tweetData.urls.length > 0  // Has any URL (card or plain)
  const has_quote = tweetData.quoted_tweet_id !== null
  // First URL: prefer article card URL, fallback to first extracted URL
  const article_url = tweetData.link_cards.length > 0 
    ? tweetData.link_cards[0].url 
    : (tweetData.urls.length > 0 ? tweetData.urls[0] : null)

  // Which bookmarks folder this save came from. The X API cannot filter by
  // folder, so save time is the only moment this is knowable — and the reels
  // publisher selects rows by exactly these tags. Merge rather than assign:
  // the upsert matches on tweet_id, and a tweet can sit in several folders.
  const folderTags = folderTagsFrom(window.location.pathname)
  let tags: string[] | null = null
  if (folderTags.length > 0) {
    const { data: existing } = await supabase
      .from("tweets")
      .select("tags")
      .eq("tweet_id", tweetData.tweet_id)
      .maybeSingle()
    tags = mergeTags(existing?.tags, folderTags)
  }

  // Upsert the main tweet
  const { error } = await supabase.from("tweets").upsert(
    {
      tweet_id: tweetData.tweet_id,
      tweet_text: tweetData.tweet_text,
      author_handle: tweetData.author_handle,
      author_display_name: tweetData.author_display_name,
      author_avatar_url: tweetData.author_avatar_url,
      timestamp: tweetData.timestamp,
      source_url: tweetData.source_url,
      media,
      link_cards: tweetData.link_cards,
      quoted_tweet_id: tweetData.quoted_tweet_id,
      in_reply_to_tweet_id: tweetData.in_reply_to_tweet_id,
      conversation_id: tweetData.conversation_id,
      raw_json: tweetData.raw_json,
      saved_at: new Date().toISOString(),
      has_media,
      has_article,
      has_link,
      has_quote,
      article_url,
      urls: tweetData.urls,
      // Only write metrics when we actually read some. An empty object would
      // overwrite good API-sourced counts with nothing on a re-save.
      ...(Object.keys(tweetData.public_metrics ?? {}).length > 0
        ? { public_metrics: tweetData.public_metrics }
        : {}),
      // Same reasoning: a save made outside a folder must not clear the tags
      // a folder save previously wrote.
      ...(tags ? { tags } : {})
    },
    { onConflict: "tweet_id" }
  )

  if (error) {
    console.error("[TweetSaver] Upsert failed:", error)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Batch check
// ---------------------------------------------------------------------------

/**
 * Check which tweet IDs are already saved in the database.
 *
 * @param tweetIds - Array of tweet IDs to check
 * @returns Set of tweet IDs that are already saved
 */
export async function checkSavedTweets(tweetIds: string[]): Promise<Set<string>> {
  if (tweetIds.length === 0) return new Set()

  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from("tweets")
    .select("tweet_id")
    .in("tweet_id", tweetIds)

  if (error) {
    console.error("[TweetSaver] Batch check failed:", error)
    return new Set()
  }

  return new Set((data || []).map((row: { tweet_id: string }) => row.tweet_id))
}

/** Tweets that already have their content, metrics, and current folder tag. */
export async function checkCompletedTweets(
  tweetIds: string[],
  requiredTags: string[] = []
): Promise<Set<string>> {
  if (tweetIds.length === 0) return new Set()

  const { data, error } = await getSupabaseClient()
    .from("tweets")
    .select("tweet_id,public_metrics,tags")
    .in("tweet_id", tweetIds)

  if (error) throw error

  return new Set((data || [])
    .filter((row: { public_metrics: Record<string, unknown> | null; tags: string[] | null }) =>
      row.public_metrics && Object.keys(row.public_metrics).length > 0 &&
      requiredTags.every((tag) => row.tags?.includes(tag))
    )
    .map((row: { tweet_id: string }) => row.tweet_id))
}

/** Fill metrics on an existing save only; this never creates a tweet. */
export async function backfillMetricsForTweet(
  tweetId: string,
  metrics: TweetData["public_metrics"]
): Promise<"updated" | "skipped"> {
  if (Object.keys(metrics ?? {}).length === 0) return "skipped"

  const { data, error } = await getSupabaseClient()
    .from("tweets")
    .update({ public_metrics: metrics })
    .eq("tweet_id", tweetId)
    .is("public_metrics", null)
    .select("tweet_id")

  if (error) throw error
  return data?.length ? "updated" : "skipped"
}

/** Add the current folder to already saved rows without replacing their tags. */
export async function tagExistingTweets(
  tweetIds: string[],
  folderTags: string[]
): Promise<number> {
  if (tweetIds.length === 0 || folderTags.length === 0) return 0

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("tweets")
    .select("tweet_id,tags")
    .in("tweet_id", tweetIds)

  if (error) throw error

  let tagged = 0
  for (const row of data || []) {
    const merged = mergeTags(row.tags, folderTags)
    if (merged.length === (row.tags?.length ?? 0)) continue
    const { error: updateError } = await supabase
      .from("tweets")
      .update({ tags: merged })
      .eq("tweet_id", row.tweet_id)
    if (updateError) throw updateError
    tagged++
  }
  return tagged
}
