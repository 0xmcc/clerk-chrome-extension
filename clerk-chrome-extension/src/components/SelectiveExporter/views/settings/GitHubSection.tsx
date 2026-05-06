import { useCallback, useEffect, useState } from "react"

import {
  disconnectGitHub,
  getGitHubAuthUrl,
  getGitHubStatus,
  type GitHubStatus
} from "~lib/github"

import { DARK_THEME } from "../../constants"

type LoadState = "loading" | "ready"

export const GitHubSection = () => {
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [status, setStatus] = useState<GitHubStatus>({ connected: false })
  const [errorMessage, setErrorMessage] = useState("")
  const [isBusy, setIsBusy] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoadState("loading")
    setErrorMessage("")

    try {
      const nextStatus = await getGitHubStatus()
      setStatus(nextStatus)
    } catch (error) {
      setStatus({ connected: false })
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load GitHub connection status."
      )
    } finally {
      setLoadState("ready")
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleConnect = async () => {
    setIsBusy(true)
    setErrorMessage("")

    try {
      const url = await getGitHubAuthUrl()

      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url })
      } else {
        window.open(url, "_blank", "noopener,noreferrer")
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to start GitHub OAuth."
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleDisconnect = async () => {
    setIsBusy(true)
    setErrorMessage("")

    try {
      await disconnectGitHub()
      await loadStatus()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to disconnect GitHub."
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <label
        style={{
          display: "block",
          fontSize: "13px",
          fontWeight: 600,
          color: DARK_THEME.text
        }}>
        GitHub
      </label>

      {loadState === "loading" ? (
        <div style={{ fontSize: "12px", color: DARK_THEME.textSecondary }}>
          Loading GitHub status...
        </div>
      ) : status.connected ? (
        <>
          <div style={{ fontSize: "12px", color: DARK_THEME.success }}>
            Connected as @{status.username}
          </div>
          {status.repoUrl && status.repoName ? (
            <a
              href={status.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "12px",
                color: DARK_THEME.accent,
                textDecoration: "none"
              }}>
              {status.repoName}
            </a>
          ) : null}
          <button
            onClick={handleDisconnect}
            disabled={isBusy}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: "6px",
              border: `1px solid ${DARK_THEME.borderSubtle}`,
              background: DARK_THEME.surface,
              color: DARK_THEME.text,
              fontSize: "13px",
              fontWeight: 500,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.6 : 1
            }}>
            {isBusy ? "Disconnecting..." : "Disconnect"}
          </button>
        </>
      ) : (
        <>
          <button
            onClick={handleConnect}
            disabled={isBusy}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: "6px",
              border: `1px solid ${DARK_THEME.borderSubtle}`,
              background: DARK_THEME.accent,
              color: "#fff",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.6 : 1
            }}>
            {isBusy ? "Connecting..." : "Connect GitHub"}
          </button>
          <button
            onClick={loadStatus}
            style={{
              alignSelf: "flex-start",
              padding: 0,
              border: "none",
              background: "transparent",
              color: DARK_THEME.accent,
              fontSize: "12px",
              cursor: "pointer"
            }}>
            Refresh status
          </button>
        </>
      )}

      {errorMessage ? (
        <div style={{ fontSize: "12px", color: DARK_THEME.danger }}>
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}
