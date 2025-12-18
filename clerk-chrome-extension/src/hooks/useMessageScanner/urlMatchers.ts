export const matchChatGPTList = (u: URL) => u.pathname === "/backend-api/conversations"

export const matchChatGPTDetail = (u: URL) => u.pathname.startsWith("/backend-api/conversation/")

export const matchClaudeList = (u: URL) =>
  /^\/api\/organizations\/[^/]+\/chat_conversations$/.test(u.pathname) ||
  /^\/api\/organizations\/[^/]+\/conversations$/.test(u.pathname)

export const matchClaudeDetail = (u: URL) =>
  /^\/api\/organizations\/[^/]+\/chat_conversations\/[^/?]+$/.test(u.pathname) ||
  /^\/api\/organizations\/[^/]+\/conversations\/[^/?]+$/.test(u.pathname)
