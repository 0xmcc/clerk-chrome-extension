import { useEffect, useState } from "react"

interface SettingsState {
  analysisSystemPrompt: string
  followupSystemPrompt: string
  personalContext: string
  aiEmail: string
  aiEmailFrom: string
  aiEmailProvider: string
  aiEmailApiKey: string
}

interface SettingsActions {
  setAnalysisSystemPrompt: (value: string) => void
  setFollowupSystemPrompt: (value: string) => void
  setPersonalContext: (value: string) => void
  setAiEmail: (value: string) => void
  setAiEmailFrom: (value: string) => void
  setAiEmailProvider: (value: string) => void
  setAiEmailApiKey: (value: string) => void
}

/**
 * Hook for managing settings state and persistence to chrome.storage.local.
 * Handles analysis prompts, personal context, and Send to My AI configuration.
 */
export const useSettingsStorage = (): SettingsState & SettingsActions => {
  const [analysisSystemPrompt, setAnalysisSystemPromptState] = useState("")
  const [followupSystemPrompt, setFollowupSystemPromptState] = useState("")
  const [personalContext, setPersonalContextState] = useState("")
  const [aiEmail, setAiEmailState] = useState("")
  const [aiEmailFrom, setAiEmailFromState] = useState("")
  const [aiEmailProvider, setAiEmailProviderState] = useState("agentmail")
  const [aiEmailApiKey, setAiEmailApiKeyState] = useState("")

  // Load from chrome.storage on mount
  useEffect(() => {
    chrome.storage.local.get(
      [
        "analysisSystemPrompt",
        "followupSystemPrompt",
        "personalContext",
        "aiEmail",
        "aiEmailFrom",
        "aiEmailProvider",
        "aiEmailApiKey"
      ],
      (result) => {
        if (result.analysisSystemPrompt)
          setAnalysisSystemPromptState(result.analysisSystemPrompt)
        if (result.followupSystemPrompt)
          setFollowupSystemPromptState(result.followupSystemPrompt)
        if (result.personalContext)
          setPersonalContextState(result.personalContext)
        if (result.aiEmail) setAiEmailState(result.aiEmail)
        if (result.aiEmailFrom) setAiEmailFromState(result.aiEmailFrom)
        if (result.aiEmailProvider)
          setAiEmailProviderState(result.aiEmailProvider)
        if (result.aiEmailApiKey) setAiEmailApiKeyState(result.aiEmailApiKey)
      }
    )
  }, [])

  const setAnalysisSystemPrompt = (value: string) => {
    setAnalysisSystemPromptState(value)
    chrome.storage.local.set({ analysisSystemPrompt: value })
  }

  const setFollowupSystemPrompt = (value: string) => {
    setFollowupSystemPromptState(value)
    chrome.storage.local.set({ followupSystemPrompt: value })
  }

  const setPersonalContext = (value: string) => {
    setPersonalContextState(value)
    chrome.storage.local.set({ personalContext: value })
  }

  const setAiEmail = (value: string) => {
    setAiEmailState(value)
    chrome.storage.local.set({ aiEmail: value })
  }

  const setAiEmailFrom = (value: string) => {
    setAiEmailFromState(value)
    chrome.storage.local.set({ aiEmailFrom: value })
  }

  const setAiEmailProvider = (value: string) => {
    setAiEmailProviderState(value)
    chrome.storage.local.set({ aiEmailProvider: value })
  }

  const setAiEmailApiKey = (value: string) => {
    setAiEmailApiKeyState(value)
    chrome.storage.local.set({ aiEmailApiKey: value })
  }

  return {
    analysisSystemPrompt,
    followupSystemPrompt,
    personalContext,
    setAnalysisSystemPrompt,
    setFollowupSystemPrompt,
    setPersonalContext,
    aiEmail,
    setAiEmail,
    aiEmailFrom,
    setAiEmailFrom,
    aiEmailProvider,
    setAiEmailProvider,
    aiEmailApiKey,
    setAiEmailApiKey
  }
}
