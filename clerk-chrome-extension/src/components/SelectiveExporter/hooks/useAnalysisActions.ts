import { useState, useCallback } from "react"

import type { Message } from "~hooks/useMessageScanner/types"
import { requestClerkToken } from "~utils/clerk"
import { API_BASE_URL } from "~config/api"

import type { ChatEntry, ExportState } from "../types"
import { DEFAULT_ANALYSIS_SYSTEM_PROMPT, DEFAULT_FOLLOWUP_SYSTEM_PROMPT } from "../constants"

interface UseAnalysisActionsParams {
  messages: Message[]
  analysisSystemPrompt: string
  followupSystemPrompt: string
  personalContext: string
  setExportState: (state: ExportState) => void
}

interface AnalysisActionsState {
  analysisMessages: ChatEntry[]
  analysisInput: string
  analyzeMode: boolean
}

interface AnalysisActions {
  runAnalysis: () => Promise<void>
  handleAnalysisSend: () => Promise<void>
  setAnalysisInput: (value: string) => void
  setAnalyzeMode: (value: boolean) => void
  setAnalysisMessages: React.Dispatch<React.SetStateAction<ChatEntry[]>>
  formatAnalysisText: (text: string) => string
  buildAnalysisSystemPrompt: () => string
  resetAnalysisState: () => void
}

/**
 * Hook for managing AI analysis: initial analysis and follow-up questions.
 */
export const useAnalysisActions = ({
  messages,
  analysisSystemPrompt,
  followupSystemPrompt,
  personalContext,
  setExportState
}: UseAnalysisActionsParams): AnalysisActionsState & AnalysisActions => {
  const [analysisMessages, setAnalysisMessages] = useState<ChatEntry[]>([])
  const [analysisInput, setAnalysisInput] = useState("")
  const [analyzeMode, setAnalyzeMode] = useState(false)

  const formatAnalysisText = useCallback((text: string) => {
    if (!text) return ""
    let formatted = text.trim()
    formatted = formatted.replace(/(^|\n)(#{1,6}\s+)/g, "\n\n$2") // headings on their own block
    formatted = formatted.replace(/(^|\n)([-*+]\s+)/g, "\n$2") // bullets
    formatted = formatted.replace(/(^|\n)(\d+\.\s+)/g, "\n$2") // numbered lists
    return formatted.trim()
  }, [])

  const buildAnalysisSystemPrompt = useCallback(() => {
    // Use custom prompt if available, otherwise use default
    let prompt = analysisSystemPrompt || DEFAULT_ANALYSIS_SYSTEM_PROMPT

    // Inject personal context if available
    if (personalContext && personalContext.trim() !== '{}' && personalContext.trim() !== '') {
      try {
        // Validate JSON
        JSON.parse(personalContext)
        prompt += `\n\n## Personal Context\nUse this context about the user when providing analysis:\n${personalContext}`
      } catch (e) {
        // Invalid JSON, skip injection
        console.warn('[SelectiveExporter] Invalid personal context JSON, skipping injection')
      }
    }

    return prompt
  }, [analysisSystemPrompt, personalContext])

  const runAnalysis = useCallback(async () => {
    try {
      setExportState("loading")
      setAnalyzeMode(true)

      // Get Clerk token
      const token = await requestClerkToken()

      // Build OpenRouter API payload
      const payload = {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildAnalysisSystemPrompt()
          },
          ...messages.map(msg => ({
            role: msg.role,
            content: msg.text
          }))
        ],
        temperature: 0.3,
        max_tokens: 1500
      }

      // Call backend OpenRouter endpoint
      const response = await fetch(`${API_BASE_URL}/v1/openrouter/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log("Full API Response:", JSON.stringify(data, null, 2))

      // Check if there's an error in the response
      if (data.status === 'error' || data.error) {
        throw new Error(data.error || 'API returned an error')
      }

      const analysis = data.data?.choices?.[0]?.message?.content

      if (!analysis) {
        console.error("No analysis found. Full data structure:", {
          hasData: !!data.data,
          dataKeys: data.data ? Object.keys(data.data) : null,
          hasChoices: !!data.data?.choices,
          choicesLength: data.data?.choices?.length,
          firstChoice: data.data?.choices?.[0],
          fullDataData: JSON.stringify(data.data, null, 2)
        })
        throw new Error("No analysis returned from API")
      }

      // Add analysis result to chat
      setAnalysisMessages([{
        id: `analysis-${Date.now()}`,
        role: "assistant",
        text: formatAnalysisText(analysis)
      }])

      setExportState("success")
    } catch (error) {
      console.error("Analysis failed:", error)
      setExportState("error")
      setAnalysisMessages([{
        id: `analysis-error-${Date.now()}`,
        role: "assistant",
        text: `Analysis failed: ${(error as Error).message}\n\nPlease make sure:\n- You're signed in to PromptMarket\n- The backend server is running at ${API_BASE_URL}\n- Messages have loaded in the exporter`
      }])
    }
  }, [messages, buildAnalysisSystemPrompt, formatAnalysisText, setExportState])

  const handleAnalysisSend = useCallback(async () => {
    const question = analysisInput.trim()
    if (!question) return

    // Clear input and add user question to chat immediately
    setAnalysisInput("")
    const userMsg: ChatEntry = {
      id: `analysis-user-${Date.now()}`,
      role: "user",
      text: question
    }
    setAnalysisMessages(prev => [...prev, userMsg])

    try {
      setExportState("loading")

      // Get Clerk token
      const token = await requestClerkToken()

      // Build conversation context with entire analysis history + new question
      let systemPrompt = followupSystemPrompt || DEFAULT_FOLLOWUP_SYSTEM_PROMPT

      // Inject personal context if available
      if (personalContext && personalContext.trim() !== '{}' && personalContext.trim() !== '') {
        try {
          JSON.parse(personalContext)
          systemPrompt += `\n\nPersonal Context:\n${personalContext}`
        } catch (e) {
          console.warn('[SelectiveExporter] Invalid personal context JSON in follow-up, skipping injection')
        }
      }

      const payload = {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...analysisMessages.map(msg => ({
            role: msg.role,
            content: msg.text
          })),
          {
            role: "user",
            content: question
          }
        ],
        temperature: 0.5,
        max_tokens: 800
      }

      const response = await fetch(`${API_BASE_URL}/v1/openrouter/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      const answer = data.data?.choices?.[0]?.message?.content

      if (!answer) throw new Error("No response from API")

      // Add assistant response to chat
      setAnalysisMessages(prev => [...prev, {
        id: `analysis-assistant-${Date.now()}`,
        role: "assistant",
        text: formatAnalysisText(answer)
      }])

      setExportState("success")
    } catch (error) {
      console.error("Follow-up question failed:", error)
      setExportState("error")
      setAnalysisMessages(prev => [...prev, {
        id: `analysis-error-${Date.now()}`,
        role: "assistant",
        text: `Error: ${(error as Error).message}`
      }])
    }
  }, [analysisInput, analysisMessages, followupSystemPrompt, personalContext, formatAnalysisText, setExportState])

  const resetAnalysisState = useCallback(() => {
    setAnalyzeMode(false)
    setAnalysisMessages([])
    setAnalysisInput("")
  }, [])

  return {
    analysisMessages,
    analysisInput,
    analyzeMode,
    runAnalysis,
    handleAnalysisSend,
    setAnalysisInput,
    setAnalyzeMode,
    setAnalysisMessages,
    formatAnalysisText,
    buildAnalysisSystemPrompt,
    resetAnalysisState
  }
}
