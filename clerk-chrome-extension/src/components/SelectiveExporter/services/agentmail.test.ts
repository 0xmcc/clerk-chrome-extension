import { describe, expect, it, vi } from "vitest"

import { sendAgentMailMessage, sendAgentMailTestEmail } from "./agentmail"

describe("agentmail service", () => {
  it("sends AgentMail messages through proxyFetch with the expected payload", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    chrome.runtime.sendMessage = sendMessage

    await sendAgentMailMessage({
      fromAddress: " sender@example.com ",
      apiKey: "secret-key",
      to: ["recipient@example.com"],
      subject: "Subject line",
      text: "Body text"
    })

    expect(sendMessage).toHaveBeenCalledWith({
      action: "proxyFetch",
      url: "https://api.agentmail.to/v0/inboxes/sender%40example.com/messages/send",
      method: "POST",
      headers: {
        Authorization: "Bearer secret-key",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: ["recipient@example.com"],
        subject: "Subject line",
        text: "Body text"
      })
    })
  })

  it("throws the proxy error when the request fails", async () => {
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      error: "Bad API key",
      status: 401
    })

    await expect(
      sendAgentMailMessage({
        fromAddress: "sender@example.com",
        apiKey: "secret-key",
        to: ["recipient@example.com"],
        subject: "Subject line",
        text: "Body text"
      })
    ).rejects.toThrow("Bad API key")
  })

  it("falls back to the response data message when no top-level error exists", async () => {
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      data: { message: "Mailbox not found" },
      status: 404
    })

    await expect(
      sendAgentMailMessage({
        fromAddress: "sender@example.com",
        apiKey: "secret-key",
        to: ["recipient@example.com"],
        subject: "Subject line",
        text: "Body text"
      })
    ).rejects.toThrow("Mailbox not found")
  })

  it("normalizes From address to lowercase in the inbox URL (API is case-sensitive)", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    chrome.runtime.sendMessage = sendMessage

    await sendAgentMailMessage({
      fromAddress: "Markobot@agentmail.to",
      apiKey: "secret-key",
      to: ["other@example.com"],
      subject: "Subject",
      text: "Body"
    })

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://api.agentmail.to/v0/inboxes/markobot%40agentmail.to/messages/send"
      })
    )
  })

  it("throws a friendly error when the API returns Inbox not found", async () => {
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      error: "Inbox not found",
      status: 404
    })

    await expect(
      sendAgentMailMessage({
        fromAddress: "me@agentmail.to",
        apiKey: "secret-key",
        to: ["markobot@agentmail.to"],
        subject: "Subject",
        text: "Body"
      })
    ).rejects.toThrow(
      /Inbox not found for your "From" address \(me@agentmail\.to\)/
    )
  })

  it("sends the standard test email payload and trims the recipient address", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    chrome.runtime.sendMessage = sendMessage

    await sendAgentMailTestEmail({
      toAddress: " recipient@example.com ",
      fromAddress: "sender@example.com",
      apiKey: "secret-key"
    })

    expect(sendMessage).toHaveBeenCalledTimes(1)

    const request = sendMessage.mock.calls[0][0]
    expect(JSON.parse(request.body)).toEqual({
      to: ["recipient@example.com"],
      subject: "AI Handoff Test",
      text: "This is a test email from the Send to my AI extension. If your AI received this, the connection is working!"
    })
  })
})
