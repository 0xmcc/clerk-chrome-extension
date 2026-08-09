import { useCallback, useEffect, useMemo, useState } from "react"

import { API_BASE_URL } from "~config/api"
import {
  buildHumanSentimentUserPrompt,
  getHumanSentimentSourceKey,
  HUMAN_SENTIMENT_SYSTEM_PROMPT,
  NEUTRAL_HUMAN_SENTIMENT_POINT,
  parseHumanSentimentCompletion,
  type HumanSentimentPoint,
  type HumanSentimentSource,
  type HumanSentimentStatus
} from "~lib/humanSentiment"
import { requestClerkToken } from "~utils/clerk"

interface UseHumanSentimentTrajectoryParams {
  source: HumanSentimentSource | null
}

interface UseHumanSentimentTrajectoryReturn {
  status: HumanSentimentStatus
  points: HumanSentimentPoint[]
  errorMessage: string
  analyze: () => Promise<void>
  reset: () => void
}

const extractCompletionText = (data: unknown): string | null => {
  const response = data as {
    data?: {
      choices?: Array<{
        message?: {
          content?: unknown
        }
      }>
    }
    choices?: Array<{
      message?: {
        content?: unknown
      }
    }>
  }

  const content =
    response.data?.choices?.[0]?.message?.content ??
    response.choices?.[0]?.message?.content

  return typeof content === "string" ? content : null
}

export const useHumanSentimentTrajectory = ({
  source
}: UseHumanSentimentTrajectoryParams): UseHumanSentimentTrajectoryReturn => {
  const sourceKey = useMemo(() => getHumanSentimentSourceKey(source), [source])
  const [status, setStatus] = useState<HumanSentimentStatus>("idle")
  const [points, setPoints] = useState<HumanSentimentPoint[]>([
    { ...NEUTRAL_HUMAN_SENTIMENT_POINT }
  ])
  const [errorMessage, setErrorMessage] = useState("")

  const reset = useCallback(() => {
    setStatus("idle")
    setPoints([{ ...NEUTRAL_HUMAN_SENTIMENT_POINT }])
    setErrorMessage("")
  }, [])

  useEffect(() => {
    reset()
  }, [reset, sourceKey])

  const analyze = useCallback(async () => {
    if (!source) return

    setStatus("loading")
    setErrorMessage("")

    try {
      const token = await requestClerkToken()
      const payload = {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: HUMAN_SENTIMENT_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: buildHumanSentimentUserPrompt(source)
          }
        ],
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: "json_object" }
      }

      const response = await fetch(
        `${API_BASE_URL}/v1/openrouter/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      const completionText = extractCompletionText(data)

      if (!completionText) {
        throw new Error("No sentiment analysis returned from API.")
      }

      setPoints(parseHumanSentimentCompletion(completionText))
      setStatus("ready")
    } catch (error) {
      setStatus("error")
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to analyze human sentiment."
      )
    }
  }, [source, sourceKey])

  return {
    status,
    points,
    errorMessage,
    analyze,
    reset
  }
}
