import type { ReactNode } from "react"

import { DARK_THEME } from "../../constants"
import { useSendToMyAITest } from "../../hooks/useSendToMyAITest"

type SendToMyAISettingsSectionProps = {
  aiEmail: string
  aiEmailFrom: string
  aiEmailProvider: string
  aiEmailApiKey: string
  onAiEmailChange: (value: string) => void
  onAiEmailFromChange: (value: string) => void
  onAiEmailProviderChange: (value: string) => void
  onAiEmailApiKeyChange: (value: string) => void
  setStatusMessage: (message: string) => void
}

const sectionLabelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: DARK_THEME.text
} as const

const fieldLabelStyle = {
  display: "block",
  fontSize: "12px",
  color: DARK_THEME.textSecondary,
  marginBottom: "4px"
} as const

const fieldInputStyle = {
  width: "100%",
  background: DARK_THEME.surface,
  padding: "10px 12px",
  borderRadius: "6px",
  border: `1px solid ${DARK_THEME.borderSubtle}`,
  fontSize: "13px",
  color: DARK_THEME.text,
  boxSizing: "border-box"
} as const

type FieldProps = {
  label: string
  children: ReactNode
}

const Field = ({ label, children }: FieldProps) => (
  <div>
    <label style={fieldLabelStyle}>{label}</label>
    {children}
  </div>
)

export const SendToMyAISettingsSection = ({
  aiEmail,
  aiEmailFrom,
  aiEmailProvider,
  aiEmailApiKey,
  onAiEmailChange,
  onAiEmailFromChange,
  onAiEmailProviderChange,
  onAiEmailApiKeyChange,
  setStatusMessage
}: SendToMyAISettingsSectionProps) => {
  const { isTesting, sendTestEmail } = useSendToMyAITest({ setStatusMessage })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <label style={sectionLabelStyle}>Send to My AI</label>

      <Field label="My AI Email (To)">
        <input
          type="email"
          value={aiEmail}
          onChange={(e) => onAiEmailChange(e.target.value)}
          placeholder="your-ai@agentmail.to"
          style={fieldInputStyle}
        />
      </Field>

      <Field label="From Email">
        <input
          type="email"
          value={aiEmailFrom}
          onChange={(e) => onAiEmailFromChange(e.target.value)}
          placeholder="you@agentmail.to"
          style={fieldInputStyle}
        />
      </Field>

      <Field label="Provider">
        <select
          value={aiEmailProvider}
          onChange={(e) => onAiEmailProviderChange(e.target.value)}
          style={fieldInputStyle}>
          <option value="agentmail">AgentMail</option>
        </select>
      </Field>

      <Field label="API Key">
        <input
          type="password"
          value={aiEmailApiKey}
          onChange={(e) => onAiEmailApiKeyChange(e.target.value)}
          placeholder="am_xxx..."
          style={fieldInputStyle}
        />
      </Field>

      <a
        href="https://console.agentmail.to/dashboard/api-keys"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          marginTop: "2px",
          fontSize: "12px",
          color: DARK_THEME.accent,
          textDecoration: "none"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.textDecoration = "underline"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.textDecoration = "none"
        }}>
        🔑 Get your AgentMail API key →
      </a>

      <button
        onClick={() => {
          void sendTestEmail({
            aiEmail,
            aiEmailFrom,
            aiEmailApiKey
          })
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
    </div>
  )
}
