import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ExportCapture } from "~lib/capture"

vi.mock("~utils/clerk", () => ({
  requestClerkAuthRefresh: vi.fn().mockResolvedValue({ hasSession: true }),
  requestClerkSignOut: vi.fn(),
  requestClerkToken: vi.fn()
}))

vi.mock("~utils/navigation", () => ({
  openSignInPage: vi.fn()
}))

vi.mock("~lib/github", () => ({
  getGitHubStatus: vi.fn().mockResolvedValue({ connected: false }),
  getGitHubAuthUrl: vi.fn().mockResolvedValue("https://github.com/login/oauth/authorize?state=abc")
}))

vi.mock("~utils/debug", () => ({
  debug: {
    any: vi.fn()
  }
}))

vi.mock("~utils/platform", () => ({
  detectPlatform: vi.fn().mockReturnValue("claude"),
  getPlatformLabel: vi.fn().mockReturnValue("Claude")
}))

vi.mock("../hooks", () => ({
  useSettingsStorage: () => ({
    analysisSystemPrompt: "",
    followupSystemPrompt: "",
    personalContext: "",
    aiEmail: "",
    setAiEmail: vi.fn(),
    aiEmailFrom: "",
    setAiEmailFrom: vi.fn(),
    aiEmailProvider: "",
    setAiEmailProvider: vi.fn(),
    aiEmailApiKey: "",
    setAiEmailApiKey: vi.fn()
  }),
  useExportActions: () => ({
    exportState: "idle",
    statusMessage: "",
    historyFormat: "markdown",
    handleCopy: vi.fn(),
    handleExport: vi.fn(),
    handleSendToAI: vi.fn(),
    handleSaveToDatabase: vi.fn(),
    setHistoryFormat: vi.fn(),
    setExportState: vi.fn(),
    setStatusMessage: vi.fn(),
    generateHistory: vi.fn().mockReturnValue("# History"),
    resetExportState: vi.fn()
  }),
  useAnalysisActions: () => ({
    analysisMessages: [],
    analysisInput: "",
    handleAnalysisSend: vi.fn(),
    setAnalysisInput: vi.fn(),
    formatAnalysisText: (text: string) => text,
    resetAnalysisState: vi.fn()
  }),
  usePromptContainers: () => ({
    promptContainers: [],
    chatEntries: [],
    replyNote: "",
    selectedPromptId: null,
    setReplyNote: vi.fn(),
    handleSuggest: vi.fn(),
    handleAddChatMessage: vi.fn(),
    resetContainers: vi.fn()
  }),
  useViewState: () => ({
    view: "export",
    goToExport: vi.fn(),
    goToSettings: vi.fn(),
    goToAnalysis: vi.fn(),
    goToConversationIndex: vi.fn(),
    goToYouTubeTranscript: vi.fn(),
    setView: vi.fn()
  })
}))

import { SelectiveExporter } from "../index"

const capture: ExportCapture = {
  captureMode: "structured_conversation",
  conversationKey: "claude:entry-point",
  title: "Roadmap notes",
  messages: [
    {
      id: "m1",
      role: "user",
      text: "Hello",
      timestamp: "2026-03-26T00:00:00.000Z",
      isHidden: false
    }
  ],
  metadata: {
    sourceUrl: "https://claude.ai/chat/123",
    pageTitle: "Roadmap notes - Claude",
    capturedAt: "2026-03-26T00:00:00.000Z",
    platform: "Claude",
    surface: "conversation"
  }
}

describe("SelectiveExporter GitHub entry point", () => {
  it("shows a GitHub connect action on the main export surface", async () => {
    render(
      <SelectiveExporter
        isOpen
        onClose={vi.fn()}
        capture={capture}
        conversationKey={capture.conversationKey}
        emptyStateMessage="No capture"
        conversations={[]}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Connect GitHub" })
      ).toBeInTheDocument()
    })
  })
})
