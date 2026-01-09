import { useActivityMetrics } from "~hooks/useActivityMetrics"
import { WeeklyIdentityCard } from "./WeeklyIdentityCard"
import { ContextCapacityCard } from "./ContextCapacityCard"
import { ActivityChartCard } from "./ActivityChartCard"
import type { ActivityDashboardProps } from "./types"

export const ActivityDashboard = ({ currentMessages }: ActivityDashboardProps) => {
  const metrics = useActivityMetrics(currentMessages)

  if (!metrics.hasData) return null

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        marginBottom: "20px"
      }}>
      <WeeklyIdentityCard
        weeklyTokensFormatted={metrics.weeklyTokensFormatted}
        streak={metrics.streak}
        percentileLabel={metrics.percentileLabel}
      />
      <ContextCapacityCard contextRemaining={metrics.contextRemaining} />
      <ActivityChartCard
        dailyActivity={metrics.dailyActivity}
        maxDailyTokens={metrics.maxDailyTokens}
      />
    </div>
  )
}
