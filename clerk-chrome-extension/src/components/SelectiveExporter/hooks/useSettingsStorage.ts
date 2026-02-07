import { useEffect, useState } from "react"

interface SettingsState {
  analysisSystemPrompt: string
  followupSystemPrompt: string
  personalContext: string
  analysisLocked: boolean
  followupLocked: boolean
  aiEmail: string
  aiEmailFrom: string
  aiEmailProvider: string
  aiEmailApiKey: string
}

interface SettingsActions {
  setAnalysisSystemPrompt: (value: string) => void
  setFollowupSystemPrompt: (value: string) => void
  setPersonalContext: (value: string) => void
  toggleAnalysisLock: () => void
  toggleFollowupLock: () => void
  setAiEmail: (value: string) => void
  setAiEmailFrom: (value: string) => void
  setAiEmailProvider: (value: string) => void
  setAiEmailApiKey: (value: string) => void
}

/**
 * Hook for managing settings state and persistence to chrome.storage.local.
 * Handles: analysisSystemPrompt, followupSystemPrompt, personalContext, lock toggles.
 */
export const useSettingsStorage = (): SettingsState & SettingsActions => {
  const [analysisSystemPrompt, setAnalysisSystemPromptState] = useState("")
  const [followupSystemPrompt, setFollowupSystemPromptState] = useState("")
  const [personalContext, setPersonalContextState] = useState("")
  const [analysisLocked, setAnalysisLocked] = useState(true)
  const [followupLocked, setFollowupLocked] = useState(true)
  const [aiEmail, setAiEmailState] = useState("")
  const [aiEmailFrom, setAiEmailFromState] = useState("")
  const [aiEmailProvider, setAiEmailProviderState] = useState("agentmail")
  const [aiEmailApiKey, setAiEmailApiKeyState] = useState("")

  // Load from chrome.storage on mount
  useEffect(() => {
    chrome.storage.local.get(['analysisSystemPrompt', 'followupSystemPrompt', 'personalContext', 'aiEmail', 'aiEmailFrom', 'aiEmailProvider', 'aiEmailApiKey'], (result) => {
      if (result.analysisSystemPrompt) setAnalysisSystemPromptState(result.analysisSystemPrompt)
      if (result.followupSystemPrompt) setFollowupSystemPromptState(result.followupSystemPrompt)
      if (result.personalContext) setPersonalContextState(result.personalContext)
      if (result.aiEmail) setAiEmailState(result.aiEmail)
      if (result.aiEmailFrom) setAiEmailFromState(result.aiEmailFrom)
      if (result.aiEmailProvider) setAiEmailProviderState(result.aiEmailProvider)
      if (result.aiEmailApiKey) setAiEmailApiKeyState(result.aiEmailApiKey)
    })
    // Default to locked
    setAnalysisLocked(true)
    setFollowupLocked(true)
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

  const toggleAnalysisLock = () => {
    setAnalysisLocked((prev) => !prev)
  }

  const toggleFollowupLock = () => {
    setFollowupLocked((prev) => !prev)
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
    analysisLocked,
    followupLocked,
    setAnalysisSystemPrompt,
    setFollowupSystemPrompt,
    setPersonalContext,
    toggleAnalysisLock,
    toggleFollowupLock,
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
