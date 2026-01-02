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

export const parseChatGPTDetail = (conversationId: string, json: unknown): Pick<
  Conversation,
  "id" | "title" | "createdAt" | "updatedAt" | "messages" | "hasFullHistory"
> => {
  const data = json as Record<string, unknown>
  const mapping = data?.mapping && typeof data.mapping === "object" ? data.mapping as Record<string, unknown> : {}

  // LINEAR APPROACH: Extract all messages from mapping, sort by create_time
  // This is more robust than tree traversal - works even if tree structure is broken
  const allNodes: Array<{ node: Record<string, unknown>; createTime: number }> = []

  for (const nodeId of Object.keys(mapping)) {
    const node = mapping[nodeId] as Record<string, unknown>
    const msg = node?.message as Record<string, unknown> | undefined

    if (!msg) continue // Skip nodes without messages (internal/system nodes)

    const authorRole = (msg?.author as Record<string, unknown>)?.role
    if (authorRole !== "user" && authorRole !== "assistant") continue // Skip system messages

    const text = extractChatGPTText(msg)
    if (!text) continue // Skip empty messages

    const createTime = typeof msg?.create_time === "number" ? msg.create_time : 0
    allNodes.push({ node, createTime })
  }

  // Sort chronologically by create_time
  allNodes.sort((a, b) => a.createTime - b.createTime)

  const platformLabel = getPlatformLabel("chatgpt")

  // Convert to Message objects
  const messages: Message[] = allNodes.map(({ node }, idx) => {
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

  return {
    id: conversationId,
    title: typeof data?.title === "string" ? data.title : undefined,
    createdAt: toMillis(data?.create_time),
    updatedAt: toMillis(data?.update_time),
    messages,
    hasFullHistory: true
  }
}
