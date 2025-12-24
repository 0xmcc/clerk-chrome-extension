/**
 * URL matchers for intercepted API requests.
 *
 * Re-exports from centralized config to maintain single source of truth.
 * Other files in useMessageScanner can continue importing from here.
 */

export {
  matchChatGPTList,
  matchChatGPTDetail,
  matchClaudeList,
  matchClaudeDetail,
} from "../../config/endpoints"
