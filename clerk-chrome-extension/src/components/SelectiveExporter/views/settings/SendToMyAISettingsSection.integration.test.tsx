import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SendToMyAISettingsSection } from "./SendToMyAISettingsSection"

const baseProps = {
  aiEmail: "recipient@example.com",
  aiEmailFrom: "sender@example.com",
  aiEmailProvider: "agentmail",
  aiEmailApiKey: "secret-key",
  onAiEmailChange: vi.fn(),
  onAiEmailFromChange: vi.fn(),
  onAiEmailProviderChange: vi.fn(),
  onAiEmailApiKeyChange: vi.fn(),
  setStatusMessage: vi.fn()
}

describe("SendToMyAISettingsSection integration", () => {
  beforeEach(() => {
    baseProps.setStatusMessage.mockReset()
    chrome.runtime.sendMessage = vi.fn()
  })

  it("sends the real AgentMail test-email request when Test is clicked", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    chrome.runtime.sendMessage = sendMessage

    render(<SendToMyAISettingsSection {...baseProps} />)

    fireEvent.click(screen.getByRole("button", { name: /test/i }))

    await waitFor(() => {
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
          subject: "AI Handoff Test",
          text: "This is a test email from the Send to my AI extension. If your AI received this, the connection is working!"
        })
      })
    })

    await waitFor(() => {
      expect(baseProps.setStatusMessage).toHaveBeenLastCalledWith(
        "✅ Test email sent!"
      )
    })
  })

  it("surfaces proxyFetch misconfiguration errors back to the settings status", async () => {
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      status: 403,
      error: "proxyFetch host not allowed: api.example.com"
    })

    render(<SendToMyAISettingsSection {...baseProps} />)

    fireEvent.click(screen.getByRole("button", { name: /test/i }))

    await waitFor(() => {
      expect(baseProps.setStatusMessage).toHaveBeenLastCalledWith(
        "proxyFetch host not allowed: api.example.com"
      )
    })
  })
})
