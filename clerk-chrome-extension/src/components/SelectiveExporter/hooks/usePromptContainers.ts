import { useState, useEffect, useCallback } from "react"

import type { Message } from "~hooks/useMessageScanner/types"

import type { PromptContainer, ChatEntry } from "../types"

const STORAGE_KEY = "linkedinPromptContainers"

const DEFAULT_CONTAINER: PromptContainer = {
  id: "default-linkedin-1",
  name: "Friendly follow-up",
  systemPrompt: "Be concise, warm, and include a clear next step. Keep it to 3 sentences max.",
  profileJson: JSON.stringify({ tone: "friendly", cta: "Ask for a short call", signoff: "Thanks!" }, null, 2),
  suggestion: "",
  status: "idle"
}

interface UsePromptContainersParams {
  messages: Message[]
}

interface UsePromptContainersReturn {
  promptContainers: PromptContainer[]
  chatEntries: ChatEntry[]
  replyNote: string
  selectedPromptId: string | undefined
  setReplyNote: (value: string) => void
  handleSuggest: (id: string, opts?: { copy?: boolean }) => void
  handleAddChatMessage: () => void
  resetContainers: () => void
}

/**
 * Hook for managing LinkedIn prompt containers and chat entries.
 * Handles persistence, suggestion building, and chat message state.
 */
export const usePromptContainers = ({
  messages
}: UsePromptContainersParams): UsePromptContainersReturn => {
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([])
  const [replyNote, setReplyNote] = useState("")
  const [promptContainers, setPromptContainers] = useState<PromptContainer[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c) => ({
            ...c,
            suggestion: "",
            status: "idle" as const,
            error: ""
          }))
        }
      } catch (err) {
        console.warn("[usePromptContainers] Failed to parse stored prompt containers", err)
      }
    }
    return [DEFAULT_CONTAINER]
  })

  // Persist prompt containers
  useEffect(() => {
    try {
      const toPersist = promptContainers.map(({ id, name, systemPrompt, profileJson }) => ({
        id,
        name,
        systemPrompt,
        profileJson,
        suggestion: ""
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist))
    } catch (err) {
      console.warn("[usePromptContainers] Failed to persist prompt containers", err)
    }
  }, [promptContainers])

  const updateContainer = useCallback((id: string, changes: Partial<PromptContainer>) => {
    setPromptContainers((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)))
  }, [])

  const buildSuggestion = useCallback((container: PromptContainer): string => {
    let profile: Record<string, unknown> = {}
    try {
      profile = JSON.parse(container.profileJson || "{}")
    } catch (err) {
      throw new Error("Profile JSON is invalid")
    }

    const lastInbound =
      [...messages].reverse().find((m) => m.role !== "user") || messages[messages.length - 1] || null
    const contactName = lastInbound?.authorName || (profile.contactName as string) || "there"
    const lastLine = lastInbound?.text ? lastInbound.text.slice(0, 400) : ""
    const tone = profile.tone ? `Tone: ${profile.tone}. ` : ""
    const signoff = profile.signoff ? ` ${profile.signoff}` : ""
    const cta = profile.cta ? ` ${profile.cta}` : ""

    const base =
      container.systemPrompt.trim() ||
      "Craft a concise, helpful reply for LinkedIn. Keep it respectful and specific."

    const context = lastLine ? `Context: "${lastLine}"` : "No recent message content available."
    const userMessages = chatEntries.filter((c) => c.role === "user" && c.text.trim())
    const userNoteBlock =
      userMessages.length > 0
        ? `User messages:\n${userMessages.map((m) => `- ${m.text}`).join("\n")}\n`
        : ""
    const freeNote = replyNote ? `User note: ${replyNote}\n` : ""

    return `${base}\n\n${tone}${context}\n${userNoteBlock}${freeNote}\nSuggested reply:\nHi ${contactName}, thanks for reaching out.${cta}${signoff}`.trim()
  }, [messages, chatEntries, replyNote])

  const handleSuggest = useCallback((id: string, opts?: { copy?: boolean }) => {
    const container = promptContainers.find((c) => c.id === id)
    if (!container) return
    updateContainer(id, { status: "loading", error: "" })

    try {
      const suggestion = buildSuggestion(container)
      updateContainer(id, { suggestion, status: "ready" })
      if (opts?.copy) {
        navigator.clipboard
          .writeText(suggestion)
          .then(() => console.log("[usePromptContainers] Suggestion copied to clipboard"))
          .catch((err) => console.warn("[usePromptContainers] Failed to copy suggestion", err))
      }
      setChatEntries((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: suggestion
        }
      ])
    } catch (err) {
      updateContainer(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Failed to build suggestion"
      })
    }
  }, [promptContainers, buildSuggestion, updateContainer])

  const handleAddChatMessage = useCallback(() => {
    const text = replyNote.trim()
    if (!text) return
    setChatEntries((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text
      }
    ])
    setReplyNote("")
  }, [replyNote])

  const resetContainers = useCallback(() => {
    setChatEntries([])
    setReplyNote("")
    setPromptContainers((prev) =>
      prev.map((c) => ({
        ...c,
        suggestion: "",
        status: "idle",
        error: ""
      }))
    )
  }, [])

  const selectedPromptId = promptContainers[0]?.id

  return {
    promptContainers,
    chatEntries,
    replyNote,
    selectedPromptId,
    setReplyNote,
    handleSuggest,
    handleAddChatMessage,
    resetContainers
  }
}
