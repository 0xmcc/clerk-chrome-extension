import type { TranscriptSegment } from "~lib/transcript-parser"
import type { TranscriptStatus } from "~hooks/useYouTubeTranscript"
import { formatTimestamp } from "~lib/transcript-parser"
import { DARK_THEME } from "../constants"

interface YouTubeTranscriptViewProps {
  segments: TranscriptSegment[]
  status: TranscriptStatus
  errorMessage?: string
}

export const YouTubeTranscriptView = ({
  segments,
  status,
  errorMessage
}: YouTubeTranscriptViewProps) => {
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

  // status === "ready"
  let prevSection: string | undefined = undefined

  return (
    <div style={{ padding: "8px 0" }}>
      {segments.map((segment, index) => {
        const elements: React.ReactNode[] = []

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
          <div
            key={index}
            style={{
              display: "flex",
              gap: "12px",
              padding: "4px 0",
              alignItems: "baseline"
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
          </div>
        )

        return elements
      })}
    </div>
  )
}
