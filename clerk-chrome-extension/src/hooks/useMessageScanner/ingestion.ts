import type { Conversation } from "./types"
import { parseChatGPTList } from "./parsers/chatgpt"
import { ENDPOINTS, buildChatGPTFetchHeaders } from "../../config/endpoints"
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

function logIngestion(step: string, details?: Record<string, unknown>) {
  debug.any(["messages", "ingestion"], step, details ?? "")
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export function createIngestionPipeline(deps: IngestionDeps): IngestionPipeline {
  let hasTriggered = false
  let abortController: AbortController | null = null

  async function run() {
    const authToken = deps.getAuthToken()
    if (!authToken) {
      logIngestion("INGESTION_NO_AUTH_TOKEN")
      return
    }

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
      hasTriggered = true
      logIngestion("INGESTION_TRIGGERED")
      run()
    },
    cancel() {
      abortController?.abort()
    },
  }
}
