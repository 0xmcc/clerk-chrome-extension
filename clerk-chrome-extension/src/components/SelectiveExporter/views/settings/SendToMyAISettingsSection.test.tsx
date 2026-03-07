import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useSendToMyAITest } from "../../hooks/useSendToMyAITest"
import { SendToMyAISettingsSection } from "./SendToMyAISettingsSection"

vi.mock("../../hooks/useSendToMyAITest", () => ({
  useSendToMyAITest: vi.fn()
}))

const mockedUseSendToMyAITest = vi.mocked(useSendToMyAITest)
const sendTestEmail = vi.fn()

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

describe("SendToMyAISettingsSection", () => {
  beforeEach(() => {
    sendTestEmail.mockReset()
    mockedUseSendToMyAITest.mockReturnValue({
      isTesting: false,
      sendTestEmail
    })
  })

  it("renders the Send to My AI settings controls", () => {
    render(<SendToMyAISettingsSection {...baseProps} />)

    expect(screen.getByText("Send to My AI")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("your-ai@agentmail.to")).toHaveValue(
      "recipient@example.com"
    )
    expect(screen.getByPlaceholderText("you@agentmail.to")).toHaveValue(
      "sender@example.com"
    )
    expect(screen.getByPlaceholderText("am_xxx...")).toHaveValue("secret-key")
    expect(screen.getByRole("combobox")).toHaveValue("agentmail")
    expect(
      screen.getByRole("link", { name: /AgentMail API key/i })
    ).toHaveAttribute("href", "https://console.agentmail.to/dashboard/api-keys")
  })

  it("forwards My AI email changes", () => {
    render(<SendToMyAISettingsSection {...baseProps} />)

    fireEvent.change(screen.getByPlaceholderText("your-ai@agentmail.to"), {
      target: { value: "next@example.com" }
    })

    expect(baseProps.onAiEmailChange).toHaveBeenCalledWith("next@example.com")
  })

  it("forwards From email and provider changes", () => {
    render(<SendToMyAISettingsSection {...baseProps} />)

    fireEvent.change(screen.getByPlaceholderText("you@agentmail.to"), {
      target: { value: "from-next@example.com" }
    })
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "agentmail" }
    })

    expect(baseProps.onAiEmailFromChange).toHaveBeenCalledWith(
      "from-next@example.com"
    )
    expect(baseProps.onAiEmailProviderChange).toHaveBeenCalledWith("agentmail")
  })

  it("forwards API key changes", () => {
    render(<SendToMyAISettingsSection {...baseProps} />)

    fireEvent.change(screen.getByPlaceholderText("am_xxx..."), {
      target: { value: "new-secret" }
    })

    expect(baseProps.onAiEmailApiKeyChange).toHaveBeenCalledWith("new-secret")
  })

  it("passes the current values to the test-email hook when clicking Test", () => {
    render(<SendToMyAISettingsSection {...baseProps} />)

    fireEvent.click(screen.getByRole("button", { name: /test/i }))

    expect(sendTestEmail).toHaveBeenCalledWith({
      aiEmail: "recipient@example.com",
      aiEmailFrom: "sender@example.com",
      aiEmailApiKey: "secret-key"
    })
  })

  it("shows a loading state while a test email is being sent", () => {
    mockedUseSendToMyAITest.mockReturnValue({
      isTesting: true,
      sendTestEmail
    })

    render(<SendToMyAISettingsSection {...baseProps} />)

    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled()
  })
})
