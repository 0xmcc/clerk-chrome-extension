import { useState, useCallback } from "react"

import type { Message } from "~hooks/useMessageScanner/types"
import { requestClerkToken } from "~utils/clerk"
import { deriveConversationId, sanitizeFilename } from "~utils/conversation"
import { API_BASE_URL } from "~config/api"

import type { ExportState, HistoryFormat } from "../types"

interface UseExportActionsParams {
  messages: Message[]
  historyFormat: HistoryFormat
  platformLabel: string
  conversationTitle?: string
}

interface ExportActionsState {
  exportState: ExportState
  statusMessage: string
  historyFormat: HistoryFormat
}

interface ExportActions {
  handleCopy: () => Promise<void>
  handleExport: () => void
  handleSaveToDatabase: () => Promise<void>
  setHistoryFormat: (format: HistoryFormat) => void
  setExportState: (state: ExportState) => void
  setStatusMessage: (message: string) => void
  generateHistory: () => string
  generateMarkdown: () => string
  generateJSON: () => object[]
  resetExportState: () => void
}

/**
 * Hook for managing export actions: copy, export file, save to database.
 */
export const useExportActions = ({
  messages,
  historyFormat: initialHistoryFormat,
  platformLabel,
  conversationTitle
}: UseExportActionsParams): ExportActionsState & ExportActions => {
  const [exportState, setExportState] = useState<ExportState>("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [historyFormat, setHistoryFormat] = useState<HistoryFormat>(initialHistoryFormat)

  const generateMarkdown = useCallback(() => {
    return messages
      .map((msg, index) => {
        const fromLabel = msg.authorName || (msg.role === "user" ? "User" : "Assistant")
        return `**${index + 1}. ${fromLabel}**\n${msg.text}\n`
      })
      .join("\n")
  }, [messages])

  const generateJSON = useCallback(() => {
    return messages.map((msg, index) => ({
      index: index + 1,
      id: msg.id,
      role: msg.role,
      from: msg.authorName,
      text: msg.text
    }))
  }, [messages])

  const generateHistory = useCallback(() => {
    if (historyFormat === "json") {
      return JSON.stringify(generateJSON(), null, 2)
    }
    return generateMarkdown()
  }, [historyFormat, generateJSON, generateMarkdown])

  const handleCopy = useCallback(async () => {
    const content = historyFormat === "markdown"
      ? generateMarkdown()
      : JSON.stringify(generateJSON(), null, 2)
    try {
      await navigator.clipboard.writeText(content)
      console.log("[SelectiveExporter] Copied to clipboard")
    } catch (error) {
      console.error("[SelectiveExporter] Failed to copy:", error)
    }
  }, [historyFormat, generateMarkdown, generateJSON])

  const handleExport = useCallback(() => {
    if (messages.length === 0) return

    const content = historyFormat === "markdown"
      ? generateMarkdown()
      : JSON.stringify(generateJSON(), null, 2)
    const ext = historyFormat === "markdown" ? "md" : "json"
    const base = sanitizeFilename(conversationTitle) || `conversation-${deriveConversationId()}`
    const filename = `${base}.${ext}`
    const mimeType = historyFormat === "markdown" ? "text/markdown" : "application/json"

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    console.log(`[SelectiveExporter] Exported ${historyFormat} file: ${filename}`)
  }, [messages.length, historyFormat, generateMarkdown, generateJSON, conversationTitle])

  const handleSaveToDatabase = useCallback(async () => {
    if (messages.length === 0 || exportState === "loading") return

    setExportState("loading")
    setStatusMessage("Saving conversation...")

    try {
      const token = await requestClerkToken()
      const conversationId = deriveConversationId()
      const payload = {
        conversationId,
        title: document.title || "Conversation",
        model: platformLabel.toLowerCase(),
        selectedMessageIds: messages.map((m) => m.id),
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          from: msg.authorName,
          content: msg.text,
          tokens: Math.ceil(msg.text.length / 4),
          metadata: {
            extensionMessageId: msg.id,
            senderName: msg.authorName
          }
        })),
        metadata: {
          source: "chrome_extension",
          host: window.location.hostname,
          platform: platformLabel.toLowerCase()
        }
      }

      const response = await fetch(`${API_BASE_URL}/v1/conversations/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || result?.message || `Save failed with status ${response.status}`)
      }

      setExportState("success")
      setStatusMessage("Conversation saved successfully.")
      console.log("[SelectiveExporter] Save success", result)
    } catch (error) {
      console.error("[SelectiveExporter] Save failed:", error)
      setExportState("error")
      setStatusMessage(error instanceof Error ? error.message : "Failed to save conversation.")
    }
  }, [messages, exportState, platformLabel])

  const resetExportState = useCallback(() => {
    setExportState("idle")
    setStatusMessage("")
  }, [])

  return {
    exportState,
    statusMessage,
    historyFormat,
    handleCopy,
    handleExport,
    handleSaveToDatabase,
    setHistoryFormat,
    setExportState,
    setStatusMessage,
    generateHistory,
    generateMarkdown,
    generateJSON,
    resetExportState
  }
}
