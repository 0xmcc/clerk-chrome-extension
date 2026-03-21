import { useState, useEffect, useCallback } from "react"
import { INTERCEPTOR_READY_SIGNAL } from "~config/interceptor"
import {
  getCaptionTrackUrl,
  extractTranscriptSegmentsFromDom,
  parseTranscriptSegmentsFromDom,
  parseYtInitialPlayerResponse,
  parseYtTimedText,
  waitForYouTubeTranscriptResponse
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

const TRANSCRIPT_WAIT_TIMEOUT_MS = 5000
const DOM_POLL_DELAY_MS = 250
const DOM_POLL_ATTEMPTS = Math.ceil(
  TRANSCRIPT_WAIT_TIMEOUT_MS / DOM_POLL_DELAY_MS
)
const RECOVERABLE_STATUSES: TranscriptStatus[] = ["loading", "no_transcript"]

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
    setSegments([])
    setErrorMessage(undefined)
    console.log("[transcript] extract start", window.location.href)

    try {
      const title = document.title
      setVideoTitle(title)

      const interceptedTranscriptPromise = waitForYouTubeTranscriptResponse({
        timeoutMs: TRANSCRIPT_WAIT_TIMEOUT_MS
      })

      // Ask the interceptor to flush any queued MAIN-world events after our
      // listener is attached, then drive the page to make its own request.
      window.postMessage(INTERCEPTOR_READY_SIGNAL, "*")

      const domTranscriptPromise = extractTranscriptSegmentsFromDom(document, {
        maxAttempts: DOM_POLL_ATTEMPTS,
        delayMs: DOM_POLL_DELAY_MS
      })

      const pageManagedSegments = await Promise.any([
        interceptedTranscriptPromise.then((resolvedSegments) =>
          resolvedSegments.length > 0
            ? resolvedSegments
            : Promise.reject(new Error("No intercepted transcript response"))
        ),
        domTranscriptPromise.then((resolvedSegments) =>
          resolvedSegments.length > 0
            ? resolvedSegments
            : Promise.reject(new Error("No transcript segments rendered in DOM"))
        )
      ]).catch(() => [] as TranscriptSegment[])

      if (pageManagedSegments.length > 0) {
        console.log(
          "[transcript] resolved from page-managed path",
          pageManagedSegments.length,
          "segments"
        )
        setSegments(pageManagedSegments)
        setStatus("ready")
        return
      }

      // Fall back to legacy timedtext as a best-effort path for cases where the
      // page did not emit a capturable transcript response.
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

      if (parsedXml.length === 0) {
        setSegments([])
        setStatus("no_transcript")
      } else {
        setSegments(parsedXml)
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

  // Recover when transcript rows hydrate after the initial extraction has
  // already settled to an empty result. YouTube frequently renders transcript
  // rows lazily after the panel is opened.
  useEffect(() => {
    if (!isYouTube) return
    if (!RECOVERABLE_STATUSES.includes(status)) return
    if (segments.length > 0) return
    if (typeof MutationObserver === "undefined") return

    let active = true
    let parseQueued = false

    const tryRecoverFromDom = () => {
      if (!active) return

      const parsed = parseTranscriptSegmentsFromDom(document)
      if (parsed.length === 0) return

      console.log("[transcript] recovered from late DOM hydration", parsed.length)
      setSegments(parsed)
      setStatus("ready")
      setErrorMessage(undefined)
    }

    const scheduleParse = () => {
      if (parseQueued || !active) return
      parseQueued = true
      Promise.resolve().then(() => {
        parseQueued = false
        tryRecoverFromDom()
      })
    }

    scheduleParse()

    const observer = new MutationObserver(() => {
      scheduleParse()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => {
      active = false
      observer.disconnect()
    }
  }, [isYouTube, segments.length, status])

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
        setErrorMessage(undefined)
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
