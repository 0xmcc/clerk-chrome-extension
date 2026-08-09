/**
 * Background-worker helper that pushes a captured conversation to the local
 * momentum sync API (`momentum serve`). Runs in the service worker so the
 * request carries the extension origin (the server rejects web origins).
 *
 * Loopback-only by design: this must never POST a captured conversation to a
 * remote host, even if settings are misconfigured or tampered with.
 */

export interface MomentumSyncMessage {
  action: "momentumSync"
  url?: unknown
  token?: unknown
  payload?: unknown
}

export interface MomentumSyncResult {
  success: boolean
  status?: number
  error?: string
  data?: unknown
}

interface HandleMomentumSyncOptions {
  fetchImpl?: typeof fetch
}

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]", "::1"])

const parseLoopbackBase = (rawUrl: unknown): URL | null => {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== "http:") {
    return null
  }
  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
    return null
  }
  return parsed
}

const buildCapturesUrl = (base: URL): string => {
  const origin = base.origin
  return `${origin}/captures`
}

const buildStatusUrl = (base: URL): string => `${base.origin}/conversations/status`

const buildStatsUrl = (base: URL): string => `${base.origin}/stats`

export interface MomentumStatusMessage {
  action: "momentumStatus"
  url?: unknown
  token?: unknown
  ids?: unknown
}

/**
 * Ask the local momentum API which conversation ids are already archived.
 * Same loopback + token guards as the sync path: conversation ids are personal
 * data and must never be sent to a remote host.
 */
export const handleMomentumStatusMessage = async (
  message: MomentumStatusMessage,
  { fetchImpl = fetch }: HandleMomentumSyncOptions = {}
): Promise<MomentumSyncResult> => {
  const base = parseLoopbackBase(message.url)
  if (!base) {
    return {
      success: false,
      status: 400,
      error:
        "Momentum sync URL must be a loopback http address (e.g. http://127.0.0.1:4319)"
    }
  }

  if (typeof message.token !== "string" || message.token.trim() === "") {
    return { success: false, status: 400, error: "Missing momentum sync token" }
  }

  if (
    !Array.isArray(message.ids) ||
    message.ids.some((id) => typeof id !== "string")
  ) {
    return { success: false, status: 400, error: "Expected ids to be a string array" }
  }

  try {
    const response = await fetchImpl(buildStatusUrl(base), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${message.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ids: message.ids })
    })

    const text = await response.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    // Earlier `momentum serve` releases support authenticated `/stats` but not
    // the per-conversation status endpoint. Verify that server is reachable
    // and authenticated so the UI can distinguish an upgrade requirement from
    // an offline server without claiming any conversations are unsynced.
    if (response.status === 404) {
      const statsResponse = await fetchImpl(buildStatsUrl(base), {
        headers: { Authorization: `Bearer ${message.token}` }
      })

      if (statsResponse.ok) {
        return {
          success: true,
          status: statsResponse.status,
          data: { synced: [], syncedAt: {}, statusUnsupported: true }
        }
      }
    }

    return { success: response.ok, status: response.status, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Momentum status failed"
    }
  }
}

export const handleMomentumSyncMessage = async (
  message: MomentumSyncMessage,
  { fetchImpl = fetch }: HandleMomentumSyncOptions = {}
): Promise<MomentumSyncResult> => {
  const base = parseLoopbackBase(message.url)
  if (!base) {
    return {
      success: false,
      status: 400,
      error:
        "Momentum sync URL must be a loopback http address (e.g. http://127.0.0.1:4319)"
    }
  }

  if (typeof message.token !== "string" || message.token.trim() === "") {
    return { success: false, status: 400, error: "Missing momentum sync token" }
  }

  if (message.payload === undefined || message.payload === null) {
    return { success: false, status: 400, error: "Missing conversation payload" }
  }

  try {
    const response = await fetchImpl(buildCapturesUrl(base), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${message.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message.payload)
    })

    const text = await response.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return { success: response.ok, status: response.status, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Momentum sync failed"
    }
  }
}
