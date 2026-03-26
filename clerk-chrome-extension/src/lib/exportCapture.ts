import type { CaptureMetadata } from "~lib/capture"
import type { TranscriptSegment } from "~lib/transcript-parser"
import { formatTimestamp } from "~lib/transcript-parser"
import { deriveConversationIdFromUrl } from "~utils/conversation"

interface ExportPayloadMessage {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  tokens: number
  metadata: Record<string, unknown>
}

export interface CaptureExportPayload {
  conversationId: string
  title: string
  model: string
  selectedMessageIds: string[]
  messages: ExportPayloadMessage[]
  metadata: {
    source: string
    sourceUrl: string
    host: string
    platform: string
    surface: CaptureMetadata["surface"]
    captureMode: "structured_conversation" | "youtube_transcript"
    videoId?: string
  }
}

interface SerializableStructuredMessage {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  text: string
  authorName?: string
}

interface SerializableStructuredCapture {
  captureMode: "structured_conversation"
  conversationKey: string
  title?: string
  messages: SerializableStructuredMessage[]
  metadata: CaptureMetadata
}

interface SerializableYouTubeTranscriptCapture {
  captureMode: "youtube_transcript"
  conversationKey: string
  videoId: string
  videoTitle: string
  videoUrl: string
  segments: TranscriptSegment[]
  metadata: CaptureMetadata
}

export type SerializableExportCapture =
  | SerializableStructuredCapture
  | SerializableYouTubeTranscriptCapture

export const estimateTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length / 4))

export const getCaptureCount = (capture: SerializableExportCapture): number =>
  capture.captureMode === "structured_conversation"
    ? capture.messages.length
    : capture.segments.length

const getHost = (input: string): string => {
  try {
    return new URL(input).hostname
  } catch {
    return window.location.hostname
  }
}

export const buildCaptureExportPayload = (
  capture: SerializableExportCapture,
  source: string
): CaptureExportPayload => {
  if (capture.captureMode === "structured_conversation") {
    const conversationId = deriveConversationIdFromUrl(
      capture.metadata.sourceUrl,
      capture.conversationKey
    )

    const messages = capture.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.text,
      tokens: estimateTokens(message.text),
      metadata: {
        extensionMessageId: message.id,
        senderName: message.authorName
      }
    }))

    return {
      conversationId,
      title: capture.title || capture.metadata.pageTitle || "Conversation",
      model: capture.metadata.platform.toLowerCase(),
      selectedMessageIds: messages.map((message) => message.id),
      messages,
      metadata: {
        source,
        sourceUrl: capture.metadata.sourceUrl,
        host: getHost(capture.metadata.sourceUrl),
        platform: capture.metadata.platform.toLowerCase(),
        surface: capture.metadata.surface,
        captureMode: "structured_conversation"
      }
    }
  }

  const sourceUrl = capture.videoUrl || capture.metadata.sourceUrl
  const baseConversationId =
    capture.videoId ||
    deriveConversationIdFromUrl(sourceUrl, capture.conversationKey)
  const conversationId = `youtube-${baseConversationId}`
  const messages = capture.segments.map((segment, index) => ({
    id: `${conversationId}::segment_${String(index + 1).padStart(4, "0")}`,
    role: "assistant" as const,
    content: segment.text,
    tokens: estimateTokens(segment.text),
    metadata: {
      seconds: segment.seconds,
      timestamp: formatTimestamp(segment.seconds),
      section: segment.section || null
    }
  }))

  return {
    conversationId,
    title: capture.videoTitle || capture.metadata.pageTitle || "YouTube transcript",
    model: "youtube",
    selectedMessageIds: messages.map((message) => message.id),
    messages,
    metadata: {
      source,
      sourceUrl,
      host: getHost(sourceUrl),
      platform: "youtube",
      surface: capture.metadata.surface,
      captureMode: "youtube_transcript",
      videoId: capture.videoId
    }
  }
}

export const buildYouTubeTranscriptMarkdown = (
  capture: SerializableYouTubeTranscriptCapture
): string => {
  const transcriptLines = [
    "---",
    `sourceUrl: ${capture.videoUrl || capture.metadata.sourceUrl}`,
    `pageTitle: ${capture.metadata.pageTitle}`,
    `capturedAt: ${capture.metadata.capturedAt}`,
    "platform: youtube",
    `surface: ${capture.metadata.surface}`,
    "captureMode: youtube_transcript",
    `videoId: ${capture.videoId}`,
    `videoTitle: ${capture.videoTitle}`,
    "---",
    "",
    `# ${capture.videoTitle || "YouTube Transcript"}`,
    ""
  ]

  let previousSection: string | undefined

  capture.segments.forEach((segment) => {
    if (segment.section && segment.section !== previousSection) {
      transcriptLines.push(`## ${segment.section}`, "")
    }

    previousSection = segment.section
    transcriptLines.push(`- \`${formatTimestamp(segment.seconds)}\` ${segment.text}`)
  })

  return transcriptLines.join("\n")
}
