import { DARK_THEME } from "../../constants"
import type { ActivityChartCardProps } from "./types"

const cardStyle: React.CSSProperties = {
  backgroundColor: DARK_THEME.surface,
  border: `1px solid ${DARK_THEME.border}`,
  borderRadius: "16px",
  padding: "20px"
}

/** Bar color based on activity level relative to max */
const getBarColor = (tokens: number, maxTokens: number, isToday: boolean): string => {
  if (tokens === 0) return DARK_THEME.borderStrong
  if (isToday) return DARK_THEME.text // Highlight today
  const ratio = tokens / maxTokens
  if (ratio > 0.5) return DARK_THEME.textSecondary
  return DARK_THEME.muted
}

export const ActivityChartCard = ({
  dailyActivity,
  maxDailyTokens
}: ActivityChartCardProps) => {
  const maxBarHeight = 80
  const now = new Date()
  const todayDayOfWeek = now.getDay()
  // Convert Sunday=0 to index 6, Monday=1 to index 0, etc.
  const todayIndex = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1

  return (
    <div style={cardStyle}>
      {/* Section label */}
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: DARK_THEME.text,
          marginBottom: "20px"
        }}>
        7-Day Activity
      </div>

      {/* Bar chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          height: `${maxBarHeight + 28}px`,
          gap: "8px"
        }}>
        {dailyActivity.map((day, i) => {
          const isToday = i === todayIndex
          const barHeight =
            maxDailyTokens > 0
              ? Math.max(8, (day.tokenEstimate / maxDailyTokens) * maxBarHeight)
              : 8
          const color = getBarColor(day.tokenEstimate, maxDailyTokens, isToday)

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: 1
              }}>
              {/* Bar */}
              <div
                style={{
                  width: "100%",
                  maxWidth: "36px",
                  height: `${day.tokenEstimate > 0 ? barHeight : 8}px`,
                  backgroundColor: color,
                  borderRadius: "4px",
                  transition: "height 0.3s ease, background-color 0.3s ease"
                }}
              />
              {/* Day label */}
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "12px",
                  color: isToday ? DARK_THEME.text : DARK_THEME.muted,
                  fontWeight: isToday ? 600 : 500
                }}>
                {day.dayLabel}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
