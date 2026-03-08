import { useMemo } from "react"

import type { Message } from "~hooks/useMessageScanner/types"
import type { ResolvedCaptureState } from "~lib/capture"
import {
  getCaptureSurface,
  isStructuredConversationSurface,
  resolveCaptureMode
} from "~lib/capture"
import { extractPageMarkdownCapture } from "~lib/pageCapture"
import { getPlatformLabel, detectPlatform } from "~utils/platform"

interface UseCaptureSourceParams {
  isOpen: boolean
  messages: Message[]
  conversationKey: string
  conversationTitle?: string
}

const STRUCTURED_EMPTY_STATE =
  "No messages found yet.\nOnce messages load, they'll appear here automatically."

const PAGE_EMPTY_STATE =
  "No meaningful page content was found.\nThis surface is using page markdown fallback."

export const useCaptureSource = ({
  isOpen,
  messages,
  conversationKey,
  conversationTitle
}: UseCaptureSourceParams): ResolvedCaptureState => {
  const platform = detectPlatform()

  return useMemo(() => {
    const pathname = window.location.pathname
    const sourceUrl = window.location.href
    const pageTitle = document.title || conversationTitle || "Untitled page"
    const platformLabel = getPlatformLabel(platform)
    const capturedAt = new Date().toISOString()
    const surface = getCaptureSurface(platform, pathname)
    const structuredSurface = isStructuredConversationSurface(platform, pathname)
    const preferredCaptureMode = resolveCaptureMode({
      platform,
      pathname,
      hasStructuredMessages: messages.length > 0,
      hasPageMarkdown: true
    })

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

    try {
      return {
        capture: extractPageMarkdownCapture({
          sourceDocument: document,
          sourceUrl,
          fallbackTitle: pageTitle,
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
        }),
        emptyStateMessage: PAGE_EMPTY_STATE
      }
    } catch (error) {
      return {
        capture: null,
        emptyStateMessage:
          error instanceof Error ? error.message : PAGE_EMPTY_STATE
      }
    }
  }, [conversationKey, conversationTitle, isOpen, messages, platform])
}
