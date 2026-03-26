import { useEffect, useMemo, useState } from "react"

import type { Message } from "~hooks/useMessageScanner/types"
import type { TranscriptStatus } from "~hooks/useYouTubeTranscript"
import type { ResolvedCaptureState } from "~lib/capture"
import {
  getCaptureSurface,
  isStructuredConversationSurface,
  isYouTubeWatchPage,
  resolveCaptureMode
} from "~lib/capture"
import { resolvePageMarkdownCapture } from "~lib/pageCapture"
import {
  requestRemotePageMarkdown,
  shouldAttemptRemotePageMarkdown
} from "~lib/remotePageMarkdown"
import type { TranscriptSegment } from "~lib/transcript-parser"
import { detectPlatform, getPlatformLabel } from "~utils/platform"

interface UseCaptureSourceParams {
  isOpen: boolean
  messages: Message[]
  conversationKey: string
  conversationTitle?: string
  youtubeSegments?: TranscriptSegment[]
  youtubeStatus?: TranscriptStatus
  youtubeTitle?: string
}

const STRUCTURED_EMPTY_STATE =
  "No messages found yet.\nOnce messages load, they'll appear here automatically."

const PAGE_EMPTY_STATE =
  "No meaningful page content was found.\nThis surface is using page markdown fallback."

const PAGE_LOADING_STATE =
  "Preparing page markdown...\nTrying the live page and hosted fallback."

export const useCaptureSource = ({
  isOpen,
  messages,
  conversationKey,
  conversationTitle,
  youtubeSegments,
  youtubeStatus,
  youtubeTitle
}: UseCaptureSourceParams): ResolvedCaptureState => {
  const platform = detectPlatform()
  const pathname = window.location.pathname
  const sourceUrl = window.location.href
  const pageTitle = document.title || conversationTitle || "Untitled page"
  const platformLabel = getPlatformLabel(platform)
  const surface = getCaptureSurface(platform, pathname)
  const structuredSurface = isStructuredConversationSurface(platform, pathname)
  const preferredCaptureMode = resolveCaptureMode({
    platform,
    pathname,
    hasStructuredMessages: messages.length > 0,
    hasPageMarkdown: true
  })
  const [pageCaptureState, setPageCaptureState] =
    useState<ResolvedCaptureState>({
      capture: null,
      emptyStateMessage: PAGE_EMPTY_STATE
    })

  const immediateState = useMemo<ResolvedCaptureState | null>(() => {
    const capturedAt = new Date().toISOString()

    if (isYouTubeWatchPage(platform, pathname)) {
      const videoId =
        new URLSearchParams(new URL(sourceUrl).search).get("v") ?? ""
      return {
        capture:
          youtubeStatus === "ready" &&
          youtubeSegments &&
          youtubeSegments.length > 0
            ? {
                captureMode: "youtube_transcript" as const,
                conversationKey,
                videoId,
                videoTitle: youtubeTitle || pageTitle,
                videoUrl: sourceUrl,
                segments: youtubeSegments,
                metadata: {
                  sourceUrl,
                  pageTitle,
                  capturedAt,
                  platform: platformLabel,
                  surface: "youtube_watch" as const
                }
              }
            : null,
        emptyStateMessage:
          youtubeStatus === "no_transcript"
            ? "This video doesn't have a transcript available."
            : youtubeStatus === "error"
              ? "Could not load transcript."
              : "Loading transcript..."
      }
    }

    if (preferredCaptureMode === "structured_conversation") {
      return {
        capture: {
          captureMode: "structured_conversation",
          conversationKey,
          title: conversationTitle,
          messages,
          metadata: {
            sourceUrl,
            pageTitle,
            capturedAt,
            platform: platformLabel,
            surface
          }
        },
        emptyStateMessage: STRUCTURED_EMPTY_STATE
      }
    }

    if (structuredSurface) {
      return {
        capture: null,
        emptyStateMessage: STRUCTURED_EMPTY_STATE
      }
    }

    if (!isOpen) {
      return {
        capture: null,
        emptyStateMessage: PAGE_EMPTY_STATE
      }
    }

    return null
  }, [
    conversationKey,
    conversationTitle,
    isOpen,
    messages,
    pageTitle,
    pathname,
    platform,
    platformLabel,
    preferredCaptureMode,
    sourceUrl,
    structuredSurface,
    surface,
    youtubeSegments,
    youtubeStatus,
    youtubeTitle
  ])

  useEffect(() => {
    if (immediateState) {
      return
    }

    let isCancelled = false
    const capturedAt = new Date().toISOString()
    const shouldUseRemoteFallback =
      surface === "generic_page" && shouldAttemptRemotePageMarkdown(sourceUrl)

    setPageCaptureState({
      capture: null,
      emptyStateMessage: PAGE_LOADING_STATE
    })

    void resolvePageMarkdownCapture({
      sourceDocument: document,
      sourceUrl,
      fallbackTitle: pageTitle,
      preferRemote: shouldUseRemoteFallback,
      remoteMarkdownLoader: shouldUseRemoteFallback
        ? requestRemotePageMarkdown
        : null,
      baseCapture: {
        captureMode: "page_markdown",
        conversationKey,
        metadata: {
          sourceUrl,
          pageTitle,
          capturedAt,
          platform: platformLabel,
          surface
        }
      }
    })
      .then((capture) => {
        if (isCancelled) return

        setPageCaptureState({
          capture,
          emptyStateMessage: PAGE_EMPTY_STATE
        })
      })
      .catch((error) => {
        if (isCancelled) return

        setPageCaptureState({
          capture: null,
          emptyStateMessage:
            error instanceof Error ? error.message : PAGE_EMPTY_STATE
        })
      })

    return () => {
      isCancelled = true
    }
  }, [
    conversationKey,
    immediateState,
    pageTitle,
    platformLabel,
    sourceUrl,
    surface
  ])

  return immediateState ?? pageCaptureState
}
