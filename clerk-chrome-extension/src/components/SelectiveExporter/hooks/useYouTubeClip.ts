import { useCallback, useEffect, useRef, useState } from "react"

import {
  buildYouTubeClipCommand,
  type CreateYouTubeClipRequest,
  type YouTubeClipJob
} from "~lib/youtube-clip"

import { createYouTubeClip } from "../services/youtubeClip"

type UseYouTubeClipStatus = "idle" | "creating" | "success" | "error"

const SUCCESS_RESET_DELAY_MS = 2000

export const useYouTubeClip = () => {
  const [status, setStatus] = useState<UseYouTubeClipStatus>("idle")
  const [clip, setClip] = useState<YouTubeClipJob | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const successTimeoutRef = useRef<number | null>(null)

  const clearSuccessTimeout = useCallback(() => {
    if (successTimeoutRef.current !== null) {
      window.clearTimeout(successTimeoutRef.current)
      successTimeoutRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearSuccessTimeout()
    setStatus("idle")
    setClip(null)
    setErrorMessage(undefined)
  }, [clearSuccessTimeout])

  useEffect(() => {
    return () => {
      clearSuccessTimeout()
    }
  }, [clearSuccessTimeout])

  const createClip = useCallback(
    async (request: CreateYouTubeClipRequest): Promise<boolean> => {
      if (!navigator.clipboard?.writeText) {
        setStatus("error")
        setClip(null)
        setErrorMessage("Clipboard is unavailable in this browser context.")
        return false
      }

      clearSuccessTimeout()
      setStatus("creating")
      setClip(null)
      setErrorMessage(undefined)

      try {
        await navigator.clipboard.writeText(buildYouTubeClipCommand(request))

        const createdClip = await createYouTubeClip(request)

        if (createdClip.status === "error") {
          setStatus("error")
          setClip(createdClip)
          setErrorMessage(
            createdClip.error || "Failed to create YouTube clip."
          )
          return false
        }

        setStatus("success")
        setClip(createdClip)
        successTimeoutRef.current = window.setTimeout(() => {
          setStatus("idle")
          successTimeoutRef.current = null
        }, SUCCESS_RESET_DELAY_MS)
        return true
      } catch (error) {
        setStatus("error")
        setClip(null)
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to create YouTube clip."
        )
        return false
      }
    },
    [clearSuccessTimeout]
  )

  return {
    status,
    clip,
    errorMessage,
    createClip,
    reset
  }
}
