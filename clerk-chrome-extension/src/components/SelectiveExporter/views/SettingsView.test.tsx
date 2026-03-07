import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SettingsView } from "./SettingsView"

const baseProps = {
  messages: [
    { text: "Short conversation", role: "user" },
    { text: "Reply", role: "assistant" }
  ],
  aiEmail: "recipient@example.com",
  aiEmailFrom: "sender@example.com",
  aiEmailProvider: "agentmail",
  aiEmailApiKey: "secret-key",
  onAiEmailChange: vi.fn(),
  onAiEmailFromChange: vi.fn(),
  onAiEmailProviderChange: vi.fn(),
  onAiEmailApiKeyChange: vi.fn(),
  onLogout: vi.fn(),
  setStatusMessage: vi.fn(),
  isSignedOut: false,
  onSignInClick: vi.fn(),
  includeHidden: false,
  onIncludeHiddenChange: vi.fn(),
  showSendToMyAI: true
}

describe("SettingsView", () => {
  it("renders the conversation depth indicator and all settings sections", () => {
    render(<SettingsView {...baseProps} />)

    expect(screen.getByText("Conversation depth")).toBeInTheDocument()
    expect(screen.getByText("Send to My AI")).toBeInTheDocument()
    expect(screen.getByText("Export Behavior")).toBeInTheDocument()
    expect(screen.getByText("Account")).toBeInTheDocument()
  })

  it("hides the Send to My AI section when the feature flag is disabled", () => {
    render(<SettingsView {...baseProps} showSendToMyAI={false} />)

    expect(screen.queryByText("Send to My AI")).not.toBeInTheDocument()
    expect(screen.getByText("Export Behavior")).toBeInTheDocument()
    expect(screen.getByText("Account")).toBeInTheDocument()
  })

  it("passes the includeHidden prop through to the export behavior checkbox", () => {
    render(<SettingsView {...baseProps} includeHidden />)

    expect(screen.getByRole("checkbox")).toBeChecked()
  })
})
