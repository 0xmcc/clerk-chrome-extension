import { useMemo, useState } from "react"

import type { Conversation } from "~hooks/useMessageScanner/types"

import { DARK_THEME } from "../constants"

/**
 * Reachability of the local momentum sync API. `error` is deliberately distinct
 * from "not synced": if we cannot reach the server we do not know the state, and
 * claiming everything is unsynced would be a lie the user might act on.
 */
export type CollectionSyncStatus = "loading" | "ready" | "error"

interface CollectionViewProps {
  conversations: Conversation[]
  /** Conversation ids known to be in the archive. */
  syncedIds: string[]
  status: CollectionSyncStatus
  activeConvoKey?: string
  onSelect: (convoKey: string) => void
  onRetry?: () => void
}

type Filter = "all" | "unsynced"

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

const StatusDot = ({
  state
}: {
  state: "synced" | "unsynced" | "unknown"
}) => {
  const config = {
    synced: { label: "Synced", color: DARK_THEME.accent, filled: true },
    unsynced: { label: "Not synced", color: DARK_THEME.muted, filled: false },
    unknown: { label: "Sync status unknown", color: DARK_THEME.muted, filled: false }
  }[state]

  return (
    <span
      aria-label={config.label}
      title={config.label}
      role="img"
      style={{
        flexShrink: 0,
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        marginTop: "5px",
        background: config.filled ? config.color : "transparent",
        border: config.filled ? "none" : `1.5px solid ${config.color}`,
        opacity: state === "unknown" ? 0.4 : 1
      }}
    />
  )
}

export const CollectionView = ({
  conversations,
  syncedIds,
  status,
  activeConvoKey,
  onSelect,
  onRetry
}: CollectionViewProps) => {
  const [filter, setFilter] = useState<Filter>("all")

  const syncedSet = useMemo(() => new Set(syncedIds), [syncedIds])

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    [conversations]
  )

  const stateFor = (conv: Conversation): "synced" | "unsynced" | "unknown" => {
    if (status === "error") return "unknown"
    return syncedSet.has(conv.id) ? "synced" : "unsynced"
  }

  const visible = useMemo(
    () =>
      filter === "unsynced"
        ? sorted.filter((c) => stateFor(c) !== "synced")
        : sorted,
    [sorted, filter, syncedSet, status]
  )

  const syncedCount = sorted.filter((c) => syncedSet.has(c.id)).length

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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {status === "error" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            padding: "7px 10px",
            marginBottom: "6px",
            borderRadius: "6px",
            background: DARK_THEME.borderSubtle,
            fontSize: "11px",
            color: DARK_THEME.muted
          }}>
          <span>Sync server unreachable</span>
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: "transparent",
              border: `1px solid ${DARK_THEME.muted}`,
              borderRadius: "4px",
              color: DARK_THEME.text,
              cursor: "pointer",
              fontSize: "11px",
              padding: "2px 8px"
            }}>
            Retry
          </button>
        </div>
      )}

      <div
        role="group"
        aria-label="Filter conversations"
        style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
        {(["all", "unsynced"] as Filter[]).map((value) => {
          const isActive = filter === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={isActive}
              style={{
                background: isActive ? DARK_THEME.borderSubtle : "transparent",
                border: "none",
                borderRadius: "5px",
                color: isActive ? DARK_THEME.text : DARK_THEME.muted,
                cursor: "pointer",
                fontSize: "11px",
                padding: "4px 9px",
                transition: "background 0.12s ease"
              }}>
              {value === "all" ? "All" : "Not synced"}
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          overflowY: "auto",
          flex: 1
        }}>
        {visible.length === 0 ? (
          <div
            style={{
              color: DARK_THEME.muted,
              fontSize: "12px",
              textAlign: "center",
              padding: "24px 0"
            }}>
            Everything here is synced
          </div>
        ) : (
          visible.map((conv) => {
            const convoKey = `${conv.platform}:${conv.id}`
            const isActive = convoKey === activeConvoKey
            const title = conv.title || "Untitled conversation"
            const state = stateFor(conv)

            return (
              <div
                key={convoKey}
                role="button"
                tabIndex={0}
                aria-current={isActive ? "true" : undefined}
                title={title}
                onClick={() => onSelect(convoKey)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSelect(convoKey)
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: isActive ? DARK_THEME.borderSubtle : "transparent",
                  borderLeft: isActive
                    ? `2px solid ${DARK_THEME.accent}`
                    : "2px solid transparent",
                  transition: "background 0.12s ease"
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = DARK_THEME.borderSubtle
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent"
                }}>
                <StatusDot state={state} />
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                    minWidth: 0,
                    flex: 1
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
                  <span
                    style={{
                      fontSize: "11px",
                      color: DARK_THEME.muted,
                      display: "flex",
                      gap: "6px"
                    }}>
                    <span>
                      {conv.platform === "claude" ? "Claude" : "ChatGPT"}
                    </span>
                    <span>·</span>
                    <span>{relativeTime(conv.lastSeenAt)}</span>
                  </span>
                </span>
              </div>
            )
          })
        )}
      </div>

      <div
        role="contentinfo"
        style={{
          borderTop: `1px solid ${DARK_THEME.borderSubtle}`,
          color: DARK_THEME.muted,
          fontSize: "10px",
          marginTop: "6px",
          padding: "6px 10px 2px",
          textAlign: "right"
        }}>
        {status === "error"
          ? `${sorted.length} conversations`
          : `${syncedCount} of ${sorted.length} synced`}
      </div>
    </div>
  )
}
