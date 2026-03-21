import type { Message } from "~hooks/useMessageScanner/types"
import type { Platform } from "~utils/platform"
import type { TranscriptSegment } from "~lib/transcript-parser"

export type CaptureMode = "structured_conversation" | "page_markdown" | "youtube_transcript"

export type CaptureSurface =
  | "chatgpt_conversation"
  | "claude_chat"
  | "chatgpt_page"
  | "claude_page"
  | "youtube_watch"
  | "generic_page"

export interface CaptureMetadata {
  sourceUrl: string
  pageTitle: string
  capturedAt: string
  platform: string
  surface: CaptureSurface
}

export interface StructuredConversationCapture {
  captureMode: "structured_conversation"
  conversationKey: string
  title?: string
  messages: Message[]
  metadata: CaptureMetadata
}

export interface PageMarkdownCapture {
  captureMode: "page_markdown"
  conversationKey: string
  title: string
  markdown: string
  metadata: CaptureMetadata
}

export interface YouTubeTranscriptCapture {
  captureMode: "youtube_transcript"
  conversationKey: string
  videoId: string
  videoTitle: string
  videoUrl: string
  segments: TranscriptSegment[]
  metadata: CaptureMetadata
}

export type ExportCapture = StructuredConversationCapture | PageMarkdownCapture | YouTubeTranscriptCapture

export interface ResolvedCaptureState {
  capture: ExportCapture | null
  emptyStateMessage: string
}

interface ResolveCaptureModeParams {
  platform: Platform
  pathname: string
  hasStructuredMessages: boolean
  hasPageMarkdown: boolean
}

export const isChatGPTConversationSurface = (pathname: string): boolean =>
  /^\/c\/[^/?#]+/.test(pathname)

export const isClaudeChatSurface = (pathname: string): boolean =>
  /^\/chat\/[^/?#]+/.test(pathname)

export const isStructuredConversationSurface = (
  platform: Platform,
  pathname: string
): boolean => {
  if (platform === "chatgpt") {
    return isChatGPTConversationSurface(pathname)
  }

  if (platform === "claude") {
    return isClaudeChatSurface(pathname)
  }

  return false
}

export const isYouTubeWatchPage = (platform: Platform, pathname: string): boolean =>
  platform === "youtube" && pathname.startsWith("/watch")

export const getCaptureSurface = (
  platform: Platform,
  pathname: string
): CaptureSurface => {
  if (platform === "chatgpt") {
    return isStructuredConversationSurface(platform, pathname)
      ? "chatgpt_conversation"
      : "chatgpt_page"
  }

  if (platform === "claude") {
    return isClaudeChatSurface(pathname) ? "claude_chat" : "claude_page"
  }

  if (platform === "youtube") return "youtube_watch"

  return "generic_page"
}

export const resolveCaptureMode = ({
  platform,
  pathname,
  hasStructuredMessages,
  hasPageMarkdown
}: ResolveCaptureModeParams): CaptureMode | null => {
  if (isStructuredConversationSurface(platform, pathname)) {
    return hasStructuredMessages ? "structured_conversation" : null
  }

  return hasPageMarkdown ? "page_markdown" : null
}
