import type { HistoryFormat } from "../types"
import { DARK_THEME, HISTORY_FORMAT_OPTIONS } from "../constants"

interface ExportViewProps {
  historyFormat: HistoryFormat
  selectedCount: number
  exportState: "idle" | "loading" | "success" | "error"
  onHistoryFormatChange: (value: HistoryFormat) => void
  onCopy: () => void
  onExport: () => void
  onSendToAI: () => void
  generateHistory: () => string
}

export const ExportView = ({
  historyFormat,
  selectedCount,
  exportState,
  onHistoryFormatChange,
  onCopy,
  onExport,
  onSendToAI,
  generateHistory
}: ExportViewProps) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap"
        }}>
        <select
          value={historyFormat}
          onChange={(e) => onHistoryFormatChange(e.target.value as HistoryFormat)}
          style={{
            border: `1px solid ${DARK_THEME.border}`,
            borderRadius: "10px",
            padding: "6px 12px",
            fontSize: "12px",
            background: DARK_THEME.surface,
            color: DARK_THEME.text,
            minWidth: "140px"
          }}>
          {HISTORY_FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Copy button */}
        <button
          onClick={onCopy}
          disabled={selectedCount === 0}
          title="Copy to clipboard"
          style={{
            border: `1px solid ${DARK_THEME.border}`,
            borderRadius: "10px",
            padding: "8px 12px",
            fontSize: "12px",
            background: selectedCount === 0 ? DARK_THEME.surface : DARK_THEME.panel,
            color: selectedCount === 0 ? DARK_THEME.muted : DARK_THEME.text,
            cursor: selectedCount === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            if (selectedCount > 0) {
              e.currentTarget.style.background = DARK_THEME.surface
              e.currentTarget.style.borderColor = DARK_THEME.accent
            }
          }}
          onMouseLeave={(e) => {
            if (selectedCount > 0) {
              e.currentTarget.style.background = DARK_THEME.panel
              e.currentTarget.style.borderColor = DARK_THEME.border
            }
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </button>

        {/* Export button */}
        <button
          onClick={onExport}
          disabled={selectedCount === 0 || exportState === "loading"}
          title="Export to PromptMarket"
          style={{
            border: `1px solid ${DARK_THEME.border}`,
            borderRadius: "10px",
            padding: "8px 12px",
            fontSize: "12px",
            background: selectedCount === 0 || exportState === "loading" ? DARK_THEME.surface : DARK_THEME.panel,
            color: selectedCount === 0 || exportState === "loading" ? DARK_THEME.muted : DARK_THEME.text,
            cursor: selectedCount === 0 || exportState === "loading" ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            if (selectedCount > 0 && exportState !== "loading") {
              e.currentTarget.style.background = DARK_THEME.surface
              e.currentTarget.style.borderColor = DARK_THEME.accent
            }
          }}
          onMouseLeave={(e) => {
            if (selectedCount > 0 && exportState !== "loading") {
              e.currentTarget.style.background = DARK_THEME.panel
              e.currentTarget.style.borderColor = DARK_THEME.border
            }
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {exportState === "loading" ? "Exporting..." : "Export"}
        </button>

        {/* Send to AI button */}
        <button
          onClick={onSendToAI}
          disabled={selectedCount === 0 || exportState === "loading"}
          title="Send to my AI via email"
          style={{
            border: `1px solid ${DARK_THEME.border}`,
            borderRadius: "10px",
            padding: "8px 12px",
            fontSize: "12px",
            background: selectedCount === 0 || exportState === "loading" ? DARK_THEME.surface : DARK_THEME.panel,
            color: selectedCount === 0 || exportState === "loading" ? DARK_THEME.muted : DARK_THEME.text,
            cursor: selectedCount === 0 || exportState === "loading" ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            if (selectedCount > 0 && exportState !== "loading") {
              e.currentTarget.style.background = DARK_THEME.surface
              e.currentTarget.style.borderColor = DARK_THEME.accent
            }
          }}
          onMouseLeave={(e) => {
            if (selectedCount > 0 && exportState !== "loading") {
              e.currentTarget.style.background = DARK_THEME.panel
              e.currentTarget.style.borderColor = DARK_THEME.border
            }
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          {exportState === "loading" ? "Sending..." : "Send to AI"}
        </button>
      </div>
      {historyFormat === "markdown" ? (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "inherit",
            margin: 0,
            color: DARK_THEME.text
          }}>
          {generateHistory()}
        </pre>
      ) : (
        <pre
          style={{
            background: DARK_THEME.code,
            padding: "12px",
            borderRadius: "8px",
            border: `1px solid ${DARK_THEME.border}`,
            overflow: "auto",
            fontSize: "12px",
            margin: 0,
            fontFamily: "monospace",
            color: DARK_THEME.text
          }}>
          {generateHistory()}
        </pre>
      )}
    </div>
  )
}
