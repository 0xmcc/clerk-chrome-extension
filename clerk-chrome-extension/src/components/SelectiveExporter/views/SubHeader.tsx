import type { ViewMode } from "../types"
import { DARK_THEME } from "../constants"

interface SubHeaderProps {
  view: ViewMode
  onBack: () => void
}

export const SubHeader = ({ view, onBack }: SubHeaderProps) => {
  // Only show when not in export view
  if (view === "export") return null

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 20px",
        borderBottom: `1px solid ${DARK_THEME.border}`,
        backgroundColor: DARK_THEME.surface
      }}>
      <button
        onClick={onBack}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: "18px",
          color: DARK_THEME.muted
        }}>
        ←
      </button>
      <div style={{ fontWeight: 700, color: DARK_THEME.text }}>
        {view === "analysis" ? "AI Analysis" : "Settings"}
      </div>
    </div>
  )
}
