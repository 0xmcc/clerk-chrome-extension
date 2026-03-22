import { formatTimestamp } from "~lib/transcript-parser"
import {
  getClipEndSeconds,
  getYouTubeClipDownloadUrl
} from "~lib/youtube-clip"
import { useEffect, useState, type ReactNode } from "react"

import { useYouTubeClip } from "../hooks/useYouTubeClip"
import { DARK_THEME } from "../constants"
import type { YouTubeTranscriptViewProps } from "../types"

const CLIP_BAR_PADDING_BOTTOM = "72px"

export const YouTubeTranscriptView = ({
  segments,
  status,
  errorMessage,
  videoId,
  videoTitle,
  videoUrl
}: YouTubeTranscriptViewProps) => {
  const [clipStartIdx, setClipStartIdx] = useState<number | null>(null)
  const [clipEndIdx, setClipEndIdx] = useState<number | null>(null)
  const {
    status: clipStatus,
    clip,
    errorMessage: clipErrorMessage,
    createClip,
    reset: resetClip
  } = useYouTubeClip()

  const resetSelection = () => {
    setClipStartIdx(null)
    setClipEndIdx(null)
    resetClip()
  }

  const transcriptKey = segments
    .map((segment) => `${segment.seconds}:${segment.text}:${segment.section ?? ""}`)
    .join("\n")

  useEffect(() => {
    resetSelection()
  }, [resetClip, status, transcriptKey, videoUrl])

  if (status === "idle") return null

  if (status === "loading") {
    return (
      <div style={{ padding: "8px 0" }}>
        <style>{`
          @keyframes yt-skeleton-shimmer {
            0% { opacity: 0.4; }
            50% { opacity: 0.8; }
            100% { opacity: 0.4; }
          }
        `}</style>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "12px",
              padding: "8px 0",
              animation: "yt-skeleton-shimmer 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.1}s`
            }}>
            <div
              style={{
                width: "40px",
                height: "14px",
                background: DARK_THEME.border,
                borderRadius: "4px",
                flexShrink: 0
              }}
            />
            <div
              style={{
                flex: 1,
                height: "14px",
                background: DARK_THEME.border,
                borderRadius: "4px"
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  if (status === "error") {
    return (
      <div
        style={{
          padding: "24px 16px",
          textAlign: "center",
          color: DARK_THEME.muted
        }}>
        {errorMessage || "Could not load transcript."}
      </div>
    )
  }

  if (status === "no_transcript") {
    return (
      <div
        style={{
          padding: "24px 16px",
          textAlign: "center",
          color: DARK_THEME.muted
        }}>
        {"This video doesn't have a transcript available."}
      </div>
    )
  }

  let prevSection: string | undefined = undefined
  const hasRange = clipStartIdx !== null && clipEndIdx !== null
  const clipStartSegment =
    clipStartIdx !== null ? (segments[clipStartIdx] ?? null) : null
  const clipEndSegment = clipEndIdx !== null ? (segments[clipEndIdx] ?? null) : null
  const clipStartSeconds =
    hasRange && clipStartSegment ? clipStartSegment.seconds : null
  const clipEndSeconds =
    hasRange && clipEndSegment && clipEndIdx !== null
      ? getClipEndSeconds(segments, clipEndIdx)
      : null
  const clipDurationSeconds =
    clipStartSeconds !== null && clipEndSeconds !== null
      ? clipEndSeconds - clipStartSeconds
      : null
  const clipDownloadUrl =
    clipStatus === "completed" && clip ? getYouTubeClipDownloadUrl(clip) : null
  const showClipBar = Boolean(
    hasRange &&
      videoUrl &&
      clipStartSeconds !== null &&
      clipEndSeconds !== null &&
      clipDurationSeconds !== null
  )

  const handleSegmentClick = (index: number) => {
    if (index === clipStartIdx || index === clipEndIdx) {
      resetSelection()
      return
    }

    resetClip()

    if (clipStartIdx === null || clipEndIdx !== null) {
      setClipStartIdx(index)
      setClipEndIdx(null)
      return
    }

    const [start, end] = [clipStartIdx, index].sort((a, b) => a - b)
    setClipStartIdx(start)
    setClipEndIdx(end)
  }

  const handleCreateClip = async () => {
    if (
      !videoUrl ||
      !videoId ||
      !videoTitle ||
      clipStartSeconds === null ||
      clipEndSeconds === null
    ) {
      return
    }

    await createClip({
      videoUrl,
      startSeconds: clipStartSeconds,
      endSeconds: clipEndSeconds,
      videoId,
      title: videoTitle,
      source: "chrome_extension"
    })
  }

  const handleDownloadClip = () => {
    if (!clipDownloadUrl) {
      return
    }

    window.open(clipDownloadUrl, "_blank", "noopener,noreferrer")
  }

  const isIndexSelected = (index: number) => {
    if (clipStartIdx === null) return false
    if (clipEndIdx === null) return index === clipStartIdx
    return index >= clipStartIdx && index <= clipEndIdx
  }

  const isSubmitting = clipStatus === "submitting"
  const isPolling = clipStatus === "queued" || clipStatus === "processing"
  const isActionDisabled =
    isSubmitting || isPolling || (clipStatus === "completed" && !clipDownloadUrl)
  const actionLabel =
    clipStatus === "submitting"
      ? "Submitting..."
      : clipStatus === "queued"
        ? "Queued..."
        : clipStatus === "processing"
          ? typeof clip?.progress === "number"
            ? `Processing ${clip.progress}%...`
            : "Processing..."
          : clipStatus === "completed"
            ? "Download clip"
            : clipStatus === "failed"
              ? "Retry clip"
              : "Create clip"

  return (
    <div style={{ padding: "8px 0" }}>
      <div
        data-testid="yt-transcript-segment-list"
        style={{
          paddingBottom: showClipBar ? CLIP_BAR_PADDING_BOTTOM : 0
        }}>
        {segments.map((segment, index) => {
          const elements: ReactNode[] = []
          const isSelected = isIndexSelected(index)

          if (segment.section && segment.section !== prevSection) {
            const isFirst = prevSection === undefined
            elements.push(
              <div
                key={`section-${index}`}
                style={{
                  padding: isFirst ? "12px 0 4px" : "12px 0 4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: DARK_THEME.textSecondary,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.5px",
                  ...(isFirst
                    ? {}
                    : {
                        borderTop: `1px solid ${DARK_THEME.border}`,
                        marginTop: "8px",
                        paddingTop: "12px"
                      })
                }}>
                {segment.section}
              </div>
            )
          }

          prevSection = segment.section

          elements.push(
            <button
              key={index}
              type="button"
              onClick={() => handleSegmentClick(index)}
              style={{
                width: "100%",
                display: "flex",
                gap: "12px",
                padding: "6px 8px",
                alignItems: "baseline",
                borderRadius: "10px",
                border: `1px solid ${isSelected ? DARK_THEME.accent : "transparent"}`,
                backgroundColor: isSelected ? DARK_THEME.accentBg : "transparent",
                color: DARK_THEME.text,
                cursor: "pointer",
                textAlign: "left" as const,
                transition: "background-color 120ms ease, border-color 120ms ease"
              }}>
              <span
                style={{
                  flexShrink: 0,
                  width: "40px",
                  fontSize: "12px",
                  color: DARK_THEME.muted,
                  fontFamily: "monospace",
                  textAlign: "right" as const
                }}>
                {formatTimestamp(segment.seconds)}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  color: DARK_THEME.text,
                  lineHeight: "1.5"
                }}>
                {segment.text}
              </span>
            </button>
          )

          return elements
        })}
      </div>

      {showClipBar ? (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            marginTop: "-56px",
            paddingTop: "56px",
            pointerEvents: "none"
          }}>
          <div
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              padding: "12px",
              borderRadius: "12px",
              backgroundColor: DARK_THEME.surface,
              border: `1px solid ${DARK_THEME.borderStrong}`,
              boxShadow: DARK_THEME.glow
            }}>
            <span
              style={{
                fontSize: "12px",
                color: DARK_THEME.textSecondary
              }}>
              {formatTimestamp(clipStartSeconds)} - {formatTimestamp(clipEndSeconds)} (
              {clipDurationSeconds}s)
            </span>
            <button
              type="button"
              onClick={clipStatus === "completed" ? handleDownloadClip : handleCreateClip}
              disabled={isActionDisabled}
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                border: `1px solid ${
                  clipStatus === "completed"
                    ? DARK_THEME.success
                    : clipStatus === "failed"
                      ? DARK_THEME.danger
                      : clipStatus === "queued" || clipStatus === "processing"
                        ? DARK_THEME.warning
                        : DARK_THEME.accent
                }`,
                backgroundColor:
                  clipStatus === "completed"
                    ? "rgba(74, 222, 128, 0.12)"
                    : clipStatus === "failed"
                      ? "rgba(239, 68, 68, 0.12)"
                      : clipStatus === "queued" || clipStatus === "processing"
                        ? "rgba(251, 191, 36, 0.12)"
                        : DARK_THEME.accentBg,
                color:
                  clipStatus === "completed"
                    ? DARK_THEME.success
                    : clipStatus === "failed"
                      ? DARK_THEME.danger
                      : clipStatus === "queued" || clipStatus === "processing"
                        ? DARK_THEME.warning
                        : DARK_THEME.text,
                cursor: isActionDisabled ? "wait" : "pointer",
                opacity: isActionDisabled ? 0.8 : 1,
                fontSize: "12px",
                fontWeight: 600
              }}>
              {actionLabel}
            </button>
            {clipErrorMessage ? (
              <span
                role="alert"
                style={{
                  flexBasis: "100%",
                  fontSize: "12px",
                  color: DARK_THEME.danger
                }}>
                {clipErrorMessage}
              </span>
            ) : clipStatus === "completed" ? (
              <span
                style={{
                  flexBasis: "100%",
                  fontSize: "12px",
                  color: DARK_THEME.success
                }}>
                Clip ready.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
