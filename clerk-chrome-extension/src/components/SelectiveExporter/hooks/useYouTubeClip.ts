import { useCallback, useEffect, useRef, useState } from "react"

import type {
  CreateYouTubeClipRequest,
  YouTubeClip,
  YouTubeClipStatus
} from "~lib/youtube-clip"
import { isTerminalYouTubeClipStatus } from "~lib/youtube-clip"

import { createYouTubeClip, getYouTubeClip } from "../services/youtubeClip"

const POLL_INTERVAL_MS = 1500

export const useYouTubeClip = () => {
  const [status, setStatus] = useState<YouTubeClipStatus>("idle")
  const [clip, setClip] = useState<YouTubeClip | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const pollTimeoutRef = useRef<number | null>(null)
  const activeClipIdRef = useRef<string | null>(null)

  const clearPollTimeout = useCallback(() => {
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }, [])

  const stopPolling = useCallback(() => {
    clearPollTimeout()
    activeClipIdRef.current = null
  }, [clearPollTimeout])

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  const schedulePoll = useCallback(
    (clipId: string) => {
      clearPollTimeout()
      activeClipIdRef.current = clipId

      pollTimeoutRef.current = window.setTimeout(async () => {
        if (activeClipIdRef.current !== clipId) {
          return
        }

        try {
          const nextClip = await getYouTubeClip(clipId)
          if (activeClipIdRef.current !== clipId) {
            return
          }

          setClip(nextClip)
          setStatus(nextClip.status)

          if (nextClip.status === "failed") {
            console.error("[YouTubeClip] Job failed", {
              clipId,
              error: nextClip.error,
              errorDetails: nextClip.errorDetails ?? null
            })
            setErrorMessage(
              nextClip.error || "Failed to create YouTube clip."
            )
            stopPolling()
            return
          }

          if (nextClip.status === "completed") {
            setErrorMessage(undefined)
            stopPolling()
            return
          }

          schedulePoll(clipId)
        } catch (error) {
          if (activeClipIdRef.current !== clipId) {
            return
          }

          setStatus("failed")
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load YouTube clip."
          )
          stopPolling()
        }
      }, POLL_INTERVAL_MS)
    },
    [clearPollTimeout, stopPolling]
  )

  const reset = useCallback(() => {
    stopPolling()
    setStatus("idle")
    setClip(null)
    setErrorMessage(undefined)
  }, [stopPolling])

  const createClip = useCallback(
    async (request: CreateYouTubeClipRequest): Promise<boolean> => {
      stopPolling()
      setStatus("submitting")
      setClip(null)
      setErrorMessage(undefined)

      try {
        const createdClip = await createYouTubeClip(request)
        setClip(createdClip)
        setStatus(createdClip.status)

        if (createdClip.status === "failed") {
          console.error("[YouTubeClip] Job failed during submission", {
            clipId: createdClip.id,
            error: createdClip.error,
            errorDetails: createdClip.errorDetails ?? null
          })
          setErrorMessage(
            createdClip.error || "Failed to create YouTube clip."
          )
          return false
        }

        if (isTerminalYouTubeClipStatus(createdClip.status)) {
          return true
        }

        schedulePoll(createdClip.id)
        return true
      } catch (error) {
        setStatus("failed")
        setClip(null)
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to create YouTube clip."
        )
        return false
      }
    },
    [schedulePoll, stopPolling]
  )

  return {
    status,
    clip,
    errorMessage,
    createClip,
    reset
  }
}
