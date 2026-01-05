import { getPlatformLabel } from "~utils/platform"
import type { Conversation, Message } from "../types"
import { toMillis, normalizeText, createDetachedNode } from "../utils"

export const parseChatGPTList = (json: unknown): Array<Pick<Conversation, "id" | "title" | "createdAt" | "updatedAt">> => {
  const data = json as Record<string, unknown> | unknown[] | null
  const items = Array.isArray((data as Record<string, unknown>)?.items)
    ? (data as Record<string, unknown>).items as unknown[]
    : Array.isArray(data)
      ? data
      : []

  return items
    .map((item: unknown) => {
      const obj = item as Record<string, unknown>
      const id = obj?.id
      if (!id || typeof id !== "string") return null
      return {
        id,
        title: typeof obj?.title === "string" ? obj.title : undefined,
        createdAt: toMillis(obj?.create_time),
        updatedAt: toMillis(obj?.update_time)
      }
    })
    .filter(Boolean) as Array<Pick<Conversation, "id" | "title" | "createdAt" | "updatedAt">>
}

export const extractChatGPTText = (message: unknown): string => {
  const msg = message as Record<string, unknown>
  const content = msg?.content as Record<string, unknown> | string | null
  if (!content) return ""

  // Common shape: { content_type: "text", parts: ["..."] }
  const parts = (content as Record<string, unknown>)?.parts
  if (Array.isArray(parts)) {
    const joined = parts
      .map((p: unknown) => {
        if (typeof p === "string") return p
        if (typeof (p as Record<string, unknown>)?.text === "string") return (p as Record<string, unknown>).text as string
        return ""
      })
      .filter(Boolean)
      .join("\n")
    return normalizeText(joined)
  }

  // Sometimes: { text: "..." }
  if (typeof (content as Record<string, unknown>)?.text === "string") {
    return normalizeText((content as Record<string, unknown>).text as string)
  }

  // Fallback: stringify cautiously
  if (typeof content === "string") return normalizeText(content)

  return ""
}

export const roleFromChatGPTAuthor = (authorRole: unknown): "user" | "assistant" => {
  const r = typeof authorRole === "string" ? authorRole.toLowerCase() : ""
  if (r === "user") return "user"
  // Treat system/tool as assistant for export compatibility
  return "assistant"
}

// Helper: Fast tree traversal following current_node via parent pointers
const parseTree = (
  conversationId: string,
  mapping: Record<string, unknown>,
  currentNode: string | null
): Message[] => {
  const chain: Record<string, unknown>[] = []
  const visited = new Set<string>()

  let nodeId: string | null = currentNode
  while (nodeId && mapping[nodeId] && !visited.has(nodeId)) {
    visited.add(nodeId)
    const node = mapping[nodeId] as Record<string, unknown>
    chain.push(node)
    nodeId = typeof node?.parent === "string" ? node.parent : null
  }

  chain.reverse()

  const platformLabel = getPlatformLabel("chatgpt")
  const messages: Message[] = []

  for (let i = 0; i < chain.length; i++) {
    const node = chain[i]
    const msg = node?.message as Record<string, unknown>
    if (!msg) continue

    const text = extractChatGPTText(msg)
    if (!text) continue

    const author = msg?.author as Record<string, unknown>
    const role = roleFromChatGPTAuthor(author?.role)
    const id = typeof msg?.id === "string" ? msg.id : typeof node?.id === "string" ? node.id as string : `chatgpt-${conversationId}-${i}`
    const authorName = role === "user" ? "You" : platformLabel

    messages.push({
      id,
      role,
      text,
      authorName,
      node: createDetachedNode(id)
    })
  }

  return messages
}

// Helper: Robust linear fallback with timestamp fix
const parseLinear = (
  conversationId: string,
  mapping: Record<string, unknown>
): Message[] => {
  // Extract all nodes with messages
  const allNodes: Array<{ node: Record<string, unknown>; nodeId: string; createTime: number }> = []

  for (const nodeId of Object.keys(mapping)) {
    const node = mapping[nodeId] as Record<string, unknown>
    const msg = node?.message as Record<string, unknown> | undefined

    if (!msg) continue // Skip nodes without messages (internal/system nodes)

    const authorRole = (msg?.author as Record<string, unknown>)?.role
    if (authorRole !== "user" && authorRole !== "assistant") continue // Skip system messages

    const text = extractChatGPTText(msg)
    if (!text) continue // Skip empty messages

    let createTime = typeof msg?.create_time === "number" ? msg.create_time : 0

    // Timestamp Fix: If create_time is 0 (missing), look up parent and add small offset
    if (createTime === 0) {
      const parentId = typeof node?.parent === "string" ? node.parent : null
      if (parentId && mapping[parentId]) {
        const parentNode = mapping[parentId] as Record<string, unknown>
        const parentMsg = parentNode?.message as Record<string, unknown> | undefined
        if (parentMsg) {
          const parentCreateTime = typeof parentMsg?.create_time === "number" ? parentMsg.create_time : 0
          if (parentCreateTime > 0) {
            createTime = parentCreateTime + 0.000001
          }
        }
      }
    }

    allNodes.push({ node, nodeId, createTime })
  }

  // Sort chronologically by create_time
  allNodes.sort((a, b) => a.createTime - b.createTime)

  const platformLabel = getPlatformLabel("chatgpt")

  // Convert to Message objects
  return allNodes.map(({ node }, idx) => {
    const msg = node.message as Record<string, unknown>
    const author = msg?.author as Record<string, unknown>
    const role = roleFromChatGPTAuthor(author?.role)
    const text = extractChatGPTText(msg)
    const id = typeof msg?.id === "string" ? msg.id : typeof node?.id === "string" ? node.id as string : `chatgpt-${conversationId}-${idx}`
    const authorName = role === "user" ? "You" : platformLabel

    return {
      id,
      role,
      text,
      authorName,
      node: createDetachedNode(id)
    }
  })
}

export const parseChatGPTDetail = (conversationId: string, json: unknown): Pick<
  Conversation,
  "id" | "title" | "createdAt" | "updatedAt" | "messages" | "hasFullHistory"
> => {
  const data = json as Record<string, unknown>
  const mapping = data?.mapping && typeof data.mapping === "object" ? data.mapping as Record<string, unknown> : {}
  const currentNode = typeof data?.current_node === "string" ? data.current_node : null

  let messages: Message[] = []

  // Tier 1 (Speed): Try tree traversal first
  try {
    messages = parseTree(conversationId, mapping, currentNode)
    
    // Tier 2 (Safety): If tree returns 0 messages, fallback to linear
    if (messages.length === 0) {
      console.warn("[parseChatGPTDetail] Tree traversal returned 0 messages, falling back to linear parser", { conversationId })
      messages = parseLinear(conversationId, mapping)
    }
  } catch (error) {
    // Tier 2 (Safety): If tree traversal throws, fallback to linear
    console.warn("[parseChatGPTDetail] Tree traversal failed, falling back to linear parser", { conversationId, error })
    messages = parseLinear(conversationId, mapping)
  }

  return {
    id: conversationId,
    title: typeof data?.title === "string" ? data.title : undefined,
    createdAt: toMillis(data?.create_time),
    updatedAt: toMillis(data?.update_time),
    messages,
    hasFullHistory: true
  }
}
