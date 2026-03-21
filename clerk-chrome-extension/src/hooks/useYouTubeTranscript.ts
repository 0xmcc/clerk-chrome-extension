import { useState, useEffect, useCallback } from "react"
import Defuddle from "defuddle"
import { cloneDocumentForExtraction, buildDefuddleOptions } from "~lib/pageCapture"
import { parseTranscriptMarkdown, type TranscriptSegment } from "~lib/transcript-parser"
import { detectPlatform } from "~utils/platform"

export type TranscriptStatus = "idle" | "loading" | "ready" | "error" | "no_transcript"

interface UseYouTubeTranscriptReturn {
  segments: TranscriptSegment[]
  status: TranscriptStatus
  errorMessage?: string
  videoTitle: string
}

export const useYouTubeTranscript = (): UseYouTubeTranscriptReturn => {
  const isYouTube =
    detectPlatform() === "youtube" && window.location.pathname.startsWith("/watch")

  // All hooks declared unconditionally (React hook ordering rule)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [status, setStatus] = useState<TranscriptStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [videoTitle, setVideoTitle] = useState("")

  const extract = useCallback(() => {
    if (!isYouTube) return
    setStatus("loading")
    try {
      const detached = cloneDocumentForExtraction(document)
      const result = new Defuddle(detached, buildDefuddleOptions(location.href)).parse()
      const title = result.title?.trim() || document.title
      setVideoTitle(title)
      const parsed = parseTranscriptMarkdown(result.contentMarkdown)
      if (parsed === null || parsed.length === 0) {
        setSegments([])
        setStatus("no_transcript")
      } else {
        setSegments(parsed)
        setStatus("ready")
      }
    } catch (err) {
      setSegments([])
      setStatus("error")
      setErrorMessage(err instanceof Error ? err.message : "Extraction failed")
    }
  }, [isYouTube])

  // Initial extraction
  useEffect(() => {
    if (!isYouTube) return
    extract()
  }, [isYouTube, extract])

  // SPA navigation detection
  useEffect(() => {
    if (!isYouTube) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const getVideoId = () => new URLSearchParams(window.location.search).get("v") ?? ""
    let lastVideoId = getVideoId()

    const handleNavigate = () => {
      const currentVideoId = getVideoId()
      const isWatchPage = window.location.pathname.startsWith("/watch")

      if (!isWatchPage) {
        setSegments([])
        setStatus("idle")
        lastVideoId = ""
        return
      }

      if (currentVideoId === lastVideoId) return

      lastVideoId = currentVideoId

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(extract, 500)
    }

    document.addEventListener("yt-navigate-finish", handleNavigate)

    return () => {
      document.removeEventListener("yt-navigate-finish", handleNavigate)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [isYouTube, extract])

  // Early return after all hooks
  if (!isYouTube) return { segments: [], status: "idle" as const, videoTitle: "" }

  return { segments, status, errorMessage, videoTitle }
}
