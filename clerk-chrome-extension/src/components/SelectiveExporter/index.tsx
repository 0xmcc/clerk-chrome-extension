import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useMessageScanner } from "~hooks/useMessageScanner"
import { detectPlatform, getPlatformLabel } from "~utils/platform"

interface SelectiveExporterProps {
  isOpen: boolean
  onClose: () => void
}

type PromptContainer = {
  id: string
  name: string
  systemPrompt: string
  profileJson: string
  suggestion: string
  status: "idle" | "loading" | "error" | "ready"
  error?: string
}

const requestClerkToken = async () => {
  return new Promise<string>((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error("Chrome runtime unavailable in this context"))
      return
    }

    chrome.runtime.sendMessage({ action: "getClerkToken" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      if (!response?.success || !response?.token) {
        reject(new Error(response?.error || "Missing Clerk session. Please sign in from the extension popup."))
        return
      }

      resolve(response.token as string)
    })
  })
}

const deriveConversationId = () => {
  const path = window.location.pathname
  const linkedinMatch = path.match(/messaging\/thread\/([^/?#]+)/)
  if (linkedinMatch?.[1]) return linkedinMatch[1]

  const claudeMatch = path.match(/\/chat\/([^/?#]+)/)
  if (claudeMatch?.[1]) return claudeMatch[1]

  const chatMatch = path.match(/\/c\/([^/?#]+)/)
  if (chatMatch?.[1]) return chatMatch[1]

  const combinedPath = `${window.location.hostname}${path}`
  const fallback = combinedPath.replace(/[^\w-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  if (fallback) return fallback

  return `conversation-${Date.now()}`
}

export const SelectiveExporter = ({ isOpen, onClose }: SelectiveExporterProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewTab, setPreviewTab] = useState<"markdown" | "json">("markdown")
  const [exportState, setExportState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const hasInitializedRef = useRef(false)
  const platformLabelRef = useRef(getPlatformLabel())
  const isLinkedIn = useMemo(() => detectPlatform() === "linkedin", [])
  const [promptContainers, setPromptContainers] = useState<PromptContainer[]>(() => {
    const stored = localStorage.getItem("linkedinPromptContainers")
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
        console.warn("[SelectiveExporter] Failed to parse stored prompt containers", err)
      }
    }
    return [
      {
        id: "default-linkedin-1",
        name: "Suggest reply",
        systemPrompt: "Be concise, warm, and include a clear next step. Keep it to 3 sentences max.",
        profileJson: JSON.stringify({ tone: "friendly", cta: "Ask for a short call", signoff: "Thanks!" }, null, 2),
        suggestion: "",
        status: "idle"
      }
    ]
  })

  const handleToggleSelection = useCallback((id: string) => {
    console.log("[SelectiveExporter] Toggle selection for:", id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        console.log("[SelectiveExporter] Removing:", id)
        next.delete(id)
      } else {
        console.log("[SelectiveExporter] Adding:", id)
        next.add(id)
      }
      console.log("[SelectiveExporter] New selectedIds size:", next.size)
      return next
    })
  }, [])

  const { messages, conversationKey } = useMessageScanner({
    selectedIds,
    onToggleSelection: handleToggleSelection,
    isExporterOpen: isOpen
  })

  // Reset selection when conversation changes
  useEffect(() => {
    setSelectedIds(new Set())
    hasInitializedRef.current = false
  }, [conversationKey])

  // Select all messages by default when first loaded
  useEffect(() => {
    if (isOpen && messages.length > 0 && !hasInitializedRef.current) {
      console.log("[SelectiveExporter] Initializing - selecting all", messages.length, "messages")
      setSelectedIds(new Set(messages.map((m) => m.id)))
      hasInitializedRef.current = true
    }

    // Reset when drawer closes
    if (!isOpen) {
      hasInitializedRef.current = false
    }
  }, [isOpen, messages.length])

  // Get selected messages in order (must be before early return to maintain hook order)
  const selectedMessages = messages.filter((m) => selectedIds.has(m.id))

  // Debug log when selection changes
  useEffect(() => {
    if (isOpen) {
      console.log("[SelectiveExporter] selectedMessages updated:", selectedMessages.length, "of", messages.length)
    }
  }, [isOpen, selectedMessages.length, messages.length])

  // Generate Markdown preview
  const generateMarkdown = () => {
    return selectedMessages
      .map((msg, index) => {
        const fromLabel = msg.authorName || (msg.role === "user" ? "User" : "Assistant")
        return `**${index + 1}. ${fromLabel}**\n${msg.text}\n`
      })
      .join("\n")
  }

  // Generate JSON preview
  const generateJSON = () => {
    return selectedMessages.map((msg, index) => ({
      index: index + 1,
      id: msg.id,
      role: msg.role,
      from: msg.authorName,
      text: msg.text
    }))
  }

  const handleClose = () => {
    onClose()
  }

  const handleCopy = async () => {
    const content = previewTab === "markdown" ? generateMarkdown() : JSON.stringify(generateJSON(), null, 2)
    try {
      await navigator.clipboard.writeText(content)
      console.log("[SelectiveExporter] Copied to clipboard")
    } catch (error) {
      console.error("[SelectiveExporter] Failed to copy:", error)
    }
  }

  // Manage body padding when drawer opens/closes
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.paddingRight = "420px"
    } else {
      document.documentElement.style.paddingRight = ""
    }

    return () => {
      document.documentElement.style.paddingRight = ""
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setExportState("idle")
      setStatusMessage("")
    }
  }, [isOpen])

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
      localStorage.setItem("linkedinPromptContainers", JSON.stringify(toPersist))
    } catch (err) {
      console.warn("[SelectiveExporter] Failed to persist prompt containers", err)
    }
  }, [promptContainers])

  const updateContainer = (id: string, changes: Partial<PromptContainer>) => {
    setPromptContainers((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)))
  }

  const buildSuggestion = (container: PromptContainer): string => {
    let profile: Record<string, any> = {}
    try {
      profile = JSON.parse(container.profileJson || "{}")
    } catch (err) {
      throw new Error("Profile JSON is invalid")
    }

    const lastInbound =
      [...messages].reverse().find((m) => m.role !== "user") || messages[messages.length - 1] || null
    const contactName = lastInbound?.authorName || profile.contactName || "there"
    const lastLine = lastInbound?.text ? lastInbound.text.slice(0, 400) : ""
    const tone = profile.tone ? `Tone: ${profile.tone}. ` : ""
    const signoff = profile.signoff ? ` ${profile.signoff}` : ""
    const cta = profile.cta ? ` ${profile.cta}` : ""

    const base =
      container.systemPrompt.trim() ||
      "Craft a concise, helpful reply for LinkedIn. Keep it respectful and specific."

    const context = lastLine ? `Context: "${lastLine}"` : "No recent message content available."

    return `${base}\n\n${tone}${context}\n\nSuggested reply:\nHi ${contactName}, thanks for reaching out.${cta}${signoff}`.trim()
  }

  const handleSuggest = (id: string, opts?: { copy?: boolean }) => {
    const container = promptContainers.find((c) => c.id === id)
    if (!container) return
    updateContainer(id, { status: "loading", error: "" })

    try {
      const suggestion = buildSuggestion(container)
      updateContainer(id, { suggestion, status: "ready" })
      if (opts?.copy) {
        navigator.clipboard
          .writeText(suggestion)
          .then(() => console.log("[SelectiveExporter] Suggestion copied to clipboard"))
          .catch((err) => console.warn("[SelectiveExporter] Failed to copy suggestion", err))
      }
    } catch (err) {
      updateContainer(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Failed to build suggestion"
      })
    }
  }

  const handleExport = async () => {
    if (selectedIds.size === 0 || exportState === "loading") return

    setExportState("loading")
    setStatusMessage("Exporting selected messages...")

    try {
      const token = await requestClerkToken()
      const conversationId = deriveConversationId()
      const payload = {
        conversationId,
        title: document.title || "Conversation",
        model: null as string | null,
        selectedMessageIds: selectedMessages.map((m) => m.id),
        messages: selectedMessages.map((msg) => ({
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
          platform: platformLabelRef.current.toLowerCase()
        }
      }

      const response = await fetch("http://localhost:3000/v1/conversations/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || result?.message || `Export failed with status ${response.status}`)
      }

      setExportState("success")
      setStatusMessage("Conversation exported successfully.")
      console.log("[SelectiveExporter] Export success", result)
    } catch (error) {
      console.error("[SelectiveExporter] Export failed:", error)
      setExportState("error")
      setStatusMessage(error instanceof Error ? error.message : "Failed to export conversation.")
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "400px",
        backgroundColor: "#ffffff",
        boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb"
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#111827" }}>
            {platformLabelRef.current} Export
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#6b7280",
              padding: "0 4px",
              lineHeight: 1
            }}>
            ×
          </button>
        </div>
        <div style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
          {selectedIds.size} of {messages.length} messages selected
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb"
        }}>
        <button
          onClick={() => setPreviewTab("markdown")}
          style={{
            flex: 1,
            padding: "12px",
            border: "none",
            background: previewTab === "markdown" ? "#ffffff" : "transparent",
            borderBottom: previewTab === "markdown" ? "2px solid #667eea" : "2px solid transparent",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            color: previewTab === "markdown" ? "#667eea" : "#6b7280"
          }}>
          Markdown
        </button>
        <button
          onClick={() => setPreviewTab("json")}
          style={{
            flex: 1,
            padding: "12px",
            border: "none",
            background: previewTab === "json" ? "#ffffff" : "transparent",
            borderBottom: previewTab === "json" ? "2px solid #667eea" : "2px solid transparent",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            color: previewTab === "json" ? "#667eea" : "#6b7280"
          }}>
          JSON
        </button>
      </div>

      {/* Preview Area */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px",
          backgroundColor: "#ffffff"
        }}>
        {selectedIds.size === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
            <p style={{ margin: 0, fontSize: "14px" }}>
              No messages selected yet.
              <br />
              Select messages from the conversation to preview here.
            </p>
          </div>
        ) : (
          <div style={{ fontSize: "14px", lineHeight: 1.6, color: "#374151" }}>
            {previewTab === "markdown" ? (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "inherit",
                  margin: 0
                }}>
                {generateMarkdown()}
              </pre>
            ) : (
              <pre
                style={{
                  background: "#f3f4f6",
                  padding: "12px",
                  borderRadius: "6px",
                  overflow: "auto",
                  fontSize: "12px",
                  margin: 0
                }}>
                {JSON.stringify(generateJSON(), null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* LinkedIn Response Helpers - minimal CTA button */}
      {isLinkedIn && promptContainers.length > 0 && (
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            padding: "14px 20px",
            backgroundColor: "#f9fafb"
          }}>
          <button
            onClick={() => handleSuggest(promptContainers[0].id, { copy: true })}
            disabled={promptContainers[0].status === "loading"}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              background:
                promptContainers[0].status === "loading"
                  ? "#9ca3af"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#ffffff",
              cursor: promptContainers[0].status === "loading" ? "not-allowed" : "pointer",
              fontSize: "15px",
              fontWeight: 600,
              textAlign: "center",
              boxShadow: "0 8px 20px rgba(103, 126, 234, 0.35)"
            }}>
            {promptContainers[0].name || "Suggest reply"}
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
          display: "flex",
          gap: "12px"
        }}>
        <button
          onClick={handleCopy}
          disabled={selectedIds.size === 0}
          style={{
            flex: 1,
            padding: "10px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            background: "#ffffff",
            cursor: selectedIds.size === 0 ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: 500,
            color: selectedIds.size === 0 ? "#9ca3af" : "#374151",
            opacity: selectedIds.size === 0 ? 0.5 : 1
          }}>
          Copy
        </button>
        <button
          onClick={handleExport}
          disabled={selectedIds.size === 0 || exportState === "loading"}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            borderRadius: "6px",
            background:
              selectedIds.size === 0 || exportState === "loading"
                ? "#9ca3af"
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            cursor: selectedIds.size === 0 || exportState === "loading" ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: 500,
            color: "#ffffff",
            opacity: selectedIds.size === 0 || exportState === "loading" ? 0.5 : 1
          }}>
          {exportState === "loading" ? "Exporting..." : "Export"}
        </button>
      </div>
      {statusMessage && (
        <div
          style={{
            padding: "0 20px 16px",
            fontSize: "12px",
            color: exportState === "error" ? "#b91c1c" : "#065f46"
          }}>
          {statusMessage}
        </div>
      )}
    </div>
  )
}
