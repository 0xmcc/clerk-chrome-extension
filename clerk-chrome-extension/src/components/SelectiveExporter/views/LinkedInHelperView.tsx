import type { ChatEntry, PromptContainer } from "../types"

interface LinkedInHelperViewProps {
  chatEntries: ChatEntry[]
  replyNote: string
  promptContainers: PromptContainer[]
  selectedPromptId: string | undefined
  onReplyNoteChange: (value: string) => void
  onAddChatMessage: () => void
  onSuggest: (id: string, opts?: { copy?: boolean }) => void
}

export const LinkedInHelperView = ({
  chatEntries,
  replyNote,
  promptContainers,
  selectedPromptId,
  onReplyNoteChange,
  onAddChatMessage,
  onSuggest
}: LinkedInHelperViewProps) => {
  if (!selectedPromptId) return null

  const selectedContainer = promptContainers.find((c) => c.id === selectedPromptId)
  const isLoading = selectedContainer?.status === "loading"

  return (
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
          onChange={(e) => onReplyNoteChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onAddChatMessage()
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
          onClick={onAddChatMessage}
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
      <button
        onClick={() => onSuggest(selectedPromptId, { copy: true })}
        disabled={isLoading}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          border: "none",
          background: isLoading
            ? "#9ca3af"
            : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "#ffffff",
          cursor: isLoading ? "not-allowed" : "pointer",
          fontSize: "15px",
          fontWeight: 600,
          textAlign: "center",
          boxShadow: "0 8px 20px rgba(103, 126, 234, 0.35)"
        }}>
        Suggest reply
      </button>
    </div>
  )
}
