import { useState, useCallback } from "react"

import type { Message } from "~hooks/useMessageScanner/types"
import { requestClerkToken } from "~utils/clerk"
import { deriveConversationId, sanitizeFilename } from "~utils/conversation"
import { API_BASE_URL } from "~config/api"

import { detectPlatform, getPlatformLabel } from "~utils/platform"

import type { ExportState, HistoryFormat } from "../types"

interface UseExportActionsParams {
  messages: Message[]
  historyFormat: HistoryFormat
  platformLabel: string
  conversationTitle?: string
  aiEmail?: string
  aiEmailFrom?: string
  aiEmailApiKey?: string
  aiEmailProvider?: string
}

interface ExportActionsState {
  exportState: ExportState
  statusMessage: string
  historyFormat: HistoryFormat
}

interface ExportActions {
  handleCopy: () => Promise<void>
  handleExport: () => void
  handleSendToAI: () => void
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
  conversationTitle,
  aiEmail,
  aiEmailFrom,
  aiEmailApiKey,
  aiEmailProvider
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

  const handleSendToAI = useCallback(async () => {
    if (messages.length === 0) return

    // Check settings are configured
    if (!aiEmail || !aiEmailFrom || !aiEmailApiKey) {
      setExportState("error")
      setStatusMessage("Configure your AI email in Settings first")
      return
    }

    setExportState("loading")
    setStatusMessage("Sending to your AI...")

    try {
      const platform = detectPlatform()
      const source = platform === "claude" ? "claude" : "chatgpt"
      const platformName = getPlatformLabel(platform)
      const now = new Date()
      const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "").slice(0, 15) + "Z"
      const filename = `ai-handoff-${source}-${timestamp}.md`

      // Generate transcript markdown
      const transcriptLines = [
        "# AI Conversation Transcript",
        "",
        `- **Source:** ${window.location.href}`,
        `- **Captured at:** ${now.toISOString()}`,
        `- **Platform:** ${platformName}`,
        `- **Messages:** ${messages.length}`,
        "",
        "---",
        ""
      ]

      messages.forEach((msg, index) => {
        const fromLabel = msg.authorName || (msg.role === "user" ? "User" : "Assistant")
        transcriptLines.push(`**${index + 1}. ${fromLabel}**`)
        transcriptLines.push(msg.text)
        transcriptLines.push("")
      })

      const transcriptContent = transcriptLines.join("\n")
      const transcriptBase64 = btoa(unescape(encodeURIComponent(transcriptContent)))

      // Build subject
      const titleText = conversationTitle || messages.find(m => m.role === "user")?.text || "Conversation"
      const clippedTitle = titleText.length > 60 ? titleText.slice(0, 60) : titleText
      const subject = `AI Handoff: ${clippedTitle}`

      // Build body
      const body = `This email contains an AI conversation transcript as an attachment.

HANDOFF_PROMPT:
This is a transcript of a real conversation between a user and an AI. Treat it as authoritative context. Use it to understand:
- what the user was trying to accomplish
- what has already been explored
- what decisions or conclusions were reached
- what remains unresolved

Do not repeat or summarize the conversation unless necessary. Continue from where it left off. If there is a clear next step, propose it. If there are multiple plausible next steps, list them. If the conversation is complete, say so.`

      // Extract the local part of the from address for the API endpoint
      const fromAddress = aiEmailFrom.trim()

      const result = await chrome.runtime.sendMessage({
        action: "proxyFetch",
        url: `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(fromAddress)}/messages`,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${aiEmailApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: [aiEmail.trim()],
          subject,
          text: body,
          attachments: [
            {
              filename,
              content: transcriptBase64,
              content_type: "text/markdown"
            }
          ]
        })
      })

      if (!result.success) {
        throw new Error(result.error || result.data?.message || `Send failed (${result.status})`)
      }

      setExportState("success")
      setStatusMessage("✅ Sent to your AI")
      console.log(`[SelectiveExporter] Send to AI: sent ${filename} via AgentMail`)
    } catch (error) {
      console.error("[SelectiveExporter] Send to AI failed:", error)
      setExportState("error")
      setStatusMessage(error instanceof Error ? error.message : "Failed to send to AI")
    }
  }, [messages, conversationTitle, aiEmail, aiEmailFrom, aiEmailApiKey])

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
    handleSendToAI,
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
