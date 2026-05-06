import { useEffect, useMemo, useState } from "react"

import type { GitHubRepo } from "~lib/github"

import type { ViewMode, ExportState } from "../types"
import { DARK_THEME } from "../constants"

interface ActionAreaProps {
  view: ViewMode
  selectedCount: number
  canSave: boolean
  exportState: ExportState
  statusMessage: string
  analysisInput: string
  isSignedOut: boolean
  awaitingSignIn: boolean
  githubButtonLabel?: string
  onGitHubClick?: () => void
  githubConnected?: boolean
  githubRepos?: GitHubRepo[]
  selectedGitHubRepoFullNames?: string[]
  githubRepoMenuOpen?: boolean
  githubReposLoading?: boolean
  githubRepoSelectionBusy?: boolean
  githubRepoMessage?: string
  onGitHubRepoMenuToggle?: () => void
  onGitHubRepoToggle?: (repoFullName: string) => void
  onAnalysisInputChange: (value: string) => void
  onAnalysisSend: () => void
  onBackToExport: () => void
  onSave: () => void
  onSignInClick: () => void
  onConfirmSignedIn: () => void
}

const getSaveButtonText = (exportState: ExportState, isSignedOut: boolean): string => {
  if (exportState === "loading") return "Saving..."
  return isSignedOut ? "Save to my library" : "Save"
}

const getStatusColor = (exportState: ExportState): string => {
  if (exportState === "error") return DARK_THEME.danger
  if (exportState === "warning") return DARK_THEME.warning
  return DARK_THEME.success
}

const isVaultRepo = (repo: GitHubRepo): boolean =>
  /vault/i.test(repo.name) || /vault/i.test(repo.fullName)

export const ActionArea = ({
  view,
  selectedCount,
  canSave,
  exportState,
  statusMessage,
  analysisInput,
  isSignedOut,
  awaitingSignIn,
  githubButtonLabel,
  onGitHubClick,
  githubConnected = false,
  githubRepos = [],
  selectedGitHubRepoFullNames = [],
  githubRepoMenuOpen = false,
  githubReposLoading = false,
  githubRepoSelectionBusy = false,
  githubRepoMessage = "",
  onGitHubRepoMenuToggle,
  onGitHubRepoToggle,
  onAnalysisInputChange,
  onAnalysisSend,
  onBackToExport,
  onSave,
  onSignInClick,
  onConfirmSignedIn
}: ActionAreaProps) => {
  const hasGitHubSection = Boolean(githubButtonLabel || githubConnected)
  const selectedGitHubRepoCount = selectedGitHubRepoFullNames.length
  const [githubRepoSearch, setGitHubRepoSearch] = useState("")

  useEffect(() => {
    if (!githubRepoMenuOpen) {
      setGitHubRepoSearch("")
    }
  }, [githubRepoMenuOpen])

  const visibleGitHubRepos = useMemo(() => {
    const normalizedQuery = githubRepoSearch.trim().toLowerCase()

    return [...githubRepos]
      .filter((repo) => {
        if (!normalizedQuery) {
          return true
        }

        return (
          repo.fullName.toLowerCase().includes(normalizedQuery) ||
          repo.name.toLowerCase().includes(normalizedQuery)
        )
      })
      .sort((leftRepo, rightRepo) => {
        const leftIsVaultRepo = isVaultRepo(leftRepo)
        const rightIsVaultRepo = isVaultRepo(rightRepo)

        if (leftIsVaultRepo !== rightIsVaultRepo) {
          return leftIsVaultRepo ? -1 : 1
        }

        const leftSelected = selectedGitHubRepoFullNames.includes(leftRepo.fullName)
        const rightSelected = selectedGitHubRepoFullNames.includes(
          rightRepo.fullName
        )

        if (leftSelected !== rightSelected) {
          return leftSelected ? -1 : 1
        }

        return leftRepo.fullName.localeCompare(rightRepo.fullName)
      })
  }, [githubRepoSearch, githubRepos, selectedGitHubRepoFullNames])

  // Settings view: only render status message if present
  if (view === "settings") {
    if (!statusMessage) return null
    return (
      <div
        style={{
          padding: "0 20px 16px",
          fontSize: "12px",
          color: getStatusColor(exportState)
        }}>
        {statusMessage}
      </div>
    )
  }

  // Export view: render Save button + status message
  if (view === "export") {
    return (
      <>
        <div
          style={{
            padding: "16px 20px",
            borderTop: `1px solid ${DARK_THEME.border}`,
            backgroundColor: DARK_THEME.surface,
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
          {hasGitHubSection ? (
            <div
              style={{
                border: `1px solid ${DARK_THEME.border}`,
                borderRadius: "12px",
                padding: "14px",
                background: DARK_THEME.panel,
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  alignItems: "flex-start"
                }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: DARK_THEME.text
                    }}>
                    GitHub repos
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      lineHeight: 1.5,
                      color: DARK_THEME.muted
                    }}>
                    Select multiple repos to receive a copy of this conversation.
                  </div>
                </div>

                {githubConnected ? (
                  githubRepos.length > 0 || githubReposLoading ? (
                    <button
                      onClick={onGitHubRepoMenuToggle}
                      disabled={githubReposLoading || githubRepoSelectionBusy}
                      style={{
                        flexShrink: 0,
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: `1px solid ${DARK_THEME.borderStrong}`,
                        background: DARK_THEME.surface,
                        color: DARK_THEME.text,
                        cursor:
                          githubReposLoading || githubRepoSelectionBusy
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          githubReposLoading || githubRepoSelectionBusy ? 0.7 : 1,
                        fontSize: "12px",
                        fontWeight: 500
                      }}>
                      Choose repos
                    </button>
                  ) : null
                ) : githubButtonLabel && onGitHubClick ? (
                  <button
                    onClick={onGitHubClick}
                    style={{
                      flexShrink: 0,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: `1px solid ${DARK_THEME.border}`,
                      background: DARK_THEME.surface,
                      color: DARK_THEME.text,
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 500
                    }}>
                    {githubButtonLabel}
                  </button>
                ) : null}
              </div>

              {!githubConnected ? (
                <div style={{ fontSize: "12px", color: DARK_THEME.muted }}>
                  Connect GitHub to choose repositories for conversation sync.
                </div>
              ) : githubReposLoading ? (
                <div style={{ fontSize: "12px", color: DARK_THEME.muted }}>
                  Loading GitHub repos...
                </div>
              ) : githubRepoMenuOpen ? (
                githubRepos.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input
                      type="search"
                      placeholder="Search repos"
                      value={githubRepoSearch}
                      onChange={(event) => setGitHubRepoSearch(event.target.value)}
                      disabled={githubRepoSelectionBusy}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: `1px solid ${DARK_THEME.border}`,
                        background: DARK_THEME.surface,
                        color: DARK_THEME.text,
                        fontSize: "12px",
                        outline: "none"
                      }}
                    />
                    <div
                      data-testid="github-repo-list"
                      style={{
                        maxHeight: "220px",
                        overflowY: "auto",
                        paddingRight: "4px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px"
                      }}>
                      {visibleGitHubRepos.length > 0 ? (
                        visibleGitHubRepos.map((repo) => (
                          <label
                            key={repo.fullName}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              borderRadius: "10px",
                              border: `1px solid ${DARK_THEME.border}`,
                              background: DARK_THEME.surface,
                              padding: "10px 12px",
                              fontSize: "12px",
                              color: DARK_THEME.text,
                              cursor: githubRepoSelectionBusy
                                ? "not-allowed"
                                : "pointer",
                              opacity: githubRepoSelectionBusy ? 0.7 : 1
                            }}>
                            <input
                              type="checkbox"
                              checked={selectedGitHubRepoFullNames.includes(
                                repo.fullName
                              )}
                              disabled={githubRepoSelectionBusy}
                              onChange={() => onGitHubRepoToggle?.(repo.fullName)}
                            />
                            <span>{repo.fullName}</span>
                          </label>
                        ))
                      ) : (
                        <div
                          style={{
                            fontSize: "12px",
                            color: DARK_THEME.muted,
                            padding: "8px 4px"
                          }}>
                          No repos match that search.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: DARK_THEME.muted }}>
                    No GitHub repos are available yet.
                  </div>
                )
              ) : (
                <div style={{ fontSize: "12px", color: DARK_THEME.muted }}>
                  {selectedGitHubRepoCount > 0
                    ? `${selectedGitHubRepoCount} repo${selectedGitHubRepoCount === 1 ? "" : "s"} selected`
                    : "No repos selected yet."}
                </div>
              )}

              {githubRepoMessage ? (
                <div
                  style={{
                    fontSize: "12px",
                    color: githubRepoMessage.toLowerCase().includes("failed")
                      ? DARK_THEME.danger
                      : DARK_THEME.muted
                  }}>
                  {githubRepoMessage}
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            onClick={onSave}
            disabled={!canSave || selectedCount === 0 || exportState === "loading"}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "none",
              background: !canSave || selectedCount === 0 || exportState === "loading" ? DARK_THEME.border : "#ffffff",
              color: !canSave || selectedCount === 0 || exportState === "loading" ? DARK_THEME.muted : "#0a0a0a",
              cursor: !canSave || selectedCount === 0 || exportState === "loading" ? "not-allowed" : "pointer",
              fontSize: "15px",
              fontWeight: 600,
              boxShadow: DARK_THEME.glow,
              opacity: !canSave || selectedCount === 0 || exportState === "loading" ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px"
            }}>
            <span>{getSaveButtonText(exportState, isSignedOut)}</span>
          </button>
          {isSignedOut && (
            awaitingSignIn ? (
              <button
                onClick={onConfirmSignedIn}
                style={{
                  marginTop: "12px",
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: `1px solid ${DARK_THEME.border}`,
                  background: DARK_THEME.panel,
                  color: DARK_THEME.text,
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500
                }}>
                I signed in
              </button>
            ) : (
              <div
                onClick={onSignInClick}
                style={{
                  marginTop: "12px",
                  textAlign: "center",
                  fontSize: "13px",
                  color: DARK_THEME.muted,
                  cursor: "pointer"
                }}>
                Sign in for full access
              </div>
            )
          )}
        </div>
        {statusMessage && (
          <div
            style={{
              padding: "0 20px 16px",
              fontSize: "12px",
              color: getStatusColor(exportState)
            }}>
            {exportState === "error" && statusMessage.toLowerCase().includes("sign in") ? (
              <>
                Missing Clerk session.{" "}
                <span
                  onClick={onSignInClick}
                  style={{
                    color: DARK_THEME.accent,
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}>
                  Sign in
                </span>
                {" "}to continue.
              </>
            ) : (
              statusMessage
            )}
          </div>
        )}
      </>
    )
  }

  if (view !== "analysis") {
    if (!statusMessage) return null
    return (
      <div
        style={{
          padding: "0 20px 16px",
          fontSize: "12px",
          color: getStatusColor(exportState)
        }}>
        {statusMessage}
      </div>
    )
  }

  return (
    <>
      <div
        style={{
          padding: "16px 20px",
          borderTop: `1px solid ${DARK_THEME.border}`,
          backgroundColor: DARK_THEME.surface,
          display: "flex",
          gap: "12px",
          flexDirection: "column"
        }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <textarea
            placeholder="Type to ask or refine..."
            value={analysisInput}
            onChange={(e) => onAnalysisInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                onAnalysisSend()
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
            onClick={onAnalysisSend}
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
          onClick={onBackToExport}
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
      </div>
      {statusMessage && (
        <div
          style={{
            padding: "0 20px 16px",
            fontSize: "12px",
            color: getStatusColor(exportState)
          }}>
          {exportState === "error" && statusMessage.toLowerCase().includes("sign in") ? (
            <>
              Missing Clerk session.{" "}
              <span
                onClick={onSignInClick}
                style={{
                  color: DARK_THEME.accent,
                  cursor: "pointer",
                  textDecoration: "underline"
                }}>
                Sign in
              </span>
              {" "}to continue.
            </>
          ) : (
            statusMessage
          )}
        </div>
      )}
    </>
  )
}
