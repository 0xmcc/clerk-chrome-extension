import { API_BASE_URL } from "~config/api"
import type { CreateYouTubeClipRequest, YouTubeClip } from "~lib/youtube-clip"
import { requestClerkToken } from "~utils/clerk"

type ApiErrorResponse = {
  error?: string
  message?: string
}

type YouTubeClipResponse = {
  job?: YouTubeClip
}

const buildBaseHeaders = (): HeadersInit => ({
  "Content-Type": "application/json"
})

const buildAuthHeaders = (token: string, headers?: HeadersInit): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  ...buildBaseHeaders(),
  ...(headers ?? {})
})

const readResponseError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as ApiErrorResponse
    return payload.error || payload.message || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

const fetchYouTubeClip = async (
  url: string,
  init: RequestInit
): Promise<YouTubeClip> => {
  const token = await requestClerkToken()
  const response = await fetch(url, {
    ...init,
    headers: buildAuthHeaders(token, init.headers)
  })

  if (!response.ok) {
    throw new Error(await readResponseError(response))
  }

  const payload = (await response.json()) as YouTubeClipResponse
  const clip = payload.job

  if (!clip?.id) {
    throw new Error("Failed to load YouTube clip.")
  }

  return clip
}

export const createYouTubeClip = async (
  payload: CreateYouTubeClipRequest
): Promise<YouTubeClip> =>
  fetchYouTubeClip(`${API_BASE_URL}/v1/youtube-clips`, {
    method: "POST",
    body: JSON.stringify(payload)
  })

export const getYouTubeClip = async (id: string): Promise<YouTubeClip> =>
  fetchYouTubeClip(`${API_BASE_URL}/v1/youtube-clips/${encodeURIComponent(id)}`, {
    method: "GET"
  })
