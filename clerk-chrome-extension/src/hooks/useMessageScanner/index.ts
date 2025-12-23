// Main hook
export { useMessageScanner } from "./useMessageScanner"

// Types
export type {
  Message,
  CapturedPlatform,
  Conversation,
  ScannerStats,
  InterceptorEvent
} from "./types"

// Utilities (for consumers who may need them)
export {
  getConversationKey,
  getActiveConversationIdFromUrl,
  isCapturedPlatform,
  inferCapturedPlatformFromUrl
} from "./utils"

// Constants
export { INTERCEPTOR_SOURCE } from "./rescan"
