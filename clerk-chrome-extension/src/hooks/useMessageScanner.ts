// Re-export everything from the modularized structure
// This maintains backward compatibility for existing imports

/*
types.ts - All type definitions (Message, Conversation, ScannerStats, etc.)
utils.ts - Pure utilities (now, toMillis, normalizeText, createDetachedNode, etc.)
urlMatchers.ts - URL pattern matching functions
parsers/chatgpt.ts - ChatGPT list/detail parsers
parsers/claude.ts - Claude list/detail parsers
mergers.ts - Message and conversation merging logic
handlers.ts - Interceptor event handler factory
rescan.ts - Rescan handler factory
state.ts - useConversationStore and useActiveMessages hooks
useMessageScanner.ts - Main orchestration hook (~125 lines)
index.ts - Public exports
*/
export { useMessageScanner } from "./useMessageScanner/index"

export type {
  Message,
  CapturedPlatform,
  Conversation,
  ScannerStats
} from "./useMessageScanner/index"
