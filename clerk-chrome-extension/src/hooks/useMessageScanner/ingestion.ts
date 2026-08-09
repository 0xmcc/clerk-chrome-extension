import type { Conversation } from "./types"
import { parseChatGPTList } from "./parsers/chatgpt"
import { parseClaudeList } from "./parsers/claude"
import {
  ENDPOINTS,
  buildChatGPTFetchHeaders,
  buildClaudeListUrls
} from "../../config/endpoints"
import { debug } from "~utils/debug"
import { now } from "./utils"

const LIST_PAGE_SIZE = 100
const LIST_DELAY_MS = 300

export interface IngestionPipeline {
  trigger: () => void  // idempotent; no-op after first call
  cancel: () => void   // stops loop at next await
}

interface IngestionDeps {
  upsertMany: (conversations: Conversation[]) => void
  getAuthToken: () => string | null
}

interface ClaudeIngestionDeps {
  upsertMany: (conversations: Conversation[]) => void
  getOrgId: () => string | null
}

const getClaudeListTotal = (json: unknown): number | null => {
  if (!json || typeof json !== "object") return null

  const data = json as Record<string, unknown>
  const total = data.total ?? data.total_count
  return typeof total === "number" && Number.isFinite(total) ? total : null
}

function logIngestion(step: string, details?: Record<string, unknown>) {
  debug.any(["messages", "ingestion"], step, details ?? "")
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export function createIngestionPipeline(deps: IngestionDeps): IngestionPipeline {
  let hasTriggered = false
  let abortController: AbortController | null = null

  async function run(authToken: string) {
    abortController = new AbortController()
    const { signal } = abortController

    logIngestion("INGESTION_PHASE1_START")
    let offset = 0
    let total = Infinity  // updated from first response

    while (!signal.aborted) {
      const url = new URL(ENDPOINTS.chatgpt.list, window.location.origin)
      url.searchParams.set("offset", String(offset))
      url.searchParams.set("limit", String(LIST_PAGE_SIZE))
      url.searchParams.set("order", "updated")
      url.searchParams.set("is_archived", "false")
      url.searchParams.set("is_starred", "false")

      let resp: Response | null = null
      try {
        resp = await fetch(url.href, {
          method: "GET",
          credentials: "include",
          headers: buildChatGPTFetchHeaders(authToken),
          signal,
        })
      } catch {
        logIngestion("INGESTION_FETCH_ERROR", { offset })
        break
      }

      if (!resp.ok) {
        logIngestion("INGESTION_FETCH_NOT_OK", { offset, status: resp.status })
        break
      }

      let json: unknown
      try {
        json = await resp.json()
      } catch {
        logIngestion("INGESTION_JSON_ERROR", { offset })
        break
      }

      const rawTotal = (json as Record<string, unknown>)?.total
      if (typeof rawTotal === "number") total = rawTotal

      const parsed = parseChatGPTList(json)
      logIngestion("INGESTION_PHASE1_PAGE", { offset, pageCount: parsed.length, total })

      if (parsed.length > 0) {
        const seenAt = now()
        const convos: Conversation[] = parsed.map(m => ({
          id: m.id,
          platform: "chatgpt",
          title: m.title,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          messages: [],
          hasFullHistory: false,
          lastSeenAt: seenAt,
        }))
        deps.upsertMany(convos)
        offset += parsed.length
      }

      if (parsed.length === 0 || offset >= total) break

      await sleep(LIST_DELAY_MS)
    }

    logIngestion(signal.aborted ? "INGESTION_CANCELLED" : "INGESTION_PHASE1_COMPLETE", { offset, total })
  }

  return {
    trigger() {
      if (hasTriggered) {
        logIngestion("INGESTION_ALREADY_TRIGGERED")
        return
      }

      const authToken = deps.getAuthToken()
      if (!authToken) {
        // Startup can reach this point before ChatGPT sends its first
        // authenticated request. Do not permanently consume the trigger;
        // authenticated traffic will retry it a moment later.
        logIngestion("INGESTION_NO_AUTH_TOKEN")
        return
      }

      hasTriggered = true
      logIngestion("INGESTION_TRIGGERED")
      void run(authToken)
    },
    cancel() {
      abortController?.abort()
    },
  }
}

/**
 * Loads Claude's conversation collection after its organization id is learned
 * from normal Claude traffic. This mirrors ChatGPT's proactive index ingestion
 * instead of relying on the sidebar to have requested the list already.
 */
export function createClaudeIngestionPipeline(
  deps: ClaudeIngestionDeps
): IngestionPipeline {
  let hasTriggered = false
  let isRunning = false
  let abortController: AbortController | null = null

  async function run(orgId: string) {
    isRunning = true
    abortController = new AbortController()
    const { signal } = abortController

    try {
      for (const baseUrl of buildClaudeListUrls(orgId)) {
        let offset = 0
        let total: number | null = null
        const seenIds = new Set<string>()

        while (!signal.aborted) {
          const url = new URL(baseUrl, window.location.origin)
          url.searchParams.set("limit", String(LIST_PAGE_SIZE))
          url.searchParams.set("offset", String(offset))

          let resp: Response
          try {
            resp = await fetch(url.pathname + url.search, {
              credentials: "include",
              headers: { accept: "application/json" },
              signal
            })
          } catch {
            if (signal.aborted) return
            logIngestion("CLAUDE_INGESTION_FETCH_ERROR", { url: url.href })
            break
          }

          if (!resp.ok) {
            logIngestion("CLAUDE_INGESTION_FETCH_NOT_OK", {
              url: url.href,
              status: resp.status
            })
            break
          }

          let json: unknown
          try {
            json = await resp.json()
          } catch {
            logIngestion("CLAUDE_INGESTION_JSON_ERROR", { url: url.href })
            break
          }

          total ??= getClaudeListTotal(json)
          const parsed = parseClaudeList(orgId, json)
          const fresh = parsed.filter(conversation => !seenIds.has(conversation.id))
          fresh.forEach(conversation => seenIds.add(conversation.id))

          if (fresh.length > 0) {
            const seenAt = now()
            deps.upsertMany(
              fresh.map(conversation => ({
                id: conversation.id,
                platform: "claude" as const,
                title: conversation.title,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
                orgId: conversation.orgId,
                messages: [],
                hasFullHistory: false,
                lastSeenAt: seenAt
              }))
            )
          }

          logIngestion("CLAUDE_INGESTION_PAGE", {
            orgId,
            offset,
            count: fresh.length,
            total,
            url: url.href
          })

          const reachedTotal =
            total !== null && offset + parsed.length >= total
          const reachedShortPageWithoutTotal =
            total === null && parsed.length < LIST_PAGE_SIZE
          if (fresh.length === 0 || reachedTotal || reachedShortPageWithoutTotal) {
            logIngestion("CLAUDE_INGESTION_COMPLETE", {
              orgId,
              count: seenIds.size,
              total
            })
            return
          }

          offset += parsed.length
          await sleep(LIST_DELAY_MS)
        }
      }
    } finally {
      isRunning = false
    }
  }

  return {
    trigger() {
      if (hasTriggered || isRunning) {
        logIngestion("CLAUDE_INGESTION_ALREADY_TRIGGERED")
        return
      }

      const orgId = deps.getOrgId()
      if (!orgId) {
        // Keep this retryable: the first intercepted request may arrive before
        // Claude exposes the organization id to the page.
        logIngestion("CLAUDE_INGESTION_NO_ORG")
        return
      }

      hasTriggered = true
      logIngestion("CLAUDE_INGESTION_TRIGGERED", { orgId })
      void run(orgId)
    },
    cancel() {
      abortController?.abort()
    }
  }
}
