/**
 * Supabase upsert logic for saving tweets.
 *
 * Handles upserting tweets, recursively saving quoted tweets,
 * and batch-checking which tweets are already saved.
 */

import { getSupabaseClient } from "./supabase"
import type { TweetData } from "./tweet-extractor"
import { extractTweetData, findTweetArticle } from "./tweet-extractor"

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

  // Compute content type flags
  const has_media = tweetData.media.length > 0
  const has_article = tweetData.link_cards.length > 0
  const has_quote = tweetData.quoted_tweet_id !== null
  const article_url = tweetData.link_cards.length > 0 ? tweetData.link_cards[0].url : null

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
      media: tweetData.media,
      link_cards: tweetData.link_cards,
      quoted_tweet_id: tweetData.quoted_tweet_id,
      in_reply_to_tweet_id: tweetData.in_reply_to_tweet_id,
      conversation_id: tweetData.conversation_id,
      raw_json: tweetData.raw_json,
      saved_at: new Date().toISOString(),
      has_media,
      has_article,
      has_quote,
      article_url
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
