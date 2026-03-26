import type { ViewMode } from "../types"
import { DARK_THEME } from "../constants"

const VIEW_LABELS: Record<ViewMode, string> = {
  export: "Export",
  settings: "Settings",
  analysis: "AI Analysis",
  conversation_index: "Conversations",
  youtube_transcript: "Transcript",
}

interface SubHeaderProps {
  view: ViewMode
  onBack: () => void
}

export const SubHeader = ({ view, onBack }: SubHeaderProps) => {
  // Only show when not in export view
  if (view === "export") return null

  const showBackButton = view !== "youtube_transcript"

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
      {showBackButton ? (
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
      ) : null}
      <div style={{ fontWeight: 700, color: DARK_THEME.text }}>
        {VIEW_LABELS[view]}
      </div>
    </div>
  )
}
