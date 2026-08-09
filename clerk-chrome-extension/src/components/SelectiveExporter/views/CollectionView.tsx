import { useMemo, useState } from "react"

import type { Conversation } from "~hooks/useMessageScanner/types"
import {
  getConversationSyncState,
  type ConversationSyncState
} from "~utils/conversationSyncState"

import { DARK_THEME } from "../constants"
import type { ConversationDateMode } from "../types"

/**
 * Availability of per-conversation sync state. `error` and `unsupported` are
 * deliberately distinct from "not synced": if the server is unavailable or
 * predates the status API, we do not know the state and must not claim that
 * every conversation is unsynced.
 */
export type CollectionSyncStatus = "loading" | "ready" | "unsupported" | "error"

export interface CollectionBulkSyncState {
  state: "idle" | "syncing" | "success" | "error"
  completed: number
  total: number
  failed: number
}

interface CollectionViewProps {
  conversations: Conversation[]
  /** Conversation ids known to be in the archive. */
  syncedIds: string[]
  /** Conversation id -> archive import time in unix seconds. */
  syncedAt: Record<string, number>
  status: CollectionSyncStatus
  activeConvoKey?: string
  onSelect: (convoKey: string) => void
  dateMode: ConversationDateMode
  onDateModeChange: (mode: ConversationDateMode) => void
  onRetry?: () => void
  bulkSync?: CollectionBulkSyncState
  onSyncUnsynced?: () => void
  onResyncAll?: () => void
  onRetryFailedSyncs?: () => void
}

type Filter = "all" | "unsynced"

const conversationDate = (
  conversation: Conversation,
  mode: ConversationDateMode
): number | undefined => {
  if (mode === "created") return conversation.createdAt

  const finalMessageTime = conversation.messages.reduce<number | undefined>(
    (latest, message) =>
      message.createdAt != null &&
      (latest == null || message.createdAt > latest)
        ? message.createdAt
        : latest,
    undefined
  )

  return finalMessageTime ?? conversation.updatedAt
}

const formatDate = (timestamp: number | undefined): string =>
  timestamp == null
    ? "Unknown"
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }).format(timestamp)

const conversationDateLabel = (
  conversation: Conversation,
  mode: ConversationDateMode
): string =>
  `${mode === "created" ? "Created" : "Last message"} ${formatDate(
    conversationDate(conversation, mode)
  )}`

type RowSyncState = ConversationSyncState | "unknown"

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
    stale: {
      text: "Needs sync",
      aria: "Needs sync",
      color: DARK_THEME.warning,
      background: "rgba(251, 191, 36, 0.12)"
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
          background:
            state === "synced"
              ? DARK_THEME.accent
              : state === "stale"
                ? DARK_THEME.warning
                : "transparent",
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
  syncedAt,
  status,
  activeConvoKey,
  onSelect,
  dateMode,
  onDateModeChange,
  onRetry,
  bulkSync = { state: "idle", completed: 0, total: 0, failed: 0 },
  onSyncUnsynced,
  onResyncAll,
  onRetryFailedSyncs
}: CollectionViewProps) => {
  const [filter, setFilter] = useState<Filter>("all")

  const syncedSet = useMemo(() => new Set(syncedIds), [syncedIds])

  const sorted = useMemo(
    () =>
      [...conversations].sort(
        (a, b) =>
          (conversationDate(b, dateMode) ?? 0) -
          (conversationDate(a, dateMode) ?? 0)
      ),
    [conversations, dateMode]
  )

  const stateFor = (conv: Conversation): RowSyncState => {
    if (status === "error" || status === "unsupported") return "unknown"
    return getConversationSyncState(
      conv,
      syncedSet.has(conv.id),
      syncedAt[conv.id]
    )
  }

  const visible = useMemo(
    () =>
      filter === "unsynced"
        ? sorted.filter((c) => stateFor(c) !== "synced")
        : sorted,
    [sorted, filter, syncedSet, syncedAt, status]
  )

  const syncedCount = sorted.filter((c) => stateFor(c) === "synced").length
  const staleCount = sorted.filter((c) => stateFor(c) === "stale").length
  const pendingCount = sorted.length - syncedCount
  const isResync = pendingCount === 0
  const canBulkSync = status === "ready" && sorted.length > 0
  const bulkLabel =
    bulkSync.state === "syncing"
      ? `Syncing ${bulkSync.completed} of ${bulkSync.total}`
      : isResync
        ? `Re-sync all ${sorted.length} conversation${sorted.length === 1 ? "" : "s"}`
        : staleCount === pendingCount
          ? `Sync ${staleCount} update${staleCount === 1 ? "" : "s"}`
          : staleCount > 0
            ? `Sync ${pendingCount} conversations`
            : `Sync ${pendingCount} unsynced conversation${pendingCount === 1 ? "" : "s"}`

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
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px"
        }}>
        <span style={{ color: DARK_THEME.muted, fontSize: "11px" }}>
          Date shown
        </span>
        <div
          role="group"
          aria-label="Date shown"
          style={{
            background: DARK_THEME.borderSubtle,
            borderRadius: "5px",
            display: "flex",
            gap: "2px",
            padding: "2px"
          }}>
          {(
            [
              ["last_message", "Last message"],
              ["created", "Created"]
            ] as const
          ).map(([mode, label]) => {
            const selected = dateMode === mode
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={selected}
                onClick={() => onDateModeChange(mode)}
                style={{
                  background: selected ? DARK_THEME.surface : "transparent",
                  border: "none",
                  borderRadius: "4px",
                  color: selected ? DARK_THEME.text : DARK_THEME.muted,
                  cursor: "pointer",
                  fontSize: "10px",
                  fontWeight: selected ? 600 : 400,
                  padding: "4px 7px"
                }}>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {(status === "error" || status === "unsupported") && (
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
          <span>
            {status === "unsupported"
              ? "Sync status endpoint unavailable"
              : "Sync server unreachable"}
          </span>
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

      {status === "ready" && (
        <div style={{ marginBottom: "10px" }}>
          <button
            type="button"
            onClick={isResync ? onResyncAll : onSyncUnsynced}
            disabled={!canBulkSync || bulkSync.state === "syncing"}
            aria-label={bulkLabel}
            style={{
              alignItems: "center",
              background:
                canBulkSync && bulkSync.state !== "syncing"
                  ? DARK_THEME.accent
                  : DARK_THEME.borderSubtle,
              border: "none",
              borderRadius: "6px",
              color:
                canBulkSync && bulkSync.state !== "syncing"
                  ? "#fff"
                  : DARK_THEME.muted,
              cursor:
                canBulkSync && bulkSync.state !== "syncing"
                  ? "pointer"
                  : "not-allowed",
              display: "flex",
              fontSize: "12px",
              fontWeight: 600,
              justifyContent: "center",
              minHeight: "32px",
              padding: "7px 10px",
              width: "100%"
            }}>
            {bulkLabel}
          </button>
          {bulkSync.state === "syncing" && (
            <div
              aria-live="polite"
              style={{
                color: DARK_THEME.muted,
                fontSize: "11px",
                marginTop: "5px"
              }}>
              Syncing {bulkSync.completed} of {bulkSync.total} conversations
            </div>
          )}
          {bulkSync.state === "error" && (
            <div
              aria-live="polite"
              style={{
                alignItems: "center",
                color: DARK_THEME.muted,
                display: "flex",
                fontSize: "11px",
                justifyContent: "space-between",
                marginTop: "5px"
              }}>
              <span>
                {bulkSync.completed} synced · {bulkSync.failed} failed
              </span>
              <button
                type="button"
                onClick={onRetryFailedSyncs}
                style={{
                  background: "transparent",
                  border: "none",
                  color: DARK_THEME.accent,
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: 0
                }}>
                Retry failed sync
              </button>
            </div>
          )}
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
                  background: isActive
                    ? DARK_THEME.borderSubtle
                    : "transparent",
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
                  if (!isActive)
                    e.currentTarget.style.background = "transparent"
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
                    <span>{conversationDateLabel(conv, dateMode)}</span>
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
