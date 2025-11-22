import { useEffect, useState } from "react"

import { useMessageScanner, type Message } from "~hooks/useMessageScanner"

interface SelectiveExporterProps {
  isOpen: boolean
  onClose: () => void
}

export const SelectiveExporter = ({ isOpen, onClose }: SelectiveExporterProps) => {
  const { messages } = useMessageScanner()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewTab, setPreviewTab] = useState<"markdown" | "json">("markdown")

  // Select all messages by default when first loaded
  useEffect(() => {
    if (isOpen && messages.length > 0 && selectedIds.size === 0) {
      setSelectedIds(new Set(messages.map((m) => m.id)))
    }
  }, [isOpen, messages])

  if (!isOpen) return null

  // Get selected messages in order
  const selectedMessages = messages.filter((m) => selectedIds.has(m.id))

  // Generate Markdown preview
  const generateMarkdown = () => {
    return selectedMessages
      .map((msg, index) => {
        const roleLabel = msg.role === "user" ? "User" : "Assistant"
        return `**${index + 1}. ${roleLabel}**\n${msg.text}\n`
      })
      .join("\n")
  }

  // Generate JSON preview
  const generateJSON = () => {
    return selectedMessages.map((msg, index) => ({
      index: index + 1,
      id: msg.id,
      role: msg.role,
      text: msg.text
    }))
  }

  const handleToggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleClose = () => {
    // Clean up body padding
    document.documentElement.style.paddingRight = ""
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

  // Add body padding when drawer opens
  if (isOpen) {
    document.documentElement.style.paddingRight = "420px"
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          zIndex: 9998,
          backdropFilter: "blur(2px)"
        }}
      />

      {/* Drawer */}
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
              ChatGPT Export
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
            disabled={selectedIds.size === 0}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              borderRadius: "6px",
              background: selectedIds.size === 0 ? "#9ca3af" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              cursor: selectedIds.size === 0 ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: 500,
              color: "#ffffff",
              opacity: selectedIds.size === 0 ? 0.5 : 1
            }}>
            Export
          </button>
        </div>
      </div>
    </>
  )
}
