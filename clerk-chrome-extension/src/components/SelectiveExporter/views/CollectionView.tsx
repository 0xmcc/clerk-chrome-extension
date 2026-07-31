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

type RowSyncState = "synced" | "unsynced" | "unknown"

/**
 * Sync state as a readable badge. A bare dot is too easy to miss in a dense
 * list, and answering "is this one archived?" at a glance is the entire job of
 * this view — so the state is spelled out, with colour as a secondary cue.
 */
const StatusBadge = ({ state }: { state: RowSyncState }) => {
  const config: Record<
    RowSyncState,
    { text: string; aria: string; color: string; background: string }
  > = {
    synced: {
      text: "Synced",
      aria: "Synced",
      color: DARK_THEME.accent,
      background: "rgba(139, 122, 255, 0.14)"
    },
    unsynced: {
      text: "Not synced",
      aria: "Not synced",
      color: DARK_THEME.muted,
      background: "transparent"
    },
    unknown: {
      text: "Unknown",
      aria: "Sync status unknown",
      color: DARK_THEME.muted,
      background: "transparent"
    }
  }
  const { text, aria, color, background } = config[state]

  return (
    <span
      aria-label={aria}
      title={aria}
      style={{
        alignItems: "center",
        background,
        border:
          state === "synced" ? "none" : `1px solid ${DARK_THEME.borderSubtle}`,
        borderRadius: "10px",
        color,
        display: "inline-flex",
        flexShrink: 0,
        fontSize: "10px",
        gap: "4px",
        lineHeight: 1,
        opacity: state === "unknown" ? 0.75 : 1,
        padding: "3px 7px",
        whiteSpace: "nowrap"
      }}>
      <span
        aria-hidden="true"
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          flexShrink: 0,
          background: state === "synced" ? DARK_THEME.accent : "transparent",
          border: state === "synced" ? "none" : `1px solid ${color}`
        }}
      />
      {text}
    </span>
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
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flex: 1,
            flexDirection: "column",
            gap: "6px",
            justifyContent: "center",
            padding: "40px 24px",
            textAlign: "center"
          }}>
          <span style={{ color: DARK_THEME.text, fontSize: "13px" }}>
            No conversations captured yet
          </span>
          <span
            style={{
              color: DARK_THEME.muted,
              fontSize: "11px",
              lineHeight: 1.5,
              maxWidth: "260px"
            }}>
            Open a conversation and it shows up here, with whether it has been
            saved to your local archive.
          </span>
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
          0 conversations
        </div>
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
                  alignItems: "center",
                  gap: "10px",
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
                <StatusBadge state={state} />
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
