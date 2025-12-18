// import { useEffect, useState, useCallback, useRef } from "react"

// import { detectRole, generateMessageId, getLinkedInAuthor, getMessageText } from "~scrapers/domUtils"
// import { detectPlatform, getPlatformLabel, type Platform } from "~utils/platform"

// export interface Message {
//   id: string
//   role: "user" | "assistant"
//   text: string
//   authorName: string
//   node: Element
// }

// // Message selectors per platform (ordered by specificity)
// const PLATFORM_SELECTORS: Record<Platform, string[]> = {
//   chatgpt: [
//     ".group.w-full.text-token-text-primary",
//     "[data-message-id]",
//     '[data-testid="conversation-turn"]',
//     "[data-message-author-role]"
//   ],
//   claude: [

//     ".font-claude-response",
//     "[data-is-streaming]",
//     '[data-testid="message-row"]',
//     '[data-testid="message"]',
//     '[data-testid*="chat-message"]',
//     '[data-testid*="assistant-message"]',
//     '[data-testid*="user-message"]'
//   ],
//   linkedin: [
//     "[data-event-urn]",
//     "li.msg-s-event-listitem",
//     ".msg-s-event-listitem__message-bubble",
//     "[data-event-id]",
//     "[data-urn]",
//     "[data-id]"
//   ],
//   unknown: [
//     "[data-message-id]",
//     '[data-testid="conversation-turn"]',
//     "[data-message-author-role]"
//   ]
// }


// interface UseMessageScannerProps {
//   isExporterOpen: boolean
// }

// export const useMessageScanner = ({ isExporterOpen }: UseMessageScannerProps) => {
//   const [messages, setMessages] = useState<Message[]>([])
//   const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
//   const platformRef = useRef<Platform>(detectPlatform())
//   const conversationKeyRef = useRef<string>(`${window.location.hostname}${window.location.pathname}${window.location.search}`)

//   const getConversationKey = useCallback(() => {
//     return `${window.location.hostname}${window.location.pathname}${window.location.search}`
//   }, [])

//   const scanMessages = useCallback(() => {
//     const foundMessages: Message[] = []
//     const processedIds = new Set<string>()
//     const processedNodes = new Set<Element>()
//     const selectors = PLATFORM_SELECTORS[platformRef.current] || PLATFORM_SELECTORS.unknown
//     const platformLabel = getPlatformLabel(platformRef.current)

//     if (selectors.length === 0) {
//       setMessages([])
//       return
//     }

//     const shouldMergeSelectors = platformRef.current === "claude"

//     for (const selector of selectors) {
//       const nodes = document.querySelectorAll(selector)
//       if (nodes.length === 0) continue

//       nodes.forEach((node, index) => {
//         if (processedNodes.has(node)) return
//         processedNodes.add(node)

//         const id = generateMessageId(node, index)

//         if (processedIds.has(id)) return
//         processedIds.add(id)

//         const role = detectRole(node, platformRef.current)
//         const text = getMessageText(node, platformRef.current)

//         // Derive a clearer author label per platform so exports distinguish you vs the AI
//         let authorName: string
//         if (platformRef.current === "linkedin") {
//           authorName = getLinkedInAuthor(node, role)
//         } else {
//           authorName = role === "user" ? "You" : platformLabel
//         }

//         if (text) {
//           foundMessages.push({ id, role, text, authorName, node })
//         }
//       })

//       if (!shouldMergeSelectors && foundMessages.length > 0) {
//         break
//       }
//     }

//     setMessages(foundMessages)
//   }, [])

//   useEffect(() => {
//     if (!isExporterOpen) {
//       if (scanTimeoutRef.current) {
//         clearTimeout(scanTimeoutRef.current)
//         scanTimeoutRef.current = null
//       }
//       return
//     }

//     // Rescan when drawer opens
//     scanMessages()
//   }, [isExporterOpen, scanMessages])

//   const scheduleScan = useCallback(() => {
//     if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
//     scanTimeoutRef.current = setTimeout(() => {
//       scanMessages()
//       scanTimeoutRef.current = null
//     }, 120)
//   }, [scanMessages])

//   useEffect(() => {
//     if (!isExporterOpen) return

//     scanMessages()

//     const observer = new MutationObserver(() => {
//       scheduleScan()
//     })

//     observer.observe(document.body, {
//       childList: true,
//       subtree: true
//     })

//     return () => {
//       observer.disconnect()
//       if (scanTimeoutRef.current) {
//         clearTimeout(scanTimeoutRef.current)
//         scanTimeoutRef.current = null
//       }
//     }
//   }, [isExporterOpen, scanMessages, scheduleScan])

//   // Detect conversation changes via URL changes
//   useEffect(() => {
//     if (!isExporterOpen) return

//     const interval = setInterval(() => {
//       const key = getConversationKey()
//       if (key !== conversationKeyRef.current) {
//         conversationKeyRef.current = key
//         setMessages([])
//         scanMessages()
//       }
//     }, 500)

//     return () => clearInterval(interval)
//   }, [getConversationKey, isExporterOpen, scanMessages])

//   return { messages, rescan: scanMessages, conversationKey: conversationKeyRef.current }
// }
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { detectPlatform, getPlatformLabel, type Platform } from "~utils/platform"

export interface Message {
  id: string
  role: "user" | "assistant"
  text: string
  authorName: string
  // Kept for backward-compatibility with existing consumers/types.
  // In network mode this is a detached node (NOT scraped from DOM).
  node: Element
}

export type CapturedPlatform = "chatgpt" | "claude"

export interface Conversation {
  id: string
  platform: CapturedPlatform
  title?: string
  createdAt?: number
  updatedAt?: number

  // Full message history when available (detail endpoint)
  messages: Message[]
  hasFullHistory: boolean

  // Claude only (handy for rescan fetches)
  orgId?: string

  lastSeenAt: number
}

export interface ScannerStats {
  totalConversations: number
  conversationsWithMessages: number
  totalMessages: number
  lastCapturedAt?: number
}

interface UseMessageScannerProps {
  isExporterOpen: boolean
}

const INTERCEPTOR_SOURCE = "__echo_network_interceptor__"

type InterceptorEvent = {
  source: string
  url: string
  method?: string
  status?: number
  ok?: boolean
  ts?: number
  data?: any
}

const now = () => Date.now()

const toMillis = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    // ChatGPT often uses seconds (float), sometimes ms
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value)
  }
  if (typeof value === "string") {
    const n = Number(value)
    if (Number.isFinite(n)) return toMillis(n)
    const d = Date.parse(value)
    if (!Number.isNaN(d)) return d
  }
  return undefined
}

const createDetachedNode = (id: string): Element => {
  const el = document.createElement("div")
  el.setAttribute("data-echo-message-id", id)
  return el
}

const normalizeText = (text: string): string => {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

const isCapturedPlatform = (p: Platform): p is CapturedPlatform => p === "chatgpt" || p === "claude"

const inferCapturedPlatformFromUrl = (u: URL): CapturedPlatform | null => {
  const host = u.hostname.toLowerCase()
  if (host.includes("claude.ai")) return "claude"
  if (host.includes("chatgpt") || host.includes("openai")) return "chatgpt"

  // Fallback by path matching (in case host matching changes)
  if (u.pathname.startsWith("/backend-api/")) return "chatgpt"
  if (u.pathname.startsWith("/api/organizations/")) return "claude"
  return null
}

const matchChatGPTList = (u: URL) => u.pathname === "/backend-api/conversations"
const matchChatGPTDetail = (u: URL) => u.pathname.startsWith("/backend-api/conversation/")

const matchClaudeList = (u: URL) =>
  /^\/api\/organizations\/[^/]+\/chat_conversations$/.test(u.pathname) ||
  /^\/api\/organizations\/[^/]+\/conversations$/.test(u.pathname)

const matchClaudeDetail = (u: URL) =>
  /^\/api\/organizations\/[^/]+\/chat_conversations\/[^/?]+$/.test(u.pathname) ||
  /^\/api\/organizations\/[^/]+\/conversations\/[^/?]+$/.test(u.pathname)

const extractPathSegment = (pathname: string, indexFromEnd: number): string | null => {
  const parts = pathname.split("/").filter(Boolean)
  const idx = parts.length - 1 - indexFromEnd
  if (idx < 0 || idx >= parts.length) return null
  return parts[idx] || null
}

const getConversationKey = () => `${window.location.hostname}${window.location.pathname}${window.location.search}`

const getActiveConversationIdFromUrl = (platform: CapturedPlatform): string | null => {
  const path = window.location.pathname

  // Claude uses /chat/{uuid}
  if (platform === "claude") {
    const m = path.match(/\/chat\/([^/?#]+)/)
    return m?.[1] || null
  }

  // ChatGPT commonly uses /c/{id}
  if (platform === "chatgpt") {
    const m = path.match(/\/c\/([^/?#]+)/)
    return m?.[1] || null
  }

  return null
}

/** ---------------- ChatGPT parsers ---------------- */

const parseChatGPTList = (json: any): Array<Pick<Conversation, "id" | "title" | "createdAt" | "updatedAt">> => {
  const items = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : []
  return items
    .map((item: any) => {
      const id = item?.id
      if (!id || typeof id !== "string") return null
      return {
        id,
        title: typeof item?.title === "string" ? item.title : undefined,
        createdAt: toMillis(item?.create_time),
        updatedAt: toMillis(item?.update_time)
      }
    })
    .filter(Boolean) as Array<Pick<Conversation, "id" | "title" | "createdAt" | "updatedAt">>
}

const extractChatGPTText = (message: any): string => {
  const content = message?.content
  if (!content) return ""

  // Common shape: { content_type: "text", parts: ["..."] }
  const parts = content?.parts
  if (Array.isArray(parts)) {
    const joined = parts
      .map((p) => (typeof p === "string" ? p : typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n")
    return normalizeText(joined)
  }

  // Sometimes: { text: "..." }
  if (typeof content?.text === "string") return normalizeText(content.text)

  // Fallback: stringify cautiously
  if (typeof content === "string") return normalizeText(content)

  return ""
}

const roleFromChatGPTAuthor = (authorRole: any): "user" | "assistant" => {
  const r = typeof authorRole === "string" ? authorRole.toLowerCase() : ""
  if (r === "user") return "user"
  // Treat system/tool as assistant for export compatibility
  return "assistant"
}

const parseChatGPTDetail = (conversationId: string, json: any): Pick<
  Conversation,
  "id" | "title" | "createdAt" | "updatedAt" | "messages" | "hasFullHistory"
> => {
  const mapping = json?.mapping && typeof json.mapping === "object" ? json.mapping : {}
  const currentNode = typeof json?.current_node === "string" ? json.current_node : null

  const chain: any[] = []
  const visited = new Set<string>()

  let nodeId: string | null = currentNode
  while (nodeId && mapping[nodeId] && !visited.has(nodeId)) {
    visited.add(nodeId)
    const node = mapping[nodeId]
    chain.push(node)
    nodeId = typeof node?.parent === "string" ? node.parent : null
  }

  chain.reverse()

  const platformLabel = getPlatformLabel("chatgpt")

  const messages: Message[] = []
  for (let i = 0; i < chain.length; i++) {
    const node = chain[i]
    const msg = node?.message
    if (!msg) continue

    const text = extractChatGPTText(msg)
    if (!text) continue

    const role = roleFromChatGPTAuthor(msg?.author?.role)
    const id = typeof msg?.id === "string" ? msg.id : typeof node?.id === "string" ? node.id : `chatgpt-${conversationId}-${i}`
    const authorName = role === "user" ? "You" : platformLabel

    messages.push({
      id,
      role,
      text,
      authorName,
      node: createDetachedNode(id)
    })
  }

  return {
    id: conversationId,
    title: typeof json?.title === "string" ? json.title : undefined,
    createdAt: toMillis(json?.create_time),
    updatedAt: toMillis(json?.update_time),
    messages,
    hasFullHistory: true
  }
}

/** ---------------- Claude parsers ---------------- */

const parseClaudeList = (orgId: string, json: any): Array<Pick<Conversation, "id" | "title" | "createdAt" | "updatedAt" | "orgId">> => {
  const items =
    Array.isArray(json?.chat_conversations) ? json.chat_conversations :
    Array.isArray(json?.conversations) ? json.conversations :
    Array.isArray(json) ? json :
    []

  return items
    .map((c: any) => {
      const id = typeof c?.uuid === "string" ? c.uuid : typeof c?.id === "string" ? c.id : null
      if (!id) return null
      return {
        id,
        title: typeof c?.name === "string" ? c.name : typeof c?.title === "string" ? c.title : undefined,
        createdAt: toMillis(c?.created_at) ?? toMillis(c?.createdAt),
        updatedAt: toMillis(c?.updated_at) ?? toMillis(c?.updatedAt),
        orgId
      }
    })
    .filter(Boolean) as Array<Pick<Conversation, "id" | "title" | "createdAt" | "updatedAt" | "orgId">>
}

const roleFromClaudeMessage = (m: any): "user" | "assistant" => {
  const raw =
    (typeof m?.sender === "string" ? m.sender :
    typeof m?.role === "string" ? m.role :
    typeof m?.author === "string" ? m.author :
    typeof m?.author?.role === "string" ? m.author.role :
    "") || ""

  const r = raw.toLowerCase()
  if (r.includes("human") || r.includes("user") || r.includes("you")) return "user"
  return "assistant"
}

const extractClaudeText = (m: any): string => {
  // Common candidates
  if (typeof m?.text === "string") return normalizeText(m.text)
  if (typeof m?.content === "string") return normalizeText(m.content)
  if (typeof m?.message === "string") return normalizeText(m.message)

  // content blocks array (Claude often uses structured blocks)
  const content = m?.content ?? m?.message?.content ?? m?.blocks
  if (Array.isArray(content)) {
    const joined = content
      .map((b: any) => {
        if (typeof b === "string") return b
        if (typeof b?.text === "string") return b.text
        if (typeof b?.content === "string") return b.content
        return ""
      })
      .filter(Boolean)
      .join("\n")
    return normalizeText(joined)
  }

  // Sometimes nested: { content: { blocks: [...] } }
  const blocks = m?.content?.blocks
  if (Array.isArray(blocks)) {
    const joined = blocks
      .map((b: any) => (typeof b?.text === "string" ? b.text : typeof b === "string" ? b : ""))
      .filter(Boolean)
      .join("\n")
    return normalizeText(joined)
  }

  return ""
}

const parseClaudeDetail = (orgId: string, uuid: string, json: any): Pick<
  Conversation,
  "id" | "title" | "createdAt" | "updatedAt" | "messages" | "hasFullHistory" | "orgId"
> => {
  const title =
    typeof json?.name === "string" ? json.name :
    typeof json?.title === "string" ? json.title :
    undefined

  const createdAt = toMillis(json?.created_at) ?? toMillis(json?.createdAt)
  const updatedAt = toMillis(json?.updated_at) ?? toMillis(json?.updatedAt)

  const arr =
    Array.isArray(json?.chat_messages) ? json.chat_messages :
    Array.isArray(json?.messages) ? json.messages :
    Array.isArray(json?.turns) ? json.turns :
    []

  const platformLabel = getPlatformLabel("claude")

  const messages: Message[] = arr
    .map((m: any, idx: number) => {
      const text = extractClaudeText(m)
      if (!text) return null
      const role = roleFromClaudeMessage(m)
      const id =
        typeof m?.uuid === "string" ? m.uuid :
        typeof m?.id === "string" ? m.id :
        `claude-${uuid}-${idx}`
      const authorName = role === "user" ? "You" : platformLabel
      return {
        id,
        role,
        text,
        authorName,
        node: createDetachedNode(id)
      } as Message
    })
    .filter(Boolean) as Message[]

  return {
    id: uuid,
    orgId,
    title,
    createdAt,
    updatedAt,
    messages,
    hasFullHistory: true
  }
}

/** ---------------- Merge logic ---------------- */

const mergeMessagesPreferIncomingOrder = (incoming: Message[], existing: Message[]): Message[] => {
  const byId = new Map<string, Message>()
  for (const m of existing) byId.set(m.id, m)

  const merged: Message[] = []
  const seen = new Set<string>()

  for (const m of incoming) {
    const prev = byId.get(m.id)
    if (prev) {
      // Prefer the "more complete" text if one is longer
      const pick = (prev.text || "").length > (m.text || "").length ? prev : m
      merged.push({ ...pick, node: pick.node ?? m.node })
    } else {
      merged.push(m)
    }
    seen.add(m.id)
  }

  // Keep any messages we had that are missing from incoming (rare, but prevents loss)
  for (const m of existing) {
    if (!seen.has(m.id)) merged.push(m)
  }

  return merged
}

const mergeConversation = (existing: Conversation | undefined, incoming: Conversation): Conversation => {
  if (!existing) return incoming

  const title = incoming.title || existing.title
  const createdAt = (() => {
    const a = existing.createdAt
    const b = incoming.createdAt
    if (a == null) return b
    if (b == null) return a
    return Math.min(a, b)
  })()
  const updatedAt = (() => {
    const a = existing.updatedAt
    const b = incoming.updatedAt
    if (a == null) return b
    if (b == null) return a
    return Math.max(a, b)
  })()

  const orgId = existing.orgId || incoming.orgId

  // Message upgrade rules:
  // - Detail endpoint (hasFullHistory=true) always wins for ordering/completeness.
  // - If neither is full, keep the longer one / merge union.
  let messages = existing.messages
  let hasFullHistory = existing.hasFullHistory

  if (incoming.messages.length > 0) {
    if (incoming.hasFullHistory) {
      messages = mergeMessagesPreferIncomingOrder(incoming.messages, existing.messages)
      hasFullHistory = true
    } else if (!existing.hasFullHistory) {
      if (incoming.messages.length >= existing.messages.length) {
        messages = mergeMessagesPreferIncomingOrder(incoming.messages, existing.messages)
      } else {
        messages = mergeMessagesPreferIncomingOrder(existing.messages, incoming.messages)
      }
      hasFullHistory = false
    }
  }

  return {
    ...existing,
    id: existing.id,
    platform: existing.platform,
    title,
    createdAt,
    updatedAt,
    orgId,
    messages,
    hasFullHistory,
    lastSeenAt: Math.max(existing.lastSeenAt, incoming.lastSeenAt)
  }
}

const computeStats = (conversations: Conversation[]): ScannerStats => {
  let totalMessages = 0
  let withMessages = 0
  for (const c of conversations) {
    if (c.messages.length > 0) withMessages++
    totalMessages += c.messages.length
  }
  return {
    totalConversations: conversations.length,
    conversationsWithMessages: withMessages,
    totalMessages,
    lastCapturedAt: now()
  }
}

/** ---------------- Hook ---------------- */

export const useMessageScanner = ({ isExporterOpen }: UseMessageScannerProps) => {
  const platform = useMemo(() => detectPlatform(), [])
  const capturedPlatform = isCapturedPlatform(platform) ? platform : null

  console.log("[useMessageScanner] Initialized", { platform, capturedPlatform, isExporterOpen })

  // Backward-compatible return values
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationKey, setConversationKey] = useState<string>(getConversationKey())

  // New state you requested (kept additive so existing consumers don't break)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [stats, setStats] = useState<ScannerStats>({
    totalConversations: 0,
    conversationsWithMessages: 0,
    totalMessages: 0,
    lastCapturedAt: undefined
  })

  const storeRef = useRef<Map<string, Conversation>>(new Map())

  const isScanningRef = useRef<boolean>(false)
  const [isScanning, setIsScanning] = useState<boolean>(false)

  const upsertMany = useCallback((incoming: Conversation[]) => {
    if (incoming.length === 0) return

    console.log("[useMessageScanner] upsertMany: processing", incoming.length, "conversation(s)")

    const store = storeRef.current
    for (const c of incoming) {
      const key = `${c.platform}:${c.id}`
      const existing = store.get(key)
      const merged = mergeConversation(existing, c)
      store.set(key, merged)
      
      console.log("[useMessageScanner] Upserted conversation", {
        key,
        platform: c.platform,
        id: c.id,
        title: c.title,
        messageCount: merged.messages.length,
        hasFullHistory: merged.hasFullHistory,
        wasNew: !existing
      })
    }

    // Only force React updates when scanning is enabled (reduces rerenders while still capturing in store)
    if (!isScanningRef.current) {
      console.log("[useMessageScanner] upsertMany: skipping React update (not scanning)")
      return
    }

    const next = Array.from(store.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    setConversations(next)
    const newStats = computeStats(next)
    setStats(newStats)
    console.log("[useMessageScanner] upsertMany: updated state", {
      totalConversations: newStats.totalConversations,
      conversationsWithMessages: newStats.conversationsWithMessages,
      totalMessages: newStats.totalMessages
    })
  }, [])

  const syncActiveMessages = useCallback(() => {
    if (!capturedPlatform) {
      console.log("[useMessageScanner] syncActiveMessages: no captured platform, clearing messages")
      setMessages([])
      return
    }

    const activeId = getActiveConversationIdFromUrl(capturedPlatform)
    if (!activeId) {
      console.log("[useMessageScanner] syncActiveMessages: no active conversation ID, clearing messages")
      setMessages([])
      return
    }

    const key = `${capturedPlatform}:${activeId}`
    const convo = storeRef.current.get(key)
    const messageCount = convo?.messages.length ?? 0
    console.log("[useMessageScanner] syncActiveMessages", {
      platform: capturedPlatform,
      activeId,
      key,
      messageCount,
      hasConversation: !!convo
    })
    setMessages(convo?.messages ?? [])
  }, [capturedPlatform])

  const flushAllState = useCallback(() => {
    const next = Array.from(storeRef.current.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    const stats = computeStats(next)
    console.log("[useMessageScanner] flushAllState", {
      conversationCount: next.length,
      totalMessages: stats.totalMessages,
      conversationsWithMessages: stats.conversationsWithMessages
    })
    setConversations(next)
    setStats(stats)
    syncActiveMessages()
  }, [syncActiveMessages])

  const startScanning = useCallback(() => {
    console.log("[useMessageScanner] startScanning: enabling scan mode")
    isScanningRef.current = true
    setIsScanning(true)
    flushAllState()
  }, [flushAllState])

  const stopScanning = useCallback(() => {
    console.log("[useMessageScanner] stopScanning: disabling scan mode")
    isScanningRef.current = false
    setIsScanning(false)
  }, [])

  // Keep your old behavior: scanning enabled when exporter opens
  useEffect(() => {
    console.log("[useMessageScanner] isExporterOpen changed:", isExporterOpen)
    if (isExporterOpen) startScanning()
    else stopScanning()
  }, [isExporterOpen, startScanning, stopScanning])

  const handleInterceptorEvent = useCallback((evt: InterceptorEvent) => {
    if (!evt?.url || !evt?.data) {
      console.log("[useMessageScanner] handleInterceptorEvent: skipping (missing url or data)", { hasUrl: !!evt?.url, hasData: !!evt?.data })
      return
    }

    let url: URL
    try {
      url = new URL(evt.url)
    } catch {
      console.log("[useMessageScanner] handleInterceptorEvent: invalid URL", evt.url)
      return
    }

    const inferred = inferCapturedPlatformFromUrl(url)
    if (!inferred) {
      console.log("[useMessageScanner] handleInterceptorEvent: not a captured platform", { url: evt.url, pathname: url.pathname })
      return
    }

    console.log("[useMessageScanner] handleInterceptorEvent: intercepted", {
      platform: inferred,
      url: evt.url,
      method: evt.method,
      status: evt.status,
      ok: evt.ok,
      hasData: !!evt.data
    })

    const seenAt = now()

    // ChatGPT
    if (inferred === "chatgpt") {
      if (matchChatGPTList(url)) {
        console.log("[useMessageScanner] ChatGPT list endpoint detected")
        const metas = parseChatGPTList(evt.data)
        console.log("[useMessageScanner] Parsed ChatGPT list:", metas.length, "conversations")
        const convos: Conversation[] = metas.map((m) => ({
          id: m.id,
          platform: "chatgpt",
          title: m.title,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          messages: [],
          hasFullHistory: false,
          lastSeenAt: seenAt
        }))
        upsertMany(convos)
        return
      }

      if (matchChatGPTDetail(url)) {
        const id = extractPathSegment(url.pathname, 0)
        if (!id) {
          console.log("[useMessageScanner] ChatGPT detail: failed to extract ID from", url.pathname)
          return
        }

        console.log("[useMessageScanner] ChatGPT detail endpoint detected:", id)
        const parsed = parseChatGPTDetail(id, evt.data)
        console.log("[useMessageScanner] Parsed ChatGPT detail:", {
          id,
          title: parsed.title,
          messageCount: parsed.messages.length,
          hasFullHistory: parsed.hasFullHistory
        })
        upsertMany([
          {
            id,
            platform: "chatgpt",
            title: parsed.title,
            createdAt: parsed.createdAt,
            updatedAt: parsed.updatedAt,
            messages: parsed.messages,
            hasFullHistory: true,
            lastSeenAt: seenAt
          }
        ])

        // If this is the active conversation, refresh messages immediately
        if (isScanningRef.current && capturedPlatform === "chatgpt") {
          console.log("[useMessageScanner] Active ChatGPT conversation updated, syncing messages")
          syncActiveMessages()
        }
        return
      }

      return
    }

    // Claude
    if (inferred === "claude") {
      if (matchClaudeList(url)) {
        // List: /api/organizations/{orgId}/conversations → orgId is index 1 from end
        const orgId = extractPathSegment(url.pathname, 1)
        if (!orgId) {
          console.log("[useMessageScanner] Claude list: failed to extract orgId from", url.pathname)
          return
        }

        console.log("[useMessageScanner] Claude list endpoint detected, orgId:", orgId)
        const metas = parseClaudeList(orgId, evt.data)
        console.log("[useMessageScanner] Parsed Claude list:", metas.length, "conversations")
        const convos: Conversation[] = metas.map((m) => ({
          id: m.id,
          platform: "claude",
          title: m.title,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          orgId: m.orgId,
          messages: [],
          hasFullHistory: false,
          lastSeenAt: seenAt
        }))
        upsertMany(convos)
        return
      }

      if (matchClaudeDetail(url)) {
        // Detail: /api/organizations/{orgId}/conversations/{uuid} → uuid is index 0, orgId is index 2
        const uuid = extractPathSegment(url.pathname, 0)
        const orgId = extractPathSegment(url.pathname, 2)
        if (!uuid || !orgId) {
          console.log("[useMessageScanner] Claude detail: failed to extract UUID or orgId from", url.pathname)
          return
        }

        console.log("[useMessageScanner] Claude detail endpoint detected:", { orgId, uuid })
        const parsed = parseClaudeDetail(orgId, uuid, evt.data)
        console.log("[useMessageScanner] Parsed Claude detail:", {
          uuid,
          orgId: parsed.orgId,
          title: parsed.title,
          messageCount: parsed.messages.length,
          hasFullHistory: parsed.hasFullHistory
        })
        upsertMany([
          {
            id: uuid,
            platform: "claude",
            title: parsed.title,
            createdAt: parsed.createdAt,
            updatedAt: parsed.updatedAt,
            orgId: parsed.orgId,
            messages: parsed.messages,
            hasFullHistory: true,
            lastSeenAt: seenAt
          }
        ])

        if (isScanningRef.current && capturedPlatform === "claude") {
          console.log("[useMessageScanner] Active Claude conversation updated, syncing messages")
          syncActiveMessages()
        }
        return
      }

      return
    }
  }, [capturedPlatform, syncActiveMessages, upsertMany])

  // Listen for intercepted network data directly from window.postMessage (from MAIN world interceptor)
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      // Security: only accept messages from same window
      if (event.source !== window) return

      const data = event.data
      if (!data || data.source !== INTERCEPTOR_SOURCE) return

      console.log("[useMessageScanner] Received intercepted data via postMessage:", data.url)

      handleInterceptorEvent({
        source: INTERCEPTOR_SOURCE,
        url: data.url,
        method: data.method,
        status: data.status,
        ok: data.ok,
        ts: data.ts,
        data: data.data
      })
    }

    window.addEventListener("message", listener)
    return () => window.removeEventListener("message", listener)
  }, [handleInterceptorEvent])
  // Detect URL changes (SPA navigation) and keep conversationKey + messages in sync
  useEffect(() => {
    console.log("[useMessageScanner] Setting up URL change detection interval")
    const interval = window.setInterval(() => {
      const nextKey = getConversationKey()
      if (nextKey !== conversationKey) {
        console.log("[useMessageScanner] URL changed:", { from: conversationKey, to: nextKey })
        setConversationKey(nextKey)

        // Refresh messages for the newly active conversation
        if (isScanningRef.current) {
          console.log("[useMessageScanner] Scanning active, syncing messages for new conversation")
          syncActiveMessages()
        } else {
          // Even if not scanning, keep messages cleared so exporter won't show stale content
          console.log("[useMessageScanner] Not scanning, clearing messages")
          setMessages([])
        }
      }
    }, 400)

    return () => {
      console.log("[useMessageScanner] Cleaning up URL change detection interval")
      window.clearInterval(interval)
    }
  }, [conversationKey, syncActiveMessages])

  /**
   * Backward-compatible "rescan":
   * - In network mode we don't scrape the DOM.
   * - This does a best-effort refresh from store, and (optionally) refetches the current detail endpoint
   *   when we can derive the URL.
   */
  const rescan = useCallback(async () => {
    console.log("[useMessageScanner] rescan called", { capturedPlatform })
    flushAllState()

    if (!capturedPlatform) {
      console.log("[useMessageScanner] rescan: no captured platform, skipping fetch")
      return
    }
    const activeId = getActiveConversationIdFromUrl(capturedPlatform)
    if (!activeId) {
      console.log("[useMessageScanner] rescan: no active conversation ID, skipping fetch")
      return
    }

    console.log("[useMessageScanner] rescan: fetching detail for", { platform: capturedPlatform, activeId })

    try {
      if (capturedPlatform === "chatgpt") {
        const url = `/backend-api/conversation/${activeId}`
        console.log("[useMessageScanner] rescan: fetching ChatGPT detail", url)
        const resp = await fetch(url, {
          credentials: "include",
          headers: { accept: "application/json" }
        })
        if (!resp.ok) {
          console.log("[useMessageScanner] rescan: ChatGPT fetch failed", resp.status, resp.statusText)
          return
        }
        const json = await resp.json().catch(() => null)
        if (!json) {
          console.log("[useMessageScanner] rescan: ChatGPT response not JSON")
          return
        }
        console.log("[useMessageScanner] rescan: ChatGPT detail fetched successfully")
        handleInterceptorEvent({
          source: INTERCEPTOR_SOURCE,
          url: new URL(url, window.location.origin).href,
          method: "GET",
          status: resp.status,
          ok: resp.ok,
          ts: now(),
          data: json
        })
      }

      if (capturedPlatform === "claude") {
        const key = `claude:${activeId}`
        const convo = storeRef.current.get(key)
        const orgId = convo?.orgId
        if (!orgId) {
          console.log("[useMessageScanner] rescan: Claude conversation missing orgId", { key, hasConvo: !!convo })
          return
        }

        const url = `/api/organizations/${orgId}/conversations/${activeId}`
        console.log("[useMessageScanner] rescan: fetching Claude detail", url)
        const resp = await fetch(url, {
          credentials: "include",
          headers: { accept: "application/json" }
        })
        if (!resp.ok) {
          console.log("[useMessageScanner] rescan: Claude fetch failed", resp.status, resp.statusText)
          return
        }
        const json = await resp.json().catch(() => null)
        if (!json) {
          console.log("[useMessageScanner] rescan: Claude response not JSON")
          return
        }
        console.log("[useMessageScanner] rescan: Claude detail fetched successfully")
        handleInterceptorEvent({
          source: INTERCEPTOR_SOURCE,
          url: new URL(url, window.location.origin).href,
          method: "GET",
          status: resp.status,
          ok: resp.ok,
          ts: now(),
          data: json
        })
      }
    } catch (error) {
      console.error("[useMessageScanner] rescan: error during fetch", error)
    }
  }, [capturedPlatform, flushAllState, handleInterceptorEvent])

  return {
    // Existing return fields (do not break current usage)
    messages,
    rescan,
    conversationKey,

    // Additive fields you asked to keep (won’t break existing destructuring)
    conversations,
    stats,
    isScanning,
    startScanning,
    stopScanning
  }
}
