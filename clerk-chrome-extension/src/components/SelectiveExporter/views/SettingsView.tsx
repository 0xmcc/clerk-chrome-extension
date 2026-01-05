import { DARK_THEME, DEFAULT_ANALYSIS_SYSTEM_PROMPT, DEFAULT_FOLLOWUP_SYSTEM_PROMPT } from "../constants"

interface SettingsViewProps {
  analysisSystemPrompt: string
  followupSystemPrompt: string
  personalContext: string
  analysisLocked: boolean
  followupLocked: boolean
  onAnalysisPromptChange: (value: string) => void
  onFollowupPromptChange: (value: string) => void
  onPersonalContextChange: (value: string) => void
  onAnalysisLockToggle: () => void
  onFollowupLockToggle: () => void
  buildAnalysisSystemPrompt: () => string
}

export const SettingsView = ({
  analysisSystemPrompt,
  followupSystemPrompt,
  personalContext,
  analysisLocked,
  followupLocked,
  onAnalysisPromptChange,
  onFollowupPromptChange,
  onPersonalContextChange,
  onAnalysisLockToggle,
  onFollowupLockToggle,
  buildAnalysisSystemPrompt
}: SettingsViewProps) => {
  return (
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
      </div>
    </div>
  )
}
