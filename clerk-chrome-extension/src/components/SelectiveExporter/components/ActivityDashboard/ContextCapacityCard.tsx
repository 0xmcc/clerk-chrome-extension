import { DARK_THEME } from "../../constants"
import type { ContextCapacityCardProps } from "./types"

const cardStyle: React.CSSProperties = {
  backgroundColor: DARK_THEME.surface,
  border: `1px solid ${DARK_THEME.border}`,
  borderRadius: "16px",
  padding: "20px"
}

/** Color based on remaining capacity (green = plenty, amber = moderate, red = low) */
const getCapacityColor = (remaining: number): string => {
  if (remaining > 60) return DARK_THEME.success
  if (remaining > 30) return DARK_THEME.warning
  return DARK_THEME.danger
}

export const ContextCapacityCard = ({ contextRemaining }: ContextCapacityCardProps) => {
  const color = getCapacityColor(contextRemaining)
  const usedPercent = 100 - contextRemaining

  return (
    <div style={cardStyle}>
      {/* Section label */}
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: DARK_THEME.text,
          marginBottom: "16px"
        }}>
        Context Capacity
      </div>

      {/* Progress bar container */}
      <div
        style={{
          height: "8px",
          backgroundColor: DARK_THEME.panel,
          borderRadius: "4px",
          overflow: "hidden",
          marginBottom: "12px"
        }}>
        {/* Used portion (gray) */}
        <div
          style={{
            height: "100%",
            width: `${usedPercent}%`,
            backgroundColor: DARK_THEME.textSecondary,
            borderRadius: "4px",
            transition: "width 0.3s ease"
          }}
        />
      </div>

      {/* Large remaining percentage */}
      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: DARK_THEME.text,
          lineHeight: 1.2
        }}>
        {contextRemaining}% context
        <br />
        remaining
      </div>
    </div>
  )
}
