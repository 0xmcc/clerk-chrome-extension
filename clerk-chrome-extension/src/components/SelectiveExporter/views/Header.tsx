import { DARK_THEME } from "../constants"

interface HeaderProps {
  title: string
  messageCount: number
  onSettingsClick: () => void
  onClose: () => void
  showAuthBanner?: boolean
  onSignInClick?: () => void
}

export const Header = ({
  title,
  messageCount,
  onSettingsClick,
  onClose,
  showAuthBanner = false,
  onSignInClick
}: HeaderProps) => {
  return (
    <div
      style={{
        borderBottom: `1px solid ${DARK_THEME.border}`,
        backgroundColor: DARK_THEME.surface
      }}>
      {/* Auth banner - shown when signed out */}
      {showAuthBanner && (
        <div style={{ padding: "12px 16px 0" }}>
          <div
            style={{
              padding: "10px 16px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              fontSize: "13px",
              color: DARK_THEME.muted
            }}>
            This is a structured export of your ChatGPT Conversation.{" "}
            <span
              onClick={onSignInClick}
              style={{
                color: DARK_THEME.accent,
                cursor: "pointer"
              }}>
              Sign in
            </span>
            {" "}to save it in your inbox.
          </div>
        </div>
      )}
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2
            style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: DARK_THEME.text }}
            title={title}>
            {title}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Settings gear icon */}
            <button
              onClick={onSettingsClick}
              title="Settings"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: DARK_THEME.muted,
                padding: "4px",
                borderRadius: "9999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              onClick={onClose}
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
        </div>
        <div style={{ marginTop: "8px", fontSize: "12px", color: DARK_THEME.muted }}>
          {messageCount} messages detected
        </div>
      </div>
    </div>
  )
}
