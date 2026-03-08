type AgentMailAttachment = {
  filename: string
  content: string
  content_type: string
}

type AgentMailMessage = {
  to: string[]
  subject: string
  text: string
  attachments?: AgentMailAttachment[]
}

type SendAgentMailMessageParams = {
  fromAddress: string
  apiKey: string
} & AgentMailMessage

type ProxyFetchResult = {
  success?: boolean
  error?: string
  data?: {
    message?: string
  }
  status?: number
}

const buildAgentMailMessageUrl = (fromAddress: string) =>
  `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(fromAddress.trim().toLowerCase())}/messages/send`

export const sendAgentMailMessage = async ({
  fromAddress,
  apiKey,
  ...message
}: SendAgentMailMessageParams): Promise<void> => {
  const result = (await chrome.runtime.sendMessage({
    action: "proxyFetch",
    url: buildAgentMailMessageUrl(fromAddress),
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message)
  })) as ProxyFetchResult

  if (!result?.success) {
    const rawMessage =
      result?.error || result?.data?.message || ""
    const isInboxNotFound =
      typeof rawMessage === "string" &&
      /inbox\s*not\s*found/i.test(rawMessage)
    if (isInboxNotFound) {
      throw new Error(
        `Inbox not found for your "From" address (${fromAddress}). Create an inbox for this address at AgentMail (console.agentmail.to) and use an API key for that inbox.`
      )
    }
    throw new Error(
      rawMessage || `Request failed (${result?.status ?? "unknown"})`
    )
  }
}

type SendAgentMailTestEmailParams = {
  toAddress: string
  fromAddress: string
  apiKey: string
}

export const sendAgentMailTestEmail = async ({
  toAddress,
  fromAddress,
  apiKey
}: SendAgentMailTestEmailParams): Promise<void> => {
  await sendAgentMailMessage({
    fromAddress,
    apiKey,
    to: [toAddress.trim()],
    subject: "AI Handoff Test",
    text: "This is a test email from the Send to my AI extension. If your AI received this, the connection is working!"
  })
}
