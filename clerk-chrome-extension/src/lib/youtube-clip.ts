import type { TranscriptSegment } from "./transcript-parser"
import { formatTimestamp } from "./transcript-parser"

export interface CreateYouTubeClipRequest {
  videoUrl: string
  startSeconds: number
  endSeconds: number
}

export type YouTubeClipJobStatus = "creating" | "success" | "error"

export interface YouTubeClipJob {
  id: string
  status: YouTubeClipJobStatus
  command: string | null
  createdAt: string
  error?: string
}

export const getClipEndSeconds = (
  segments: TranscriptSegment[],
  endIdx: number
): number => {
  const nextSegment = segments[endIdx + 1]
  return nextSegment ? nextSegment.seconds : segments[endIdx].seconds + 5
}

export const buildYouTubeClipCommand = ({
  videoUrl,
  startSeconds,
  endSeconds
}: CreateYouTubeClipRequest): string =>
  `yt-dlp --merge-output-format mp4 --remux-video mp4 -S vcodec:h264,lang,quality,res,fps,hdr:12,acodec:aac --download-sections "*${formatTimestamp(startSeconds)}-${formatTimestamp(endSeconds)}" "${videoUrl}"`
