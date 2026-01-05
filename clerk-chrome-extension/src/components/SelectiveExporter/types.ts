import type { Message } from "~hooks/useMessageScanner/types"

/**
 * Props for the SelectiveExporter component.
 */
export interface SelectiveExporterProps {
  isOpen: boolean
  onClose: () => void
  messages: Message[]
  conversationKey: string
  conversationTitle?: string
}

/**
 * Container for prompt configuration used in LinkedIn response helper.
 */
export type PromptContainer = {
  id: string
  name: string
  systemPrompt: string
  profileJson: string
  suggestion: string
  status: "idle" | "loading" | "error" | "ready"
  error?: string
}

/**
 * A single entry in the chat/analysis conversation.
 */
export type ChatEntry = {
  id: string
  role: "user" | "assistant"
  text: string
}

/**
 * Export operation state.
 */
export type ExportState = "idle" | "loading" | "success" | "error"

/**
 * View mode for the exporter panel.
 * - "export": Main export view with markdown/json preview
 * - "settings": Settings view for prompts and personal context
 * - "analysis": AI analysis chat view
 */
export type ViewMode = "export" | "settings" | "analysis"

/**
 * History format options for export.
 */
export type HistoryFormat = "markdown" | "json"
