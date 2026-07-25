import { DARK_THEME } from "../../constants"

export type MomentumSyncSectionProps = {
  momentumSyncUrl: string
  momentumSyncToken: string
  onMomentumSyncUrlChange: (value: string) => void
  onMomentumSyncTokenChange: (value: string) => void
}

const sectionLabelStyle = {
  fontSize: "13px",
  fontWeight: 600,
  color: DARK_THEME.text
} as const

const fieldLabelStyle = {
  fontSize: "11px",
  color: DARK_THEME.textSecondary
} as const

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "12px",
  color: DARK_THEME.text,
  background: DARK_THEME.input,
  border: `1px solid ${DARK_THEME.border}`,
  borderRadius: "8px",
  outline: "none",
  boxSizing: "border-box"
} as const

export const MomentumSyncSection = ({
  momentumSyncUrl,
  momentumSyncToken,
  onMomentumSyncUrlChange,
  onMomentumSyncTokenChange
}: MomentumSyncSectionProps) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
    <label style={sectionLabelStyle}>Local Sync (momentum)</label>

    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={fieldLabelStyle} htmlFor="momentum-sync-url">
        Server URL
      </label>
      <input
        id="momentum-sync-url"
        type="text"
        style={inputStyle}
        value={momentumSyncUrl}
        placeholder="http://127.0.0.1:4319"
        onChange={(event) => onMomentumSyncUrlChange(event.target.value)}
      />
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={fieldLabelStyle} htmlFor="momentum-sync-token">
        Token
      </label>
      <input
        id="momentum-sync-token"
        type="password"
        style={inputStyle}
        value={momentumSyncToken}
        placeholder="from `momentum serve`"
        onChange={(event) => onMomentumSyncTokenChange(event.target.value)}
      />
    </div>

    <div style={{ fontSize: "11px", color: DARK_THEME.muted }}>
      Run <code>momentum serve</code> in your terminal, then paste the URL and
      token it prints. "Sync to momentum" saves the open conversation to your
      local archive.
    </div>
  </div>
)
