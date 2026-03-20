import { useMemo } from "react"
import type { Conversation } from "~hooks/useMessageScanner/types"
import { DARK_THEME } from "../constants"

interface ConversationIndexViewProps {
  conversations: Conversation[]
  activeConvoKey?: string
  onSelect: (convoKey: string) => void
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export const MessageIndexView = ({ conversations, activeConvoKey, onSelect }: ConversationIndexViewProps) => {
  if (conversations.length === 0) {
    return (
      <div
        style={{
          color: DARK_THEME.muted,
          fontSize: "13px",
          textAlign: "center",
          padding: "32px 0"
        }}>
        No conversations captured yet
      </div>
    )
  }

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    [conversations]
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {sorted.map((conv) => {
        const convoKey = `${conv.platform}:${conv.id}`
        const isActive = convoKey === activeConvoKey
        const title = conv.title || "Untitled conversation"
        const msgCount = conv.messages.length
        const time = relativeTime(conv.lastSeenAt)

        return (
          <div
            key={convoKey}
            role="button"
            tabIndex={0}
            title={title}
            onClick={() => onSelect(convoKey)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(convoKey) }}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              padding: "8px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              background: isActive ? DARK_THEME.borderSubtle : "transparent",
              borderLeft: isActive ? `2px solid ${DARK_THEME.accent}` : "2px solid transparent",
              transition: "background 0.12s ease"
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = DARK_THEME.borderSubtle
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent"
            }}>
            <span
              style={{
                fontSize: "13px",
                color: DARK_THEME.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}>
              {title}
            </span>
            <span style={{ fontSize: "11px", color: DARK_THEME.muted, display: "flex", gap: "6px" }}>
              <span>{conv.platform === "claude" ? "Claude" : "ChatGPT"}</span>
              <span>·</span>
              <span>{msgCount} {msgCount === 1 ? "message" : "messages"}</span>
              <span>·</span>
              <span>{time}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
