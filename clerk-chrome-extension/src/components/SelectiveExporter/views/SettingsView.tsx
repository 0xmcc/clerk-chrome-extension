import { useState } from "react"

import { DARK_THEME, DEFAULT_ANALYSIS_SYSTEM_PROMPT, DEFAULT_FOLLOWUP_SYSTEM_PROMPT } from "../constants"
import { ConversationDepthIndicator } from "../components/ConversationDepthIndicator"

interface SettingsViewProps {
  messages: Array<{ text: string; role: string }>
  analysisSystemPrompt: string
  followupSystemPrompt: string
  personalContext: string
  analysisLocked: boolean
  followupLocked: boolean
  aiEmail: string
  aiEmailFrom: string
  aiEmailProvider: string
  aiEmailApiKey: string
  onAnalysisPromptChange: (value: string) => void
  onFollowupPromptChange: (value: string) => void
  onPersonalContextChange: (value: string) => void
  onAnalysisLockToggle: () => void
  onFollowupLockToggle: () => void
  onAiEmailChange: (value: string) => void
  onAiEmailFromChange: (value: string) => void
  onAiEmailProviderChange: (value: string) => void
  onAiEmailApiKeyChange: (value: string) => void
  buildAnalysisSystemPrompt: () => string
  onLogout: () => Promise<{ success: boolean; error?: string }>
  setStatusMessage: (message: string) => void
  isSignedOut: boolean
  onSignInClick: () => void
}

export const SettingsView = ({
  messages,
  analysisSystemPrompt,
  followupSystemPrompt,
  personalContext,
  analysisLocked,
  followupLocked,
  aiEmail,
  aiEmailFrom,
  aiEmailProvider,
  aiEmailApiKey,
  onAnalysisPromptChange,
  onFollowupPromptChange,
  onPersonalContextChange,
  onAnalysisLockToggle,
  onFollowupLockToggle,
  onAiEmailChange,
  onAiEmailFromChange,
  onAiEmailProviderChange,
  onAiEmailApiKeyChange,
  buildAnalysisSystemPrompt,
  onLogout,
  setStatusMessage,
  isSignedOut,
  onSignInClick
}: SettingsViewProps) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const result = await onLogout()
      if (result.success) {
        setStatusMessage("Signed out.")
      } else {
        setStatusMessage(result.error || "Sign out failed.")
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Sign out failed.")
    } finally {
      setIsLoggingOut(false)
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Conversation Depth Indicator */}
      <div style={{ paddingBottom: "16px", borderBottom: `1px solid ${DARK_THEME.borderSubtle}` }}>
        <ConversationDepthIndicator messages={messages} />
      </div>

      {/* Send to AI Settings */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <label
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 600,
            color: DARK_THEME.text
          }}>
          Send to My AI
        </label>

        {/* My AI Email (To) */}
        <div>
          <label style={{ display: "block", fontSize: "12px", color: DARK_THEME.textSecondary, marginBottom: "4px" }}>
            My AI Email (To)
          </label>
          <input
            type="email"
            value={aiEmail}
            onChange={(e) => onAiEmailChange(e.target.value)}
            placeholder="your-ai@agentmail.to"
            style={{
              width: "100%",
              background: DARK_THEME.surface,
              padding: "10px 12px",
              borderRadius: "6px",
              border: `1px solid ${DARK_THEME.borderSubtle}`,
              fontSize: "13px",
              color: DARK_THEME.text,
              boxSizing: "border-box"
            }}
          />
        </div>

        {/* From Email */}
        <div>
          <label style={{ display: "block", fontSize: "12px", color: DARK_THEME.textSecondary, marginBottom: "4px" }}>
            From Email
          </label>
          <input
            type="email"
            value={aiEmailFrom}
            onChange={(e) => onAiEmailFromChange(e.target.value)}
            placeholder="you@agentmail.to"
            style={{
              width: "100%",
              background: DARK_THEME.surface,
              padding: "10px 12px",
              borderRadius: "6px",
              border: `1px solid ${DARK_THEME.borderSubtle}`,
              fontSize: "13px",
              color: DARK_THEME.text,
              boxSizing: "border-box"
            }}
          />
        </div>

        {/* Provider */}
        <div>
          <label style={{ display: "block", fontSize: "12px", color: DARK_THEME.textSecondary, marginBottom: "4px" }}>
            Provider
          </label>
          <select
            value={aiEmailProvider}
            onChange={(e) => onAiEmailProviderChange(e.target.value)}
            style={{
              width: "100%",
              background: DARK_THEME.surface,
              padding: "10px 12px",
              borderRadius: "6px",
              border: `1px solid ${DARK_THEME.borderSubtle}`,
              fontSize: "13px",
              color: DARK_THEME.text,
              boxSizing: "border-box"
            }}>
            <option value="agentmail">AgentMail</option>
          </select>
        </div>

        {/* API Key */}
        <div>
          <label style={{ display: "block", fontSize: "12px", color: DARK_THEME.textSecondary, marginBottom: "4px" }}>
            API Key
          </label>
          <input
            type="password"
            value={aiEmailApiKey}
            onChange={(e) => onAiEmailApiKeyChange(e.target.value)}
            placeholder="am_xxx..."
            style={{
              width: "100%",
              background: DARK_THEME.surface,
              padding: "10px 12px",
              borderRadius: "6px",
              border: `1px solid ${DARK_THEME.borderSubtle}`,
              fontSize: "13px",
              color: DARK_THEME.text,
              boxSizing: "border-box"
            }}
          />
        </div>

        {/* Test button */}
        <button
          onClick={async () => {
            if (!aiEmail || !aiEmailFrom || !aiEmailApiKey) {
              setStatusMessage("Fill in all email settings first")
              return
            }
            setIsTesting(true)
            try {
              const result = await chrome.runtime.sendMessage({
                action: "proxyFetch",
                url: `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(aiEmailFrom.trim())}/messages`,
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${aiEmailApiKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  to: [aiEmail.trim()],
                  subject: "AI Handoff Test",
                  text: "This is a test email from the Send to my AI extension. If your AI received this, the connection is working!"
                })
              })
              if (!result.success) {
                throw new Error(result.error || result.data?.message || `Failed (${result.status})`)
              }
              setStatusMessage("✅ Test email sent!")
            } catch (error) {
              setStatusMessage(error instanceof Error ? error.message : "Test failed")
            } finally {
              setIsTesting(false)
            }
          }}
          disabled={isTesting}
          style={{
            alignSelf: "flex-start",
            padding: "6px 14px",
            borderRadius: "6px",
            border: `1px solid ${DARK_THEME.borderSubtle}`,
            background: DARK_THEME.surface,
            color: DARK_THEME.text,
            fontSize: "12px",
            cursor: isTesting ? "not-allowed" : "pointer",
            opacity: isTesting ? 0.6 : 1
          }}>
          {isTesting ? "Sending..." : "🧪 Test"}
        </button>

        <div style={{ fontSize: "11px", color: DARK_THEME.muted }}>
          Sends emails directly via API when you click "Send to AI"
        </div>
        <a
          href="https://agentmail.to"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: "8px",
            fontSize: "12px",
            color: DARK_THEME.accent,
            textDecoration: "none"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline" }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none" }}>
          🔑 Get your AgentMail API key →
        </a>
      </div>

      {/* Account Section */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 600,
            color: DARK_THEME.text,
            marginBottom: "12px"
          }}>
          Account
        </label>
        {isSignedOut ? (
          <button
            onClick={onSignInClick}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: "6px",
              border: `1px solid ${DARK_THEME.borderSubtle}`,
              background: DARK_THEME.accent,
              color: "#fff",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer"
            }}>
            Sign in
          </button>
        ) : (
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: "6px",
              border: `1px solid ${DARK_THEME.borderSubtle}`,
              background: DARK_THEME.surface,
              color: DARK_THEME.text,
              fontSize: "13px",
              fontWeight: 500,
              cursor: isLoggingOut ? "not-allowed" : "pointer",
              opacity: isLoggingOut ? 0.6 : 1
            }}>
            {isLoggingOut ? "Signing out..." : "Log out"}
          </button>
        )}
      </div>
    </div>
  )
}


      {/* Analysis System Prompt
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
              onAnalysisLockToggle()
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
            onChange={(e) => onAnalysisPromptChange(e.target.value)}
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

       Follow-up System Prompt 
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
              onFollowupLockToggle()
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
            value={followupSystemPrompt || DEFAULT_FOLLOWUP_SYSTEM_PROMPT}
            onChange={(e) => onFollowupPromptChange(e.target.value)}
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

       Personal Context JSON
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
          onChange={(e) => onPersonalContextChange(e.target.value)}
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
      </div> */}
