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

type ChatEntry = {
  id: string
  role: "user" | "assistant"
  text: string
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
  const [jsonView, setJsonView] = useState<"messages" | "system">("messages")
  const [historyFormat, setHistoryFormat] = useState<"markdown" | "json">("markdown")
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([])
  const [replyNote, setReplyNote] = useState("")
  const [systemJsonText, setSystemJsonText] = useState("")
  const [systemContextIds, setSystemContextIds] = useState<Set<string>>(new Set())
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
        name: "Friendly follow-up",
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
    setChatEntries([])
    setReplyNote("")
    setSystemJsonText("")
    setSystemContextIds(new Set())
    setPromptContainers((prev) =>
      prev.map((c) => ({
        ...c,
        suggestion: "",
        status: "idle",
        error: ""
      }))
    )
  }, [conversationKey])

  // Select all messages by default when first loaded
  useEffect(() => {
    if (isOpen && messages.length > 0 && !hasInitializedRef.current) {
      console.log("[SelectiveExporter] Initializing - selecting all", messages.length, "messages")
      setSelectedIds(new Set(messages.map((m) => m.id)))
      setSystemContextIds(new Set(messages.slice(-5).map((m) => m.id)))
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
  const generateHistory = () => {
    if (historyFormat === "json") {
      return JSON.stringify(
        selectedMessages.map((msg, index) => ({
          index: index + 1,
          id: msg.id,
          role: msg.role,
          from: msg.authorName,
          text: msg.text
        })),
        null,
        2
      )
    }

    // default markdown format
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

  const generateSystemJSON = () => {
    const container = promptContainers[0]
    if (!container) return {}
    let profile: any = container.profileJson
    try {
      profile = JSON.parse(container.profileJson || "{}")
    } catch {
      // keep raw string if parsing fails
    }
    const recentContext = selectedMessages
      .filter((m) => systemContextIds.has(m.id))
      .slice(-5)
      .map((m) => ({
        id: m.id,
        from: m.authorName,
        role: m.role,
        text: m.text
      }))

    return {
      name: container.name,
      systemPrompt: container.systemPrompt,
      profile,
      platform: platformLabelRef.current.toLowerCase(),
      recentContext
    }
  }

  // Keep system JSON text in sync when switching views or data updates (reset on conversation change above)
  useEffect(() => {
    if (!(previewTab === "json" && jsonView === "system")) return
    const generated = JSON.stringify(generateSystemJSON(), null, 2)
    if (!systemJsonText) {
      setSystemJsonText(generated)
    }
  }, [previewTab, jsonView, messages, selectedMessages, systemContextIds, promptContainers, systemJsonText])

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
    const userMessages = chatEntries.filter((c) => c.role === "user" && c.text.trim())
    const userNoteBlock =
      userMessages.length > 0
        ? `User messages:\n${userMessages.map((m) => `- ${m.text}`).join("\n")}\n`
        : ""
    const freeNote = replyNote ? `User note: ${replyNote}\n` : ""

    return `${base}\n\n${tone}${context}\n${userNoteBlock}${freeNote}\nSuggested reply:\nHi ${contactName}, thanks for reaching out.${cta}${signoff}`.trim()
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
  }

  const handleAddChatMessage = () => {
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
  }

  const selectedPromptId = promptContainers[0]?.id

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
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap"
                  }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      onClick={handleCopy}
                      disabled={selectedIds.size === 0}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        color: selectedIds.size === 0 ? "#9ca3af" : "#4b5563",
                        cursor: selectedIds.size === 0 ? "not-allowed" : "pointer",
                        fontWeight: 600
                      }}>
                      📋 Copy
                    </button>
                    <button
                      onClick={handleExport}
                      disabled={selectedIds.size === 0 || exportState === "loading"}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        color:
                          selectedIds.size === 0 || exportState === "loading" ? "#9ca3af" : "#4b5563",
                        cursor:
                          selectedIds.size === 0 || exportState === "loading" ? "not-allowed" : "pointer",
                        fontWeight: 600
                      }}>
                      ⬇️ Export
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                    <span style={{ color: "#6b7280" }}>Format:</span>
                    <select
                      value={historyFormat}
                      onChange={(e) => setHistoryFormat(e.target.value as any)}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        background: "#ffffff",
                        color: "#374151"
                      }}>
                      <option value="markdown">Markdown</option>
                      <option value="json">JSON</option>
                    </select>
                  </div>
                </div>
                {historyFormat === "markdown" ? (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "inherit",
                      margin: 0
                    }}>
                    {generateHistory()}
                  </pre>
                ) : (
                  <pre
                    style={{
                      background: "#f3f4f6",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      overflow: "auto",
                      fontSize: "12px",
                      margin: 0,
                      fontFamily: "monospace"
                    }}>
                    {generateHistory()}
                  </pre>
                )}
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "0",
                    display: "flex",
                    gap: "6px",
                    fontSize: "12px"
                  }}>
                  <button
                    onClick={() => setJsonView("messages")}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "14px",
                      border: jsonView === "messages" ? "1px solid #667eea" : "1px solid #d1d5db",
                      background: jsonView === "messages" ? "rgba(102, 126, 234, 0.1)" : "#ffffff",
                      color: jsonView === "messages" ? "#4c51bf" : "#374151",
                      cursor: "pointer"
                    }}>
                    Messages
                  </button>
                  <button
                    onClick={() => setJsonView("system")}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "14px",
                      border: jsonView === "system" ? "1px solid #667eea" : "1px solid #d1d5db",
                      background: jsonView === "system" ? "rgba(102, 126, 234, 0.1)" : "#ffffff",
                      color: jsonView === "system" ? "#4c51bf" : "#374151",
                      cursor: "pointer"
                    }}>
                    System
                  </button>
                </div>
                {jsonView === "messages" ? (
                  <pre
                    style={{
                      background: "#f3f4f6",
                      padding: "12px",
                      borderRadius: "6px",
                      overflow: "auto",
                      fontSize: "12px",
                      margin: 0,
                      marginTop: "14px"
                    }}>
                    {JSON.stringify(generateJSON(), null, 2)}
                  </pre>
                ) : (
                  <textarea
                    value={systemJsonText || JSON.stringify(generateSystemJSON(), null, 2)}
                    onChange={(e) => setSystemJsonText(e.target.value)}
                    rows={10}
                    style={{
                      width: "100%",
                      background: "#ffffff",
                      padding: "12px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      overflow: "auto",
                      fontSize: "12px",
                      margin: 0,
                      marginTop: "14px",
                      fontFamily: "monospace",
                      resize: "vertical",
                      minHeight: "180px"
                    }}
                  />
                )}
                {jsonView === "system" && selectedMessages.length > 0 && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      background: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>
                      Recent context to include
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "140px", overflowY: "auto" }}>
                      {selectedMessages.slice(-8).map((m) => (
                        <label
                          key={m.id}
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "flex-start",
                            cursor: "pointer",
                            fontSize: "12px",
                            color: "#374151"
                          }}>
                          <input
                            type="checkbox"
                            checked={systemContextIds.has(m.id)}
                            onChange={(e) => {
                              setSystemContextIds((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(m.id)
                                else next.delete(m.id)
                                return next
                              })
                            }}
                            style={{ marginTop: "2px" }}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>{m.authorName}</div>
                            <div style={{ color: "#6b7280" }}>{m.text.slice(0, 140)}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* LinkedIn Response Helper - chat-style UI
      {isLinkedIn && previewTab === "markdown" && promptContainers.length > 0 && selectedPromptId && (
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            padding: "14px 20px",
            backgroundColor: "#f9fafb",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
              color: "#374151"
            }}>
            <div style={{ fontWeight: 600 }}>Chat</div>
            <div style={{ fontSize: "11px", color: "#6b7280" }}>Press Enter to add your message</div>
          </div>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "10px",
              maxHeight: "200px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
            {chatEntries.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: "13px" }}>No chat yet. Add a message or suggest a reply.</div>
            ) : (
              chatEntries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    alignSelf: entry.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "82%"
                  }}>
                  <div
                    style={{
                      background:
                        entry.role === "user"
                          ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                          : "#f3f4f6",
                      color: entry.role === "user" ? "#ffffff" : "#1f2937",
                      padding: "10px 12px",
                      borderRadius: entry.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                      fontSize: "13px",
                      lineHeight: 1.5
                    }}>
                    {entry.text}
                  </div>
                </div>
              ))
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center"
            }}>
            <textarea
              placeholder="Type a message…"
              value={replyNote}
              onChange={(e) => setReplyNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleAddChatMessage()
                }
              }}
              rows={2}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                fontSize: "13px",
                resize: "vertical",
                background: "#ffffff"
              }}
            />
            <button
              onClick={handleAddChatMessage}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                color: "#374151",
                minWidth: "64px"
              }}>
              Send
            </button>
          </div>
          { <button
            onClick={() => handleSuggest(selectedPromptId, { copy: true })}
            disabled={promptContainers.find((c) => c.id === selectedPromptId)?.status === "loading"}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              background:
                promptContainers.find((c) => c.id === selectedPromptId)?.status === "loading"
                  ? "#9ca3af"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#ffffff",
              cursor:
                promptContainers.find((c) => c.id === selectedPromptId)?.status === "loading"
                  ? "not-allowed"
                  : "pointer",
              fontSize: "15px",
              fontWeight: 600,
              textAlign: "center",
              boxShadow: "0 8px 20px rgba(103, 126, 234, 0.35)"
            }}>
            {"Suggest reply"}
          </button> }
        </div>
      )} */}

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
