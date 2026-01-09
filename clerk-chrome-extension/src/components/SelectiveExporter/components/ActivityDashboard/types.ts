import type { DailyActivity } from "~hooks/useActivityMetrics"

export interface ActivityDashboardProps {
  currentMessages: Array<{ text: string; role: string }>
}

export interface WeeklyIdentityCardProps {
  weeklyTokensFormatted: string
  streak: number
  percentileLabel: string
}

export interface ContextCapacityCardProps {
  contextRemaining: number
}

export interface ActivityChartCardProps {
  dailyActivity: DailyActivity[]
  maxDailyTokens: number
}
