import type { TranscriptSegment } from "./transcript-parser"

export interface CreateYouTubeClipRequest {
  videoUrl: string
  startSeconds: number
  endSeconds: number
  videoId: string
  title: string
  source: "chrome_extension"
}

export type YouTubeClipJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"

export type YouTubeClipStatus = "idle" | "submitting" | YouTubeClipJobStatus

export interface YouTubeClipErrorDetails {
  phase?: string | null
  phaseLabel?: string | null
  message?: string | null
  stack?: string | null
  code?: string | number | null
  signal?: string | null
  stdout?: string | null
  stderr?: string | null
  failedAt?: string | null
  cause?: Record<string, unknown> | null
  [key: string]: unknown
}

export interface YouTubeClip {
  id: string
  status: YouTubeClipJobStatus
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
  progress?: number | null
  downloadUrl?: string | null
  previewUrl?: string | null
  durationSeconds?: number | null
  error?: string | null
  errorDetails?: YouTubeClipErrorDetails | null
}

export const getClipEndSeconds = (
  segments: TranscriptSegment[],
  endIdx: number
): number => {
  const nextSegment = segments[endIdx + 1]
  return nextSegment ? nextSegment.seconds : segments[endIdx].seconds + 5
}

export const getYouTubeClipDownloadUrl = (clip: YouTubeClip): string | null =>
  clip.downloadUrl ?? null

export const isTerminalYouTubeClipStatus = (
  status: YouTubeClipStatus
): status is "completed" | "failed" =>
  status === "completed" || status === "failed"
