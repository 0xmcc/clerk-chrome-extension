import { useMemo } from "react"
import { sharedStore } from "./useMessageScanner/store"
import type { Message } from "./useMessageScanner/types"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyActivity {
  dayLabel: string        // "M", "T", "W", "T", "F", "S", "S"
  messageCount: number
  tokenEstimate: number
  date: Date
}

export interface ActivityMetrics {
  // Weekly Identity Card
  weeklyTokens: number
  weeklyTokensFormatted: string
  streak: number
  percentileLabel: string

  // Context Capacity Card
  contextRemaining: number

  // 7-Day Activity Chart
  dailyActivity: DailyActivity[]
  maxDailyTokens: number

  // Meta
  hasData: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

/** Estimate tokens from text: ~4 characters per token */
const estimateTokens = (text: string): number => Math.ceil((text?.length || 0) / 4)

/** Format token count: 142500 -> "142.5k" */
const formatTokenCount = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return tokens.toString()
}

/** Get Monday 00:00:00 of the current week */
const getWeekStart = (date: Date = new Date()): Date => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Get start of day (00:00:00) */
const getDayStart = (timestamp: number): number => {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const useActivityMetrics = (
  currentMessages: Array<{ text: string; role: string }>
): ActivityMetrics => {
  return useMemo(() => {
    const conversations = Array.from(sharedStore.values())
    const now = new Date()
    const weekStart = getWeekStart(now)
    const weekStartMs = weekStart.getTime()

    // Initialize 7-day buckets (Monday to Sunday)
    const dailyBuckets = new Map<number, { tokens: number; messages: number }>()
    for (let i = 0; i < 7; i++) {
      const dayMs = weekStartMs + i * 86_400_000
      dailyBuckets.set(dayMs, { tokens: 0, messages: 0 })
    }

    // Aggregate all messages from this week
    let weeklyTokens = 0

    for (const convo of conversations) {
      // Use lastSeenAt (when extension observed it) to avoid false attribution
      const convoTime = convo.lastSeenAt
      if (convoTime < weekStartMs) continue

      // Sum tokens for all messages in this conversation
      for (const msg of convo.messages) {
        const tokens = estimateTokens(msg.text)
        weeklyTokens += tokens

        // Assign to the day bucket based on conversation observation time
        const dayStart = getDayStart(convoTime)
        const bucket = dailyBuckets.get(dayStart)
        if (bucket) {
          bucket.tokens += tokens
          bucket.messages += 1
        }
      }
    }

    // Build daily activity array
    const dailyActivity: DailyActivity[] = []
    let i = 0
    for (const [dayMs, data] of dailyBuckets) {
      dailyActivity.push({
        dayLabel: DAY_LABELS[i],
        messageCount: data.messages,
        tokenEstimate: data.tokens,
        date: new Date(dayMs)
      })
      i++
    }

    const maxDailyTokens = Math.max(...dailyActivity.map(d => d.tokenEstimate), 1)

    // Calculate streak (consecutive days with activity, ending today or yesterday)
    const todayMs = getDayStart(now.getTime())
    const todayIndex = Math.floor((todayMs - weekStartMs) / 86_400_000)
    const clampedTodayIndex = Math.min(Math.max(todayIndex, 0), 6)

    let streak = 0
    for (let j = clampedTodayIndex; j >= 0; j--) {
      if (dailyActivity[j].messageCount > 0) {
        streak++
      } else if (j < clampedTodayIndex) {
        // Gap found before today - stop counting
        break
      }
      // If today has no activity, continue checking yesterday
    }

    // Percentile heuristic (placeholder - not a true population percentile)
    // Roughly: higher token usage = lower percentile number (top X%)
    const percentile = Math.max(1, Math.min(99, Math.round(100 - (weeklyTokens / 2000))))
    const percentileLabel = `Top ${percentile}% of users`

    // Context capacity for current conversation
    // Estimated tokens / assumed 32K baseline, biased conservatively
    const currentTokens = currentMessages.reduce(
      (sum, msg) => sum + estimateTokens(msg.text),
      0
    )
    const contextBaseline = 32_000
    const contextUsedPercent = Math.min(100, Math.round((currentTokens / contextBaseline) * 100))
    const contextRemaining = 100 - contextUsedPercent

    return {
      weeklyTokens,
      weeklyTokensFormatted: formatTokenCount(weeklyTokens),
      streak,
      percentileLabel,
      contextRemaining,
      dailyActivity,
      maxDailyTokens,
      hasData: conversations.length > 0 || currentMessages.length > 0
    }
  }, [currentMessages])
}
