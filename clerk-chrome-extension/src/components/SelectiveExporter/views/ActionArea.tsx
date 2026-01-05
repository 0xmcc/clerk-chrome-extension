import type { ViewMode, ExportState } from "../types"
import { DARK_THEME } from "../constants"
import { openSignInPage } from "~utils/navigation"

interface ActionAreaProps {
  view: ViewMode
  selectedCount: number
  exportState: ExportState
  statusMessage: string
  analysisInput: string
  onAnalysisInputChange: (value: string) => void
  onAnalysisSend: () => void
  onBackToExport: () => void
  onSave: () => void
}

export const ActionArea = ({
  view,
  selectedCount,
  exportState,
  statusMessage,
  analysisInput,
  onAnalysisInputChange,
  onAnalysisSend,
  onBackToExport,
  onSave
}: ActionAreaProps) => {
  return (
    <>
      <div
        style={{
          padding: "16px 20px",
          borderTop: `1px solid ${DARK_THEME.border}`,
          backgroundColor: DARK_THEME.surface,
          display: "flex",
          gap: "12px",
          flexDirection: view === "analysis" ? "column" : "row"
        }}>
        {view === "analysis" ? (
          <>
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
          </>
        ) : (
          <button
            onClick={onSave}
            disabled={selectedCount === 0 || exportState === "loading"}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "8px",
              border: "none",
              background: selectedCount === 0 || exportState === "loading" ? DARK_THEME.border : "#ffffff",
              color: selectedCount === 0 || exportState === "loading" ? DARK_THEME.muted : "#0a0a0a",
              cursor: selectedCount === 0 || exportState === "loading" ? "not-allowed" : "pointer",
              fontSize: "15px",
              fontWeight: 600,
              boxShadow: DARK_THEME.glow,
              opacity: selectedCount === 0 || exportState === "loading" ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              position: "relative"
            }}>
            <span>{exportState === "loading" ? "Saving..." : "Save"}</span>
          </button>
        )}
      </div>
      {statusMessage && (
        <div
          style={{
            padding: "0 20px 16px",
            fontSize: "12px",
            color: exportState === "error" ? DARK_THEME.danger : DARK_THEME.success
          }}>
          {exportState === "error" && statusMessage.toLowerCase().includes("sign in") ? (
            <>
              Missing Clerk session.{" "}
              <span
                onClick={openSignInPage}
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
