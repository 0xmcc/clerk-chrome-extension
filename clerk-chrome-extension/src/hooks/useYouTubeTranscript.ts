import { useState, useEffect, useCallback } from "react"
import {
  parseYtInitialPlayerResponse,
  getCaptionTrackUrl,
  parseYtTimedText,
  parseYtInitialData,
  getTranscriptContinuationParams,
  parseInnerTubeTranscriptResponse,
  extractTranscriptSegmentsFromDom
} from "~lib/youtube-transcript"
import type { TranscriptSegment } from "~lib/transcript-parser"
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

  const extract = useCallback(async () => {
    if (!isYouTube) return
    setStatus("loading")
    console.log("[transcript] extract start", window.location.href)
    try {
      const title = document.title
      setVideoTitle(title)

      const scriptCount = document.querySelectorAll("script").length
      console.log("[transcript] scanning", scriptCount, "script tags")

      // 1. Try InnerTube API first
      const ytInitialData = parseYtInitialData(document)
      console.log("[transcript] ytInitialData found:", !!ytInitialData)

      const innerTubeParams = ytInitialData
        ? getTranscriptContinuationParams(ytInitialData)
        : null
      console.log("[transcript] innerTubeParams found:", !!innerTubeParams)

      if (innerTubeParams) {
        try {
          const innerTubeResponse = await fetch(
            "https://www.youtube.com/youtubei/v1/get_transcript",
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-YouTube-Client-Name": "1",
                "X-YouTube-Client-Version": "2.20240101.00.00",
              },
              body: JSON.stringify({
                context: {
                  client: {
                    clientName: "WEB",
                    clientVersion: "2.20240101.00.00",
                    hl: "en",
                    gl: "US",
                  }
                },
                params: innerTubeParams
              })
            }
          )
          console.log("[transcript] InnerTube fetch →", innerTubeResponse.status)
          if (innerTubeResponse.ok) {
            const data = await innerTubeResponse.json()
            const parsed = parseInnerTubeTranscriptResponse(data)
            console.log("[transcript] InnerTube parsed", parsed.length, "segments")
            if (parsed.length > 0) {
              setSegments(parsed)
              setStatus("ready")
              return
            }
          }
        } catch (err) {
          console.error("[transcript] InnerTube ERROR:", err)
        }
      }

      // 2. Fall back to timedtext API
      const playerResponse = parseYtInitialPlayerResponse(document)
      if (!playerResponse) {
        console.error("[transcript] FAIL: ytInitialPlayerResponse not found in any script tag")
        setSegments([])
        setStatus("no_transcript")
        return
      }
      console.log("[transcript] playerResponse found, has captions key:", "captions" in playerResponse)

      const captionUrl = getCaptionTrackUrl(playerResponse)
      if (!captionUrl) {
        const tracks = (playerResponse as any)?.captions?.playerCaptionsTracklistRenderer?.captionTracks
        console.error("[transcript] FAIL: no captionUrl. captionTracks:", tracks)
        setSegments([])
        setStatus("no_transcript")
        return
      }
      console.log("[transcript] captionUrl:", captionUrl)

      const response = await fetch(captionUrl)
      console.log("[transcript] fetch →", response.status, response.ok ? "OK" : "FAIL",
        "content-type:", response.headers.get("content-type"),
        "content-length:", response.headers.get("content-length"))
      if (!response.ok) {
        throw new Error(`Transcript fetch failed: ${response.status}`)
      }

      const xml = await response.text()
      console.log("[transcript] xml length:", xml.length, "first 300 chars:", xml.slice(0, 300))
      const parsedXml = parseYtTimedText(xml)
      console.log("[transcript] parsed", parsedXml.length, "segments")

      const finalSegments =
        parsedXml.length > 0
          ? parsedXml
          : await extractTranscriptSegmentsFromDom(document)

      if (parsedXml.length === 0) {
        console.log("[transcript] DOM fallback parsed", finalSegments.length, "segments")
      }

      if (finalSegments.length === 0) {
        setSegments([])
        setStatus("no_transcript")
      } else {
        setSegments(finalSegments)
        setStatus("ready")
      }
    } catch (err) {
      console.error("[transcript] ERROR:", err)
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
