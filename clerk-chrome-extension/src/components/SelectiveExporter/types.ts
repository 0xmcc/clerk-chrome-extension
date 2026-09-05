import type { Conversation } from "~hooks/useMessageScanner/types"
import type { TranscriptStatus } from "~hooks/useYouTubeTranscript"
import type { ExportCapture } from "~lib/capture"
import type { LinkedInContact } from "~lib/linkedin-contacts"
import type { TranscriptSegment } from "~lib/transcript-parser"

/**
 * Props for the SelectiveExporter component.
 */
export interface SelectiveExporterProps {
  isOpen: boolean
  onClose: () => void
  capture: ExportCapture | null
  conversationKey: string
  emptyStateMessage: string
  conversations?: Conversation[]
  activeConvoKey?: string
  onSelectConversation?: (convoKey: string) => void
  onLoadConversation?: (convoId: string) => Promise<Conversation | undefined>
  youtubeStatus?: TranscriptStatus
  youtubeErrorMessage?: string
  linkedinContacts?: LinkedInContact[]
}

/**
 * Props for the YouTubeTranscriptView component.
 */
export interface YouTubeTranscriptViewProps {
  segments: TranscriptSegment[]
  status: TranscriptStatus
  errorMessage?: string
  videoId?: string
  videoTitle?: string
  videoUrl?: string
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
export type ExportState = "idle" | "loading" | "success" | "warning" | "error"

/**
 * View mode for the exporter panel.
 * - "export": Main export view with markdown/json preview
 * - "settings": Settings view for prompts and personal context
 * - "analysis": AI analysis chat view
 * - "conversation_index": Conversation list view for switching between captured conversations
 */
export type ViewMode =
  | "export"
  | "settings"
  | "analysis"
  | "conversation_index"
  | "youtube_transcript"

/**
 * History format options for export.
 */
export type HistoryFormat = "markdown" | "json"

/** Which source timestamp the conversation collection displays and sorts by. */
export type ConversationDateMode = "last_message" | "created"
