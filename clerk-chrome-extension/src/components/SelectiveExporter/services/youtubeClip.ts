import type {
  CreateYouTubeClipRequest,
  YouTubeClipJob
} from "~lib/youtube-clip"

type CreateYouTubeClipResponse = {
  success?: boolean
  clip?: YouTubeClipJob
  error?: string
}

type GetYouTubeClipStatusResponse = {
  success?: boolean
  clip?: YouTubeClipJob | null
  error?: string
}

export const createYouTubeClip = async (
  payload: CreateYouTubeClipRequest
): Promise<YouTubeClipJob> => {
  const result = (await chrome.runtime.sendMessage({
    action: "createYouTubeClip",
    payload
  })) as CreateYouTubeClipResponse

  if (!result?.success || !result.clip) {
    throw new Error(result?.error || "Failed to create YouTube clip.")
  }

  return result.clip
}

export const getYouTubeClipStatus = async (
  jobId: string
): Promise<YouTubeClipJob | null> => {
  const result = (await chrome.runtime.sendMessage({
    action: "getYouTubeClipStatus",
    jobId
  })) as GetYouTubeClipStatusResponse

  if (!result?.success) {
    throw new Error(result?.error || "Failed to load YouTube clip status.")
  }

  return result.clip ?? null
}
