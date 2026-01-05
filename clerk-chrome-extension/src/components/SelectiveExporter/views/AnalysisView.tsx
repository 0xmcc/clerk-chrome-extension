import { marked } from "marked"

import type { ChatEntry } from "../types"
import { DARK_THEME } from "../constants"

interface AnalysisViewProps {
  analysisMessages: ChatEntry[]
  formatAnalysisText: (text: string) => string
}

export const AnalysisView = ({
  analysisMessages,
  formatAnalysisText
}: AnalysisViewProps) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "8px 0",
        height: "100%"
      }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          flex: 1,
          overflowY: "auto",
          padding: "4px 2px"
        }}>
        {analysisMessages.length === 0 ? (
          <div style={{ color: DARK_THEME.muted, fontSize: "13px" }}>Analyzing...</div>
        ) : (
          analysisMessages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? DARK_THEME.accentBg : DARK_THEME.surface,
                color: DARK_THEME.text,
                padding: "10px 12px",
                borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "12px 12px 12px 4px",
                maxWidth: "100%",
                lineHeight: 1.5,
                border: `1px solid ${DARK_THEME.borderSubtle}`,
                boxShadow: m.role === "user" ? "0 4px 12px rgba(0,0,0,0.25)" : "0 4px 12px rgba(0,0,0,0.15)"
              }}>
              {m.role === "assistant" ? (
                <div
                  style={{ fontSize: "14px", lineHeight: 1.6 }}
                  className="analysis-markdown"
                  dangerouslySetInnerHTML={{ __html: marked.parse(formatAnalysisText(m.text)) as string }}
                />
              ) : (
                m.text
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
