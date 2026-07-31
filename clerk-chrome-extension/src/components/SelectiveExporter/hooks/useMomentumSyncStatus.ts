import { useCallback, useEffect, useState } from "react"

import type { MomentumSyncResult } from "~utils/momentumSync"

import type { CollectionSyncStatus } from "../views/CollectionView"

interface UseMomentumSyncStatusConfig {
  url: string
  token: string
  /** Only query while the collection is actually on screen. */
  enabled: boolean
}

interface MomentumSyncStatusState {
  syncedIds: string[]
  status: CollectionSyncStatus
  refetch: () => void
}

/**
 * Ask the local momentum API which of these conversations are already archived.
 *
 * An unreachable or unconfigured server resolves to `error`, never to "empty" —
 * the CollectionView renders that as "unknown" rather than claiming everything
 * is unsynced, which would be a false statement the user might act on.
 */
export const useMomentumSyncStatus = (
  conversationIds: string[],
  { url, token, enabled }: UseMomentumSyncStatusConfig
): MomentumSyncStatusState => {
  const [syncedIds, setSyncedIds] = useState<string[]>([])
  const [status, setStatus] = useState<CollectionSyncStatus>("loading")
  const [nonce, setNonce] = useState(0)

  const refetch = useCallback(() => setNonce((n) => n + 1), [])

  // Stable dependency: the hook re-queries when the id set actually changes.
  const idKey = conversationIds.join(",")

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (url.trim() === "" || token.trim() === "") {
      setSyncedIds([])
      setStatus("error")
      return
    }

    const ids = idKey === "" ? [] : idKey.split(",")

    if (ids.length === 0) {
      setSyncedIds([])
      setStatus("ready")
      return
    }

    let cancelled = false
    setStatus("loading")

    void (async () => {
      try {
        const result = (await chrome.runtime.sendMessage({
          action: "momentumStatus",
          url,
          token,
          ids
        })) as MomentumSyncResult

        if (cancelled) return

        const data = result?.data as { synced?: unknown } | undefined
        if (result?.success === true && Array.isArray(data?.synced)) {
          setSyncedIds(data.synced.filter((id): id is string => typeof id === "string"))
          setStatus("ready")
          return
        }

        setSyncedIds([])
        setStatus("error")
      } catch {
        if (!cancelled) {
          setSyncedIds([])
          setStatus("error")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [idKey, url, token, enabled, nonce])

  return { syncedIds, status, refetch }
}
