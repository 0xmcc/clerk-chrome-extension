import type { Message } from "~hooks/useMessageScanner/types"

export type HumanSentimentStatus = "idle" | "loading" | "ready" | "error"

export type HumanSentimentPoint = {
  messageIndex: number
  score: number
  label?: string
  rationale?: string
}

export type HumanSentimentSource =
  | {
      kind: "structured"
      title?: string
      messages: Message[]
    }
  | {
      kind: "markdown"
      title?: string
      markdown: string
    }

export const NEUTRAL_HUMAN_SENTIMENT_POINT: HumanSentimentPoint = {
  messageIndex: 0,
  score: 0,
  label: "Neutral"
}

export const HUMAN_SENTIMENT_SYSTEM_PROMPT = `You analyze the human user's emotional sentiment over an AI conversation.

Return JSON only in this exact shape:
{"points":[{"messageIndex":1,"score":0,"label":"Neutral","rationale":"short reason"}]}

Rules:
- Score only human/user messages.
- Start from the assumption that the human is neutral at the beginning of the conversation.
- Use messageIndex as the transcript message index for structured input. For markdown input, infer the human/user messages and use their natural message order.
- Score range is -100 to +100.
- -100 means strongly unhappy, frustrated, blocked, or angry.
- 0 means neutral, procedural, or emotionally flat.
- +100 means strongly happy, relieved, excited, or satisfied with the responses.
- Keep labels short.`

const MAX_STRUCTURED_TEXT_LENGTH = 4000
const MAX_MARKDOWN_LENGTH = 30000

const clampScore = (score: number): number =>
  Math.max(-100, Math.min(100, Math.round(score)))

const normalizeLabel = (label: unknown): string | undefined => {
  if (typeof label !== "string") return undefined
  const normalized = label.trim()
  return normalized ? normalized.slice(0, 40) : undefined
}

const normalizeRationale = (rationale: unknown): string | undefined => {
  if (typeof rationale !== "string") return undefined
  const normalized = rationale.trim()
  return normalized ? normalized.slice(0, 180) : undefined
}

const clipText = (text: string, maxLength: number): string =>
  text.length > maxLength ? `${text.slice(0, maxLength)}...` : text

export const buildHumanSentimentUserPrompt = (
  source: HumanSentimentSource
): string => {
  const titleLine = source.title ? `Conversation title: ${source.title}\n\n` : ""

  if (source.kind === "markdown") {
    return `${titleLine}Infer the human/user messages from this markdown capture, then score the human's emotional sentiment from the beginning to the end of the transcript.\n\nMarkdown transcript:\n${clipText(source.markdown, MAX_MARKDOWN_LENGTH)}`
  }

  const transcript = source.messages.map((message, index) => ({
    index: index + 1,
    role: message.role,
    text: clipText(message.text, MAX_STRUCTURED_TEXT_LENGTH)
  }))

  return `${titleLine}Score the human's emotional sentiment across these transcript messages.\n\nTranscript messages:\n${JSON.stringify(transcript, null, 2)}`
}

const extractJsonObject = (rawText: string): string => {
  const withoutFence = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim()

  const firstBrace = withoutFence.indexOf("{")
  const lastBrace = withoutFence.lastIndexOf("}")

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("Sentiment response did not include JSON.")
  }

  return withoutFence.slice(firstBrace, lastBrace + 1)
}

export const parseHumanSentimentCompletion = (
  rawText: string
): HumanSentimentPoint[] => {
  const parsed = JSON.parse(extractJsonObject(rawText)) as {
    points?: Array<Record<string, unknown>>
  }
  const rawPoints = Array.isArray(parsed.points) ? parsed.points : []
  const seenMessageIndices = new Set<number>()
  const points: HumanSentimentPoint[] = []

  rawPoints.forEach((point) => {
    const messageIndex = Number(point.messageIndex)
    const score = Number(point.score)

    if (
      !Number.isFinite(messageIndex) ||
      !Number.isFinite(score) ||
      messageIndex <= 0
    ) {
      return
    }

    const normalizedMessageIndex = Math.round(messageIndex)

    if (seenMessageIndices.has(normalizedMessageIndex)) {
      return
    }

    seenMessageIndices.add(normalizedMessageIndex)
    points.push({
      messageIndex: normalizedMessageIndex,
      score: clampScore(score),
      ...(normalizeLabel(point.label) ? { label: normalizeLabel(point.label) } : {}),
      ...(normalizeRationale(point.rationale)
        ? { rationale: normalizeRationale(point.rationale) }
        : {})
    })
  })

  return [
    { ...NEUTRAL_HUMAN_SENTIMENT_POINT },
    ...points.sort((left, right) => left.messageIndex - right.messageIndex)
  ]
}

export const getHumanSentimentSourceKey = (
  source: HumanSentimentSource | null
): string => {
  if (!source) return "none"

  if (source.kind === "markdown") {
    return `markdown:${source.title ?? ""}:${source.markdown.length}:${source.markdown.slice(0, 120)}`
  }

  return `structured:${source.title ?? ""}:${source.messages
    .map((message, index) => `${index}:${message.id}:${message.role}:${message.text.length}`)
    .join("|")}`
}
