import { DARK_THEME } from "../../constants"
import type { WeeklyIdentityCardProps } from "./types"

const cardStyle: React.CSSProperties = {
  backgroundColor: DARK_THEME.surface,
  border: `1px solid ${DARK_THEME.border}`,
  borderRadius: "16px",
  padding: "20px"
}

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      backgroundColor: DARK_THEME.panel,
      border: `1px solid ${DARK_THEME.borderSubtle}`,
      color: DARK_THEME.textSecondary,
      fontSize: "12px",
      fontWeight: 500,
      padding: "6px 12px",
      borderRadius: "9999px"
    }}>
    {children}
  </span>
)

export const WeeklyIdentityCard = ({
  weeklyTokensFormatted,
  streak,
  percentileLabel
}: WeeklyIdentityCardProps) => (
  <div style={cardStyle}>
    {/* Section label */}
    <div
      style={{
        fontSize: "13px",
        fontWeight: 600,
        color: DARK_THEME.text,
        marginBottom: "16px"
      }}>
      Weekly AI Identity
    </div>

    {/* Large token count */}
    <div
      style={{
        fontSize: "48px",
        fontWeight: 700,
        color: DARK_THEME.text,
        lineHeight: 1,
        marginBottom: "4px",
        letterSpacing: "-1px"
      }}>
      {weeklyTokensFormatted}
    </div>

    {/* Subtitle */}
    <div
      style={{
        fontSize: "14px",
        color: DARK_THEME.textSecondary,
        marginBottom: "16px"
      }}>
      tokens processed this week
    </div>

    {/* Badges row */}
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <Badge>
        <span style={{ fontSize: "14px" }}>🏆</span>
        {percentileLabel}
      </Badge>
      {streak > 0 && (
        <Badge>
          <span style={{ fontSize: "14px" }}>🔥</span>
          {streak}-day streak
        </Badge>
      )}
    </div>
  </div>
)
