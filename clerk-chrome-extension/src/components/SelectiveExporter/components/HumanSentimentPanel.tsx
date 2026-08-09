import type {
  HumanSentimentPoint,
  HumanSentimentStatus
} from "~lib/humanSentiment"

import { DARK_THEME } from "../constants"

interface HumanSentimentPanelProps {
  status: HumanSentimentStatus
  points: HumanSentimentPoint[]
  errorMessage?: string
  disabled?: boolean
  onAnalyze: () => void
}

const CHART_WIDTH = 340
const CHART_HEIGHT = 168
const PLOT_LEFT = 42
const PLOT_RIGHT = 12
const PLOT_TOP = 12
const PLOT_BOTTOM = 30

const formatScore = (score: number): string =>
  score > 0 ? `+${score}` : String(score)

const getPointColor = (score: number): string => {
  if (score > 20) return DARK_THEME.success
  if (score < -20) return DARK_THEME.danger
  return DARK_THEME.textSecondary
}

const getPointCoordinates = (
  point: HumanSentimentPoint,
  maxMessageIndex: number
): { x: number; y: number } => {
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT
  const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM

  return {
    x: PLOT_LEFT + (point.messageIndex / maxMessageIndex) * plotWidth,
    y: PLOT_TOP + ((100 - point.score) / 200) * plotHeight
  }
}

export const HumanSentimentPanel = ({
  status,
  points,
  errorMessage,
  disabled = false,
  onAnalyze
}: HumanSentimentPanelProps) => {
  const maxMessageIndex = Math.max(
    1,
    ...points.map((point) => point.messageIndex)
  )
  const plottedPoints = points.map((point) =>
    getPointCoordinates(point, maxMessageIndex)
  )
  const polylinePoints = plottedPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ")
  const analyzedPoints = points.filter((point) => point.messageIndex > 0)
  const isLoading = status === "loading"

  return (
    <section
      style={{
        border: `1px solid ${DARK_THEME.border}`,
        borderRadius: "8px",
        background: DARK_THEME.surface,
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px"
        }}>
        <div
          style={{
            color: DARK_THEME.text,
            fontSize: "13px",
            fontWeight: 650
          }}>
          Human sentiment
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={disabled || isLoading}
          style={{
            border: `1px solid ${DARK_THEME.borderStrong}`,
            borderRadius: "8px",
            background: disabled || isLoading ? DARK_THEME.border : DARK_THEME.panel,
            color: disabled || isLoading ? DARK_THEME.muted : DARK_THEME.text,
            cursor: disabled || isLoading ? "not-allowed" : "pointer",
            fontSize: "12px",
            fontWeight: 600,
            padding: "7px 10px",
            whiteSpace: "nowrap"
          }}>
          {isLoading
            ? "Analyzing..."
            : analyzedPoints.length > 0
              ? "Refresh"
              : "Analyze sentiment"}
        </button>
      </div>

      <div
        style={{
          width: "100%",
          overflow: "hidden",
          borderRadius: "6px",
          border: `1px solid ${DARK_THEME.borderSubtle}`,
          background: DARK_THEME.background
        }}>
        <svg
          role="img"
          aria-label="Human sentiment over transcript"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          width="100%"
          height="168"
          preserveAspectRatio="none">
          {[100, 0, -100].map((score) => {
            const y = getPointCoordinates(
              { messageIndex: 0, score },
              maxMessageIndex
            ).y

            return (
              <g key={score}>
                <line
                  x1={PLOT_LEFT}
                  y1={y}
                  x2={CHART_WIDTH - PLOT_RIGHT}
                  y2={y}
                  stroke={score === 0 ? DARK_THEME.borderStrong : DARK_THEME.border}
                  strokeDasharray={score === 0 ? "0" : "4 5"}
                />
                <text
                  x={8}
                  y={y + 4}
                  fill={DARK_THEME.muted}
                  fontSize="11">
                  {formatScore(score)}
                </text>
              </g>
            )
          })}

          <line
            x1={PLOT_LEFT}
            y1={PLOT_TOP}
            x2={PLOT_LEFT}
            y2={CHART_HEIGHT - PLOT_BOTTOM}
            stroke={DARK_THEME.borderStrong}
          />
          <line
            x1={PLOT_LEFT}
            y1={CHART_HEIGHT - PLOT_BOTTOM}
            x2={CHART_WIDTH - PLOT_RIGHT}
            y2={CHART_HEIGHT - PLOT_BOTTOM}
            stroke={DARK_THEME.borderStrong}
          />

          {polylinePoints ? (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={DARK_THEME.text}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {points.map((point) => {
            const coordinates = getPointCoordinates(point, maxMessageIndex)

            return (
              <circle
                key={`${point.messageIndex}-${point.score}`}
                cx={coordinates.x}
                cy={coordinates.y}
                r={point.messageIndex === 0 ? 3 : 4}
                fill={getPointColor(point.score)}
                stroke={DARK_THEME.background}
                strokeWidth="2"
              />
            )
          })}

          <text
            x={PLOT_LEFT}
            y={CHART_HEIGHT - 8}
            fill={DARK_THEME.muted}
            fontSize="11">
            0
          </text>
          <text
            x={CHART_WIDTH - PLOT_RIGHT - 18}
            y={CHART_HEIGHT - 8}
            fill={DARK_THEME.muted}
            fontSize="11">
            {maxMessageIndex}
          </text>
        </svg>
      </div>

      <div
        style={{
          color: DARK_THEME.muted,
          fontSize: "11px",
          display: "flex",
          justifyContent: "center"
        }}>
        Message index
      </div>

      {status === "error" && errorMessage ? (
        <div style={{ color: DARK_THEME.danger, fontSize: "12px" }}>
          {errorMessage}
        </div>
      ) : null}

      {analyzedPoints.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px"
          }}>
          {analyzedPoints.map((point) => (
            <div
              key={`${point.messageIndex}-${point.label ?? point.score}`}
              title={point.rationale}
              style={{
                border: `1px solid ${DARK_THEME.border}`,
                borderRadius: "999px",
                padding: "4px 8px",
                color: getPointColor(point.score),
                background: DARK_THEME.panel,
                fontSize: "11px",
                lineHeight: 1.2
              }}>
              {point.label ?? "Score"} {formatScore(point.score)}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
