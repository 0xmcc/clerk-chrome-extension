/**
 * Echo brand-aligned dark theme for SelectiveExporter.
 */
export const DARK_THEME = {
  // Background colors
  background: "#0a0a0a", // background.primary
  surface: "#0f0f0f", // background.secondary
  panel: "#111111", // background.tertiary

  // Border colors
  border: "#1f1f1f", // border.default
  borderSubtle: "#1a1a1a", // border.subtle
  borderStrong: "#252525", // border.strong

  // Text colors
  text: "#e4e4e7", // text.primary
  textSecondary: "#a1a1aa", // text.secondary
  muted: "#71717a", // text.muted
  textFaint: "#52525b", // text.faint

  // Accent colors
  accent: "#8b5cf6", // accent.primary
  accentHover: "#7c3aed", // accent.primary_hover
  accentBg: "rgba(139, 92, 246, 0.1)", // accent.primary_bg
  accentAlt: "#1a1a1a",

  // Shadows
  panelShadow: "0 10px 40px rgba(0, 0, 0, 0.5)", // shadows.lg
  glow: "0 8px 22px rgba(0, 0, 0, 0.45)",

  // Input/UI element colors
  input: "#111111", // input.background
  chip: "#1a1a1a",
  code: "#0a0a0a",

  // Status colors
  danger: "#ef4444", // status.error
  success: "#4ade80", // status.success
  warning: "#fbbf24",
  info: "#3b82f6"
} as const

/**
 * History format menu options.
 */
export const HISTORY_FORMAT_OPTIONS: { label: string; value: "markdown" | "json" }[] = [
  { label: "Markdown", value: "markdown" },
  { label: "JSON", value: "json" }
]

/**
 * Default system prompt for conversation analysis.
 */
export const DEFAULT_ANALYSIS_SYSTEM_PROMPT = `You are an expert conversation analyst. Analyze the following conversation and provide a comprehensive analysis with these sections:

## Summary
Provide a concise 2-3 sentence summary of what the conversation is about.

## Key Topics
List the main topics discussed (bullet points).

## Key Insights
Identify the most important insights, decisions, or conclusions (bullet points).

## Conversation Quality
- Clarity: How clear and well-structured is the conversation?
- Depth: How thorough is the discussion?
- Outcome: What was accomplished or resolved?

## Recommendations
Suggest 2-3 actionable next steps or areas for follow-up.

Please provide your analysis in markdown format with clear section headings.`

/**
 * Default system prompt for follow-up questions.
 */
export const DEFAULT_FOLLOWUP_SYSTEM_PROMPT = "You are a helpful conversation analyst. Answer follow-up questions about the conversation analysis concisely and clearly."
