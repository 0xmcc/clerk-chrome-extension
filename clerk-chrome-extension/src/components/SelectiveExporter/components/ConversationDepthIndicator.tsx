import { useMemo } from "react"
import { DARK_THEME } from "../constants"

interface ConversationDepthIndicatorProps {
  messages: Array<{ text: string; role: string }>
}

/**
 * Estimates conversation depth as a percentage of typical context capacity.
 * Uses a simple heuristic based on character count, not exact token counting.
 * The goal is situational awareness, not precision.
 */
const estimateDepth = (messages: Array<{ text: string }>) => {
  if (!messages.length) return 0

  // Rough token estimation: ~4 chars per token on average
  const totalChars = messages.reduce((sum, msg) => sum + (msg.text?.length || 0), 0)
  const estimatedTokens = Math.ceil(totalChars / 4)

  // Typical context windows range from 8K to 200K tokens
  // We use a moderate baseline that feels "full" around 32K tokens
  // This creates a useful gradient for most conversations
  const contextBaseline = 32000

  // Apply a gentle curve so early messages register visibly
  // and very long conversations don't just sit at 100%
  const rawPercentage = (estimatedTokens / contextBaseline) * 100
  const curvedPercentage = Math.min(100, Math.sqrt(rawPercentage) * 10)

  return Math.round(curvedPercentage)
}

/**
 * Returns a color based on depth percentage using the theme palette.
 * Transitions from calm to warm as depth increases.
 */
const getDepthColor = (depth: number) => {
  if (depth < 40) return DARK_THEME.success      // Green - plenty of room
  if (depth < 70) return DARK_THEME.warning      // Amber - getting deep
  return DARK_THEME.danger                        // Red - quite full
}

/**
 * Returns a human-readable label for the depth state.
 */
const getDepthLabel = (depth: number) => {
  if (depth < 20) return "Fresh"
  if (depth < 40) return "Light"
  if (depth < 60) return "Moderate"
  if (depth < 80) return "Deep"
  return "Very deep"
}

/**
 * A visual indicator that conveys conversation depth relative to model memory.
 * Designed for instant comprehension without exposing technical details.
 */
export const ConversationDepthIndicator = ({ messages }: ConversationDepthIndicatorProps) => {
  const depth = useMemo(() => estimateDepth(messages), [messages])
  const color = getDepthColor(depth)
  const label = getDepthLabel(depth)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          fontSize: "12px",
          color: DARK_THEME.textSecondary,
          fontWeight: 500
        }}>
          Conversation depth
        </span>
        <span style={{
          fontSize: "12px",
          color: DARK_THEME.muted
        }}>
          {label}
        </span>
      </div>

      {/* Gauge container */}
      <div
        style={{
          height: "6px",
          backgroundColor: DARK_THEME.surface,
          borderRadius: "3px",
          overflow: "hidden",
          border: `1px solid ${DARK_THEME.borderSubtle}`
        }}
      >
        {/* Fill bar */}
        <div
          style={{
            height: "100%",
            width: `${depth}%`,
            backgroundColor: color,
            borderRadius: "2px",
            transition: "width 0.3s ease, background-color 0.3s ease"
          }}
        />
      </div>

      {/* Subtle hint text */}
      <p style={{
        fontSize: "11px",
        color: DARK_THEME.muted,
        margin: 0,
        lineHeight: 1.4
      }}>
        {depth < 40
          ? "Plenty of room for this conversation to grow."
          : depth < 70
          ? "This conversation has built up meaningful context."
          : "Consider summarizing key points or starting fresh for new topics."
        }
      </p>
    </div>
  )
}
