import type { ExportCapture, CaptureMetadata } from "~lib/capture"
import {
  isChatGPTConversationSurface,
  isClaudeChatSurface
} from "~lib/capture"
import type { TranscriptSegment } from "~lib/transcript-parser"
import {
  detectPlatformFromUrl,
  getPlatformLabel,
  type Platform
} from "~utils/platform"
import { deriveConversationIdFromUrl } from "~utils/conversation"

export const POPUP_GET_PAGE_CONTEXT = "momentum:popup:get-page-context"
export const POPUP_GET_CAPTURE = "momentum:popup:get-capture"
export const POPUP_RECENT_CAPTURES_KEY = "momentum:recent-captures:v1"

export type PopupPageStatus =
  | "ready"
  | "waiting"
  | "unsupported"
  | "unavailable"
  | "error"

export type PopupTranscriptStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "no_transcript"

export interface PopupSerializableMessage {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  text: string
  authorName: string
}

export interface PopupStructuredConversationCapture {
  captureMode: "structured_conversation"
  conversationKey: string
  title?: string
  messages: PopupSerializableMessage[]
  metadata: CaptureMetadata
}

export interface PopupYouTubeTranscriptCapture {
  captureMode: "youtube_transcript"
  conversationKey: string
  videoId: string
  videoTitle: string
  videoUrl: string
  segments: TranscriptSegment[]
  metadata: CaptureMetadata
}

export type PopupSerializableCapture =
  | PopupStructuredConversationCapture
  | PopupYouTubeTranscriptCapture

export interface PopupPageContext {
  url: string
  pageTitle: string
  title: string
  platform: Platform
  sourceLabel: string
  surfaceLabel: string
  supported: boolean
  captureActive: boolean
  captureReady: boolean
  captureMode?: PopupSerializableCapture["captureMode"]
  itemCount: number
  itemLabel: "messages" | "segments"
  status: PopupPageStatus
  statusLabel: string
  statusDetail: string
}

export interface PopupGetPageContextResponse {
  ok: true
  context: PopupPageContext
}

export interface PopupGetCaptureResponse {
  ok: boolean
  context: PopupPageContext
  capture: PopupSerializableCapture | null
  error?: string
}

export interface RecentCaptureRecord {
  id: string
  title: string
  source: string
  sourceUrl: string
  captureMode: PopupSerializableCapture["captureMode"]
  savedAt: string
}

interface BuildPageContextParams {
  url: string
  pageTitle?: string
  conversationTitle?: string
  capture: PopupSerializableCapture | null
  activeMessageCount?: number
  youtubeStatus?: PopupTranscriptStatus
  emptyStateMessage?: string
}

const stripKnownTitleSuffix = (title: string): string =>
  title
    .replace(/\s*[-|]\s*(ChatGPT|OpenAI|Claude|YouTube)\s*$/i, "")
    .trim()

const getSurfaceInfo = (
  platform: Platform,
  pathname: string
): {
  supported: boolean
  captureActive: boolean
  surfaceLabel: string
  idleTitle: string
  idleDetail: string
} => {
  if (platform === "chatgpt") {
    if (isChatGPTConversationSurface(pathname)) {
      return {
        supported: true,
        captureActive: true,
        surfaceLabel: "ChatGPT conversation",
        idleTitle: "ChatGPT conversation",
        idleDetail: "Waiting for ChatGPT to finish loading the conversation."
      }
    }

    return {
      supported: true,
      captureActive: false,
      surfaceLabel: "ChatGPT page",
      idleTitle: "Open a ChatGPT conversation",
      idleDetail: "Capture starts automatically once a conversation is open."
    }
  }

  if (platform === "claude") {
    if (isClaudeChatSurface(pathname)) {
      return {
        supported: true,
        captureActive: true,
        surfaceLabel: "Claude conversation",
        idleTitle: "Claude conversation",
        idleDetail: "Waiting for Claude to finish loading the conversation."
      }
    }

    return {
      supported: true,
      captureActive: false,
      surfaceLabel: "Claude page",
      idleTitle: "Open a Claude chat",
      idleDetail: "Capture starts automatically once a chat is open."
    }
  }

  if (platform === "youtube") {
    if (pathname.startsWith("/watch")) {
      return {
        supported: true,
        captureActive: true,
        surfaceLabel: "YouTube transcript",
        idleTitle: "YouTube transcript",
        idleDetail: "Looking for a transcript on this video."
      }
    }

    return {
      supported: true,
      captureActive: false,
      surfaceLabel: "YouTube page",
      idleTitle: "Open a YouTube video",
      idleDetail: "Transcript capture is available on watch pages."
    }
  }

  return {
    supported: false,
    captureActive: false,
    surfaceLabel: "Unsupported page",
    idleTitle: "This page isn’t supported",
    idleDetail: "Use ChatGPT, Claude, or a YouTube watch page with a transcript."
  }
}

export const buildFallbackPageContext = (
  url?: string | null,
  pageTitle?: string | null
): PopupPageContext => {
  if (!url) {
    return {
      url: "",
      pageTitle: pageTitle || "",
      title: "Current tab can’t be inspected",
      platform: "unknown",
      sourceLabel: "This tab",
      surfaceLabel: "Unavailable",
      supported: false,
      captureActive: false,
      captureReady: false,
      itemCount: 0,
      itemLabel: "messages",
      status: "unavailable",
      statusLabel: "Inspection unavailable",
      statusDetail: "Chrome restricts extension access on this tab."
    }
  }

  try {
    const parsedUrl = new URL(url)
    const platform = detectPlatformFromUrl(parsedUrl)
    const sourceLabel = getPlatformLabel(platform)
    const surfaceInfo = getSurfaceInfo(platform, parsedUrl.pathname)
    const cleanTitle = stripKnownTitleSuffix(pageTitle || "")

    return {
      url,
      pageTitle: pageTitle || "",
      title: cleanTitle || surfaceInfo.idleTitle,
      platform,
      sourceLabel,
      surfaceLabel: surfaceInfo.surfaceLabel,
      supported: surfaceInfo.supported,
      captureActive: surfaceInfo.captureActive,
      captureReady: false,
      itemCount: 0,
      itemLabel: platform === "youtube" ? "segments" : "messages",
      status: surfaceInfo.supported ? "waiting" : "unsupported",
      statusLabel: surfaceInfo.captureActive
        ? "Capture active"
        : surfaceInfo.supported
          ? "Supported source"
          : "Unsupported page",
      statusDetail: surfaceInfo.idleDetail
    }
  } catch {
    return {
      url,
      pageTitle: pageTitle || "",
      title: "Current tab can’t be inspected",
      platform: "unknown",
      sourceLabel: "This tab",
      surfaceLabel: "Unavailable",
      supported: false,
      captureActive: false,
      captureReady: false,
      itemCount: 0,
      itemLabel: "messages",
      status: "unavailable",
      statusLabel: "Inspection unavailable",
      statusDetail: "Chrome restricts extension access on this tab."
    }
  }
}

export const buildLivePageContext = ({
  url,
  pageTitle,
  conversationTitle,
  capture,
  activeMessageCount = 0,
  youtubeStatus = "idle",
  emptyStateMessage
}: BuildPageContextParams): PopupPageContext => {
  const fallback = buildFallbackPageContext(url, pageTitle)

  if (!fallback.supported) {
    return fallback
  }

  const cleanConversationTitle = stripKnownTitleSuffix(
    conversationTitle || pageTitle || ""
  )

  if (capture?.captureMode === "structured_conversation") {
    const messageCount = capture.messages.length || activeMessageCount
    return {
      ...fallback,
      title:
        stripKnownTitleSuffix(capture.title || cleanConversationTitle) ||
        fallback.title,
      captureReady: messageCount > 0,
      captureMode: "structured_conversation",
      itemCount: messageCount,
      itemLabel: "messages",
      status: messageCount > 0 ? "ready" : "waiting",
      statusLabel: messageCount > 0 ? "Ready to save" : "Capture active",
      statusDetail:
        messageCount > 0
          ? `${messageCount} message${messageCount === 1 ? "" : "s"} captured on this page.`
          : emptyStateMessage || fallback.statusDetail
    }
  }

  if (capture?.captureMode === "youtube_transcript") {
    const segmentCount = capture.segments.length
    return {
      ...fallback,
      title:
        stripKnownTitleSuffix(capture.videoTitle || cleanConversationTitle) ||
        fallback.title,
      captureReady: segmentCount > 0,
      captureMode: "youtube_transcript",
      itemCount: segmentCount,
      itemLabel: "segments",
      status: segmentCount > 0 ? "ready" : "waiting",
      statusLabel: segmentCount > 0 ? "Transcript ready" : "Capture active",
      statusDetail:
        segmentCount > 0
          ? `${segmentCount} transcript segment${segmentCount === 1 ? "" : "s"} are ready to save.`
          : emptyStateMessage || fallback.statusDetail
    }
  }

  if (fallback.platform === "youtube") {
    if (youtubeStatus === "loading" || youtubeStatus === "idle") {
      return {
        ...fallback,
        title: cleanConversationTitle || fallback.title,
        status: "waiting",
        statusLabel: "Fetching transcript",
        statusDetail: "Momentarily pulling the transcript from YouTube."
      }
    }

    if (youtubeStatus === "no_transcript") {
      return {
        ...fallback,
        title: cleanConversationTitle || fallback.title,
        status: "unavailable",
        statusLabel: "No transcript available",
        statusDetail:
          emptyStateMessage || "This video does not expose a transcript."
      }
    }

    if (youtubeStatus === "error") {
      return {
        ...fallback,
        title: cleanConversationTitle || fallback.title,
        status: "error",
        statusLabel: "Transcript unavailable",
        statusDetail: emptyStateMessage || "The transcript could not be loaded."
      }
    }
  }

  return {
    ...fallback,
    title: cleanConversationTitle || fallback.title,
    status: fallback.captureActive ? "waiting" : fallback.status,
    statusLabel: fallback.captureActive ? "Capture active" : fallback.statusLabel,
    statusDetail: emptyStateMessage || fallback.statusDetail
  }
}

export const serializePopupCapture = (
  capture: ExportCapture | null
): PopupSerializableCapture | null => {
  if (!capture) return null

  if (capture.captureMode === "structured_conversation") {
    return {
      captureMode: "structured_conversation",
      conversationKey: capture.conversationKey,
      title: capture.title,
      messages: capture.messages.map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        authorName: message.authorName
      })),
      metadata: capture.metadata
    }
  }

  if (capture.captureMode === "youtube_transcript") {
    return {
      captureMode: "youtube_transcript",
      conversationKey: capture.conversationKey,
      videoId: capture.videoId,
      videoTitle: capture.videoTitle,
      videoUrl: capture.videoUrl,
      segments: capture.segments,
      metadata: capture.metadata
    }
  }

  return null
}

export { deriveConversationIdFromUrl }
