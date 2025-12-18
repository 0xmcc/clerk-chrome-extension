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
  const currentNode = typeof data?.current_node === "string" ? data.current_node : null

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

  return {
    id: conversationId,
    title: typeof data?.title === "string" ? data.title : undefined,
    createdAt: toMillis(data?.create_time),
    updatedAt: toMillis(data?.update_time),
    messages,
    hasFullHistory: true
  }
}
