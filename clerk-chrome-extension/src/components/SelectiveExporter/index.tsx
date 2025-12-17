import { useEffect, useMemo, useRef, useState } from "react"
import { marked } from "marked"

import { useMessageScanner } from "~hooks/useMessageScanner"
import { detectPlatform, getPlatformLabel } from "~utils/platform"

const API_BASE_URL = process.env.PLASMO_PUBLIC_API_BASE_URL || "http://localhost:3000"

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

const DARK_THEME = {
  // Echo brand-aligned dark theme
  background: "#0a0a0a", // background.primary
  surface: "#0f0f0f", // background.secondary
  panel: "#111111", // background.tertiary
  border: "#1f1f1f", // border.default
  borderSubtle: "#1a1a1a", // border.subtle
  borderStrong: "#252525", // border.strong
  text: "#e4e4e7", // text.primary
  textSecondary: "#a1a1aa", // text.secondary
  muted: "#71717a", // text.muted
  textFaint: "#52525b", // text.faint
  accent: "#8b5cf6", // accent.primary
  accentHover: "#7c3aed", // accent.primary_hover
  accentBg: "rgba(139, 92, 246, 0.1)", // accent.primary_bg
  accentAlt: "#1a1a1a",
  panelShadow: "0 10px 40px rgba(0, 0, 0, 0.5)", // shadows.lg
  input: "#111111", // input.background
  chip: "#1a1a1a",
  code: "#0a0a0a",
  danger: "#ef4444", // status.error
  success: "#4ade80", // status.success
  warning: "#fbbf24",
  info: "#3b82f6",
  glow: "0 8px 22px rgba(0, 0, 0, 0.45)"
}

marked.setOptions({
  gfm: true,
  breaks: true
})

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
  const [previewTab, setPreviewTab] = useState<"markdown" | "json">("markdown")
  const [historyFormat, setHistoryFormat] = useState<"markdown" | "json">("markdown")
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([])
  const [replyNote, setReplyNote] = useState("")
  const [systemContextIds, setSystemContextIds] = useState<Set<string>>(new Set())
  const [analysisSystemPrompt, setAnalysisSystemPrompt] = useState("")
  const [followupSystemPrompt, setFollowupSystemPrompt] = useState("")
  const [personalContext, setPersonalContext] = useState("")
  const [analyzeMode, setAnalyzeMode] = useState(false)
  const [analysisMessages, setAnalysisMessages] = useState<ChatEntry[]>([])
  const [analysisInput, setAnalysisInput] = useState("")
  const [analysisLocked, setAnalysisLocked] = useState(true)
  const [followupLocked, setFollowupLocked] = useState(true)
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

  const { messages, conversationKey } = useMessageScanner({
    isExporterOpen: isOpen
  })

  // Reset selection when conversation changes
  useEffect(() => {
    hasInitializedRef.current = false
    setChatEntries([])
    setReplyNote("")
    setSystemContextIds(new Set())
    setAnalyzeMode(false)
    setAnalysisMessages([])
    setAnalysisInput("")
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
      console.log("[SelectiveExporter] Initializing exporter with", messages.length, "messages")
      setSystemContextIds(new Set(messages.slice(-5).map((m) => m.id)))
      hasInitializedRef.current = true
    }

    // Reset when drawer closes
    if (!isOpen) {
      hasInitializedRef.current = false
    }
  }, [isOpen, messages.length])

  // Get messages in order (must be before early return to maintain hook order)
  const selectedMessages = messages
  const selectedCount = selectedMessages.length

  // Debug log when messages change
  useEffect(() => {
    if (isOpen) {
      console.log("[SelectiveExporter] messages updated:", selectedMessages.length)
    }
  }, [isOpen, selectedMessages.length])

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

  // Load custom prompts from chrome.storage on mount
  useEffect(() => {
    chrome.storage.local.get(['analysisSystemPrompt', 'followupSystemPrompt', 'personalContext'], (result) => {
      if (result.analysisSystemPrompt) setAnalysisSystemPrompt(result.analysisSystemPrompt)
      if (result.followupSystemPrompt) setFollowupSystemPrompt(result.followupSystemPrompt)
      if (result.personalContext) setPersonalContext(result.personalContext)
    })
    // Default to locked
    setAnalysisLocked(true)
    setFollowupLocked(true)
  }, [])

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
  const historyMenuOptions: { label: string; value: "markdown" | "json" | "copy" | "export" }[] = [
    { label: "Readable view", value: "markdown" },
    { label: "Structured (JSON)", value: "json" },
    { label: "Copy", value: "copy" },
    { label: "Export", value: "export" }
  ]

  const handleExport = async () => {
    if (selectedCount === 0 || exportState === "loading") return

    setExportState("loading")
    setStatusMessage("Exporting conversation...")

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

  const handleHistoryMenuChange = (value: "markdown" | "json") => {
    setHistoryFormat(value)
  }

  const buildAnalysisSystemPrompt = () => {
    const defaultPrompt = `You are an expert conversation analyst. Analyze the following conversation and provide a comprehensive analysis with these sections:

## Summary
Provide a concise 2-3 sentence summary of what the conversation is about.

## Key Topics
List the main topics discussed (bullet points).

## Key Insights
Identify the most important insights, decisions, or conclusions (bullet points).

## Conversation Quality
- Clarity: How clear and well-structured is the conversation?
- Depth: How thorough is the discussion?
- Outcome: What was accomplished or resolved?

## Recommendations
Suggest 2-3 actionable next steps or areas for follow-up.

Please provide your analysis in markdown format with clear section headings.`

    // Use custom prompt if available, otherwise use default
    let prompt = analysisSystemPrompt || defaultPrompt

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
  }

  const runAnalysis = async () => {
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
          ...selectedMessages.map(msg => ({
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
      console.log("🔍 Full API Response:", JSON.stringify(data, null, 2))
      console.log("🔍 Response keys:", Object.keys(data))
      console.log("🔍 data.status:", data.status)
      console.log("🔍 data.data:", data.data)
      console.log("🔍 data.data keys:", data.data ? Object.keys(data.data) : 'data.data is null/undefined')
      console.log("🔍 data.choices:", data.choices)
      console.log("🔍 data.error:", data.error)

      // Check if there's an error in the response
      if (data.status === 'error' || data.error) {
        throw new Error(data.error || 'API returned an error')
      }

      const analysis = data.data?.choices?.[0]?.message?.content

      if (!analysis) {
        console.error("❌ No analysis found. Full data structure:", {
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
        text: `❌ Analysis failed: ${error.message}\n\nPlease make sure:\n- You're signed in to PromptMarket\n- The backend server is running at ${API_BASE_URL}\n- Messages have loaded in the exporter`
      }])
    }
  }

  const handleAnalysisSend = async () => {
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
      const defaultFollowupPrompt = "You are a helpful conversation analyst. Answer follow-up questions about the conversation analysis concisely and clearly."
      let systemPrompt = followupSystemPrompt || defaultFollowupPrompt

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
        text: `❌ Error: ${error.message}`
      }])
    }
  }

  const formatAnalysisText = (text: string) => {
    if (!text) return ""
    let formatted = text.trim()
    formatted = formatted.replace(/(^|\n)(#{1,6}\s+)/g, "\n\n$2") // headings on their own block
    formatted = formatted.replace(/(^|\n)([-*+]\s+)/g, "\n$2") // bullets
    formatted = formatted.replace(/(^|\n)(\d+\.\s+)/g, "\n$2") // numbered lists
    return formatted.trim()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "420px", // layout.chat_panel_width
        backgroundColor: DARK_THEME.background,
        color: DARK_THEME.text,
        boxShadow: DARK_THEME.panelShadow,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${DARK_THEME.border}`,
          backgroundColor: DARK_THEME.surface
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: DARK_THEME.text }}>
            {platformLabelRef.current} Export Pizza
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: DARK_THEME.muted,
              padding: "0 4px",
              lineHeight: 1,
              borderRadius: "9999px",
              transition: "background 0.15s ease, color 0.15s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = DARK_THEME.borderSubtle
              e.currentTarget.style.color = DARK_THEME.text
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.color = DARK_THEME.muted
            }}>
            ×
          </button>
        </div>
        <div style={{ marginTop: "8px", fontSize: "12px", color: DARK_THEME.muted }}>
          {selectedCount} messages detected
        </div>
      </div>

      {/* Tabs or Analysis Header */}
      {analyzeMode ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 20px",
            borderBottom: `1px solid ${DARK_THEME.border}`,
            backgroundColor: DARK_THEME.surface
          }}>
          <button
            onClick={() => setAnalyzeMode(false)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "18px",
              color: DARK_THEME.muted
            }}>
            ←
          </button>
          <div style={{ fontWeight: 700, color: DARK_THEME.text }}>AI Analysis</div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            borderBottom: `1px solid ${DARK_THEME.border}`,
            backgroundColor: DARK_THEME.surface
          }}>
          <button
            onClick={() => setPreviewTab("markdown")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: previewTab === "markdown" ? DARK_THEME.panel : "transparent",
              borderBottom: previewTab === "markdown" ? `2px solid ${DARK_THEME.accent}` : "2px solid transparent",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              color: previewTab === "markdown" ? DARK_THEME.accent : DARK_THEME.muted
          }}>
          Conversation View
        </button>
        <button
          onClick={() => setPreviewTab("json")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: previewTab === "json" ? DARK_THEME.panel : "transparent",
              borderBottom: previewTab === "json" ? `2px solid ${DARK_THEME.accent}` : "2px solid transparent",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              color: previewTab === "json" ? DARK_THEME.accent : DARK_THEME.muted
          }}>
          Settings
        </button>
      </div>
      )}

      {/* Preview Area */}
      <div
        style={{
        flex: 1,
        overflow: "auto",
        padding: "20px",
        backgroundColor: DARK_THEME.panel
      }}>
        <style>{`
          .analysis-markdown h1 { font-size: 18px; margin: 10px 0 6px; font-weight: 700; }
          .analysis-markdown h2 { font-size: 16px; margin: 8px 0 4px; font-weight: 700; }
          .analysis-markdown h3 { font-size: 14px; margin: 6px 0 4px; font-weight: 700; }
          .analysis-markdown p { margin: 6px 0; }
          .analysis-markdown ul { margin: 6px 0 6px 18px; padding: 0; }
          .analysis-markdown li { list-style: disc; margin: 4px 0; }
          .analysis-markdown strong { font-weight: 700; }
        `}</style>
        {selectedCount === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: DARK_THEME.muted }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
            <p style={{ margin: 0, fontSize: "14px" }}>
              No messages found yet.
              <br />
              Once messages load, they'll appear here automatically.
            </p>
          </div>
        ) : (
          <div style={{ fontSize: "14px", lineHeight: 1.6, color: DARK_THEME.text }}>
            {analyzeMode ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  padding: "8px 0",
                  height: "100%",
                  position: "relative"
                }}>
                {/* Settings button to quickly access JSON tab */}
                <button
                  onClick={() => {
                    setPreviewTab("json")
                    setAnalyzeMode(false)
                  }}
                  title="Customize prompts"
                  style={{
                    position: "absolute",
                    top: "0",
                    right: "0",
                    background: DARK_THEME.panel,
                    border: `1px solid ${DARK_THEME.border}`,
                    borderRadius: "6px",
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: "11px",
                    color: DARK_THEME.muted,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.2s",
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = DARK_THEME.surface
                    e.currentTarget.style.borderColor = DARK_THEME.accent
                    e.currentTarget.style.color = DARK_THEME.text
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = DARK_THEME.panel
                    e.currentTarget.style.borderColor = DARK_THEME.border
                    e.currentTarget.style.color = DARK_THEME.muted
                  }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3" />
                  </svg>
                  Prompts
                </button>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    flex: 1,
                    overflowY: "auto",
                    padding: "4px 2px"
                  }}>
                  {analysisMessages.length === 0 ? (
                    <div style={{ color: DARK_THEME.muted, fontSize: "13px" }}>Analyzing...</div>
                  ) : (
                    analysisMessages.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                          background: m.role === "user" ? DARK_THEME.accentBg : DARK_THEME.surface,
                          color: DARK_THEME.text,
                          padding: "10px 12px",
                          borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "12px 12px 12px 4px",
                          maxWidth: "100%",
                          lineHeight: 1.5,
                          border: `1px solid ${DARK_THEME.borderSubtle}`,
                          boxShadow: m.role === "user" ? "0 4px 12px rgba(0,0,0,0.25)" : "0 4px 12px rgba(0,0,0,0.15)"
                        }}>
                        {m.role === "assistant" ? (
                          <div
                            style={{ fontSize: "14px", lineHeight: 1.6 }}
                            className="analysis-markdown"
                            dangerouslySetInnerHTML={{ __html: marked.parse(formatAnalysisText(m.text)) }}
                          />
                        ) : (
                          m.text
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : previewTab === "markdown" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap"
                  }}>
                  <select
                    value={historyFormat}
                    onChange={(e) => handleHistoryMenuChange(e.target.value as any)}
                    style={{
                      border: `1px solid ${DARK_THEME.border}`,
                      borderRadius: "10px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      background: DARK_THEME.surface,
                      color: DARK_THEME.text,
                      minWidth: "140px"
                    }}>
                    {historyMenuOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* Copy button */}
                  <button
                    onClick={handleCopy}
                    disabled={selectedCount === 0}
                    title="Copy to clipboard"
                    style={{
                      border: `1px solid ${DARK_THEME.border}`,
                      borderRadius: "10px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      background: selectedCount === 0 ? DARK_THEME.surface : DARK_THEME.panel,
                      color: selectedCount === 0 ? DARK_THEME.muted : DARK_THEME.text,
                      cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCount > 0) {
                        e.currentTarget.style.background = DARK_THEME.surface
                        e.currentTarget.style.borderColor = DARK_THEME.accent
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCount > 0) {
                        e.currentTarget.style.background = DARK_THEME.panel
                        e.currentTarget.style.borderColor = DARK_THEME.border
                      }
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </button>

                  {/* Export button */}
                  <button
                    onClick={handleExport}
                    disabled={selectedCount === 0 || exportState === "loading"}
                    title="Export to PromptMarket"
                    style={{
                      border: `1px solid ${DARK_THEME.border}`,
                      borderRadius: "10px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      background: selectedCount === 0 || exportState === "loading" ? DARK_THEME.surface : DARK_THEME.panel,
                      color: selectedCount === 0 || exportState === "loading" ? DARK_THEME.muted : DARK_THEME.text,
                      cursor: selectedCount === 0 || exportState === "loading" ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCount > 0 && exportState !== "loading") {
                        e.currentTarget.style.background = DARK_THEME.surface
                        e.currentTarget.style.borderColor = DARK_THEME.accent
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCount > 0 && exportState !== "loading") {
                        e.currentTarget.style.background = DARK_THEME.panel
                        e.currentTarget.style.borderColor = DARK_THEME.border
                      }
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {exportState === "loading" ? "Exporting..." : "Export"}
                  </button>
                </div>
                {historyFormat === "markdown" ? (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "inherit",
                      margin: 0,
                      color: DARK_THEME.text
                    }}>
                    {generateHistory()}
                  </pre>
                ) : (
                  <pre
                    style={{
                      background: DARK_THEME.code,
                      padding: "12px",
                      borderRadius: "8px",
                      border: `1px solid ${DARK_THEME.border}`,
                      overflow: "auto",
                      fontSize: "12px",
                      margin: 0,
                      fontFamily: "monospace",
                      color: DARK_THEME.text
                    }}>
                    {generateHistory()}
                  </pre>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Analysis System Prompt */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: DARK_THEME.text
                      }}>
                      Analysis System Prompt
                    </label>
                    <button
                      onClick={() => {
                        if (analysisLocked) {
                          const ok = window.confirm("This prompt is sensitive. Edit only if you know what you're doing.")
                          if (!ok) return
                        }
                        setAnalysisLocked((prev) => !prev)
                      }}
                      style={{
                        border: `1px solid ${DARK_THEME.borderSubtle}`,
                        borderRadius: "6px",
                        background: analysisLocked ? DARK_THEME.surface : DARK_THEME.panel,
                        color: DARK_THEME.textSecondary,
                        padding: "4px 8px",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}>
                      {analysisLocked ? "🔒 Locked" : "🔓 Unlock"}
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    {analysisLocked && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0, 0, 0, 0.7)",
                          borderRadius: "6px",
                          border: `1px solid ${DARK_THEME.borderSubtle}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: DARK_THEME.muted,
                          fontSize: "12px",
                          pointerEvents: "none"
                        }}>
                        Locked. Click unlock to edit.
                      </div>
                    )}
                    <textarea
                      value={analysisSystemPrompt || buildAnalysisSystemPrompt()}
                      onChange={(e) => {
                        setAnalysisSystemPrompt(e.target.value)
                        chrome.storage.local.set({ analysisSystemPrompt: e.target.value })
                      }}
                      placeholder="Enter the system prompt for initial conversation analysis..."
                      disabled={analysisLocked}
                      style={{
                        width: "100%",
                        background: analysisLocked ? DARK_THEME.surface : DARK_THEME.input,
                        padding: "12px",
                        borderRadius: "6px",
                        border: `1px solid ${DARK_THEME.borderSubtle}`,
                        fontSize: "13px",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        resize: "vertical",
                        minHeight: "150px",
                        lineHeight: "1.5",
                        color: DARK_THEME.text
                      }}
                    />
                  </div>
                </div>

                {/* Follow-up System Prompt */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: DARK_THEME.text
                      }}>
                      Follow-up System Prompt
                    </label>
                    <button
                      onClick={() => {
                        if (followupLocked) {
                          const ok = window.confirm("This prompt is sensitive. Edit only if you know what you're doing.")
                          if (!ok) return
                        }
                        setFollowupLocked((prev) => !prev)
                      }}
                      style={{
                        border: `1px solid ${DARK_THEME.borderSubtle}`,
                        borderRadius: "6px",
                        background: followupLocked ? DARK_THEME.surface : DARK_THEME.panel,
                        color: DARK_THEME.textSecondary,
                        padding: "4px 8px",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}>
                      {followupLocked ? "🔒 Locked" : "🔓 Unlock"}
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    {followupLocked && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0, 0, 0, 0.7)",
                          borderRadius: "6px",
                          border: `1px solid ${DARK_THEME.borderSubtle}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: DARK_THEME.muted,
                          fontSize: "12px",
                          pointerEvents: "none"
                        }}>
                        Locked. Click unlock to edit.
                      </div>
                    )}
                    <textarea
                      value={followupSystemPrompt || "You are a helpful conversation analyst. Answer follow-up questions about the conversation analysis concisely and clearly."}
                      onChange={(e) => {
                        setFollowupSystemPrompt(e.target.value)
                        chrome.storage.local.set({ followupSystemPrompt: e.target.value })
                      }}
                      placeholder="Enter the system prompt for follow-up questions..."
                      disabled={followupLocked}
                      style={{
                        width: "100%",
                        background: followupLocked ? DARK_THEME.surface : DARK_THEME.input,
                        padding: "12px",
                        borderRadius: "6px",
                        border: `1px solid ${DARK_THEME.borderSubtle}`,
                        fontSize: "13px",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        resize: "vertical",
                        minHeight: "100px",
                        lineHeight: "1.5",
                        color: DARK_THEME.text
                      }}
                    />
                  </div>
                </div>

                {/* Personal Context JSON */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: DARK_THEME.text,
                      marginBottom: "8px"
                    }}>
                    Personal Context (JSON)
                  </label>
                  <textarea
                    value={personalContext || '{}'}
                    onChange={(e) => {
                      setPersonalContext(e.target.value)
                      chrome.storage.local.set({ personalContext: e.target.value })
                    }}
                    placeholder='{"business_goals": ["..."], "communication_style": "...", "expertise": ["..."]}'
                    style={{
                      width: "100%",
                      background: DARK_THEME.input,
                      padding: "12px",
                      borderRadius: "6px",
                      border: `1px solid ${DARK_THEME.borderSubtle}`,
                      fontSize: "12px",
                      fontFamily: "monospace",
                      resize: "vertical",
                      minHeight: "120px",
                      lineHeight: "1.5",
                      color: DARK_THEME.text
                    }}
                  />
                  <div style={{ fontSize: "11px", color: DARK_THEME.muted, marginTop: "6px" }}>
                    Add JSON context about yourself that will be included in analysis prompts
                  </div>
                </div>
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

      {/* Action Button / Analysis Input */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: `1px solid ${DARK_THEME.border}`,
          backgroundColor: DARK_THEME.surface,
          display: "flex",
          gap: "12px",
          flexDirection: analyzeMode ? "column" : "row"
        }}>
        {analyzeMode ? (
          <>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <textarea
                placeholder="Type to ask or refine..."
                value={analysisInput}
                onChange={(e) => setAnalysisInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleAnalysisSend()
                  }
                }}
                rows={2}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: `1px solid ${DARK_THEME.borderSubtle}`,
                  fontSize: "13px",
                  resize: "vertical",
                  background: DARK_THEME.input,
                  color: DARK_THEME.text
                }}
              />
              <button
                onClick={handleAnalysisSend}
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: `1px solid ${DARK_THEME.borderStrong}`,
                  background: DARK_THEME.accent,
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#0a0a0a",
                  minWidth: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={DARK_THEME.text}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
              <button
                onClick={() => setAnalyzeMode(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: `1px solid ${DARK_THEME.border}`,
                  background: DARK_THEME.panel,
                  color: DARK_THEME.text,
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600
                }}>
                Back to export tools
            </button>
          </>
        ) : (
          <button
            onClick={() => runAnalysis()}
            disabled={selectedCount === 0}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              background: selectedCount === 0 ? DARK_THEME.border : "#ffffff",
              color: selectedCount === 0 ? DARK_THEME.muted : "#0a0a0a",
              cursor: selectedCount === 0 ? "not-allowed" : "pointer",
              fontSize: "15px",
              fontWeight: 600,
              boxShadow: DARK_THEME.glow,
              opacity: selectedCount === 0 ? 0.7 : 1
            }}>
            Analyze this conversation
          </button>
        )}
      </div>
      {statusMessage && (
        <div
          style={{
            padding: "0 20px 16px",
            fontSize: "12px",
            color: exportState === "error" ? DARK_THEME.danger : DARK_THEME.success
          }}>
          {statusMessage}
        </div>
      )}
    </div>
  )
}
