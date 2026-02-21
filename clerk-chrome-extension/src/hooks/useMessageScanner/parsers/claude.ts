import { getPlatformLabel } from "~utils/platform"
import type { Conversation, Message } from "../types"
import { toMillis, normalizeText, createDetachedNode, generateStableMessageId } from "../utils"

export const parseClaudeList = (orgId: string, json: unknown): Array<Pick<Conversation, "id" | "title" | "createdAt" | "updatedAt" | "orgId">> => {
  const data = json as Record<string, unknown> | unknown[] | null
  const items =
    Array.isArray((data as Record<string, unknown>)?.chat_conversations) ? (data as Record<string, unknown>).chat_conversations as unknown[] :
      Array.isArray((data as Record<string, unknown>)?.conversations) ? (data as Record<string, unknown>).conversations as unknown[] :
        Array.isArray(data) ? data :
          []

  return items
    .map((c: unknown) => {
      const obj = c as Record<string, unknown>
      const id = typeof obj?.uuid === "string" ? obj.uuid : typeof obj?.id === "string" ? obj.id : null
      if (!id) return null
      return {
        id,
        title: typeof obj?.name === "string" ? obj.name : typeof obj?.title === "string" ? obj.title : undefined,
        createdAt: toMillis(obj?.created_at) ?? toMillis(obj?.createdAt),
        updatedAt: toMillis(obj?.updated_at) ?? toMillis(obj?.updatedAt),
        orgId
      }
    })
    .filter(Boolean) as Array<Pick<Conversation, "id" | "title" | "createdAt" | "updatedAt" | "orgId">>
}

export const roleFromClaudeMessage = (m: unknown): "user" | "assistant" | "system" | "tool" => {
  const msg = m as Record<string, unknown>
  const author = msg?.author as Record<string, unknown> | undefined
  const raw =
    (typeof msg?.sender === "string" ? msg.sender :
      typeof msg?.role === "string" ? msg.role :
        typeof msg?.author === "string" ? msg.author :
          typeof author?.role === "string" ? author.role :
            "") || ""

  const r = raw.toLowerCase()
  if (r.includes("human") || r.includes("user") || r.includes("you")) return "user"
  if (r.includes("system") || r.includes("instruction") || r.includes("prompt")) return "system"
  if (r.includes("tool") || r.includes("function") || r.includes("observation")) return "tool"
  return "assistant"
}

export const extractClaudeText = (m: unknown): string => {
  const msg = m as Record<string, unknown>

  // Common candidates
  if (typeof msg?.text === "string") return normalizeText(msg.text)
  if (typeof msg?.content === "string") return normalizeText(msg.content)
  if (typeof msg?.message === "string") return normalizeText(msg.message)

  // content blocks array (Claude often uses structured blocks)
  const messageObj = msg?.message as Record<string, unknown> | undefined
  const content = msg?.content ?? messageObj?.content ?? msg?.blocks
  if (Array.isArray(content)) {
    const joined = content
      .map((b: unknown) => {
        if (typeof b === "string") return b
        const block = b as Record<string, unknown>
        if (typeof block?.text === "string") return block.text
        if (typeof block?.content === "string") return block.content
        return ""
      })
      .filter(Boolean)
      .join("\n")
    return normalizeText(joined)
  }

  // Sometimes nested: { content: { blocks: [...] } }
  const contentObj = msg?.content as Record<string, unknown> | undefined
  const blocks = contentObj?.blocks
  if (Array.isArray(blocks)) {
    const joined = blocks
      .map((b: unknown) => {
        const block = b as Record<string, unknown>
        return typeof block?.text === "string" ? block.text : typeof b === "string" ? b : ""
      })
      .filter(Boolean)
      .join("\n")
    return normalizeText(joined)
  }

  return ""
}

export const parseClaudeDetail = (orgId: string, uuid: string, json: unknown): Pick<
  Conversation,
  "id" | "title" | "createdAt" | "updatedAt" | "messages" | "hasFullHistory" | "orgId"
> => {
  const data = json as Record<string, unknown>
  const title =
    typeof data?.name === "string" ? data.name :
      typeof data?.title === "string" ? data.title :
        undefined

  const createdAt = toMillis(data?.created_at) ?? toMillis(data?.createdAt)
  const updatedAt = toMillis(data?.updated_at) ?? toMillis(data?.updatedAt)

  const arr =
    Array.isArray(data?.chat_messages) ? data.chat_messages as unknown[] :
      Array.isArray(data?.messages) ? data.messages as unknown[] :
        Array.isArray(data?.turns) ? data.turns as unknown[] :
          []

  const platformLabel = getPlatformLabel("claude")

  // ADD THIS: Log the structure of the first message to understand the format
  if (arr.length > 0) {
    console.log("[parseClaudeDetail] First message structure:", {
      message: arr[0],
      keys: Object.keys(arr[0] as Record<string, unknown> || {}),
      hasText: typeof (arr[0] as Record<string, unknown>)?.text === "string",
      hasContent: typeof (arr[0] as Record<string, unknown>)?.content === "string",
      hasMessage: typeof (arr[0] as Record<string, unknown>)?.message === "string",
      contentType: typeof (arr[0] as Record<string, unknown>)?.content,
      contentIsArray: Array.isArray((arr[0] as Record<string, unknown>)?.content)
    })
  }

  let validIndex = 0
  const messages: Message[] = arr
    .map((m: unknown, idx: number) => {
      const msg = m as Record<string, unknown>
      const text = extractClaudeText(m)

      // ADD THIS: Log when text extraction fails
      if (!text && idx < 3) { // Only log first 3 to avoid spam
        console.log(`[parseClaudeDetail] Failed to extract text from message ${idx}:`, {
          message: m,
          keys: Object.keys(msg),
          textField: msg?.text,
          contentField: msg?.content,
          messageField: msg?.message
        })
      }

      if (!text) return null
      const role = roleFromClaudeMessage(m)
      const id = generateStableMessageId(uuid, validIndex++)
      const authorName = role === "user" ? "You" : role === "system" ? "System" : role === "tool" ? "Tool" : platformLabel
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
