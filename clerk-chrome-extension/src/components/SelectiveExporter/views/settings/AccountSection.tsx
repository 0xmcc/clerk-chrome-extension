import { useState } from "react"

import { DARK_THEME } from "../../constants"

type AccountSectionProps = {
  onLogout: () => Promise<{ success: boolean; error?: string }>
  setStatusMessage: (message: string) => void
  isSignedOut: boolean
  onSignInClick: () => void
}

export const AccountSection = ({
  onLogout,
  setStatusMessage,
  isSignedOut,
  onSignInClick
}: AccountSectionProps) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
      setStatusMessage(
        error instanceof Error ? error.message : "Sign out failed."
      )
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
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
  )
}
