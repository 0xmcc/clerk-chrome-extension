import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ExportCapture } from "~lib/capture"

const handleCopy = vi.fn()
const handleExport = vi.fn()
const handleSaveToDatabase = vi.fn()

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
  detectPlatform: vi.fn().mockReturnValue("youtube"),
  getPlatformLabel: vi.fn().mockReturnValue("YouTube")
}))

vi.mock("./hooks", () => ({
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
    handleCopy,
    handleExport,
    handleSendToAI: vi.fn(),
    handleSaveToDatabase,
    setHistoryFormat: vi.fn(),
    setExportState: vi.fn(),
    setStatusMessage: vi.fn(),
    generateHistory: vi.fn().mockReturnValue(""),
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

vi.mock("./views/YouTubeTranscriptView", () => ({
  YouTubeTranscriptView: ({
    segments,
    status
  }: {
    segments: Array<{ text: string }>
    status: string
  }) => (
    <div data-testid="youtube-transcript-preview">
      {status}:{segments.length}:{segments[0]?.text}
    </div>
  )
}))

import { SelectiveExporter } from "./index"

const youtubeTranscriptCapture: ExportCapture = {
  captureMode: "youtube_transcript",
  conversationKey: "youtube:abc123",
  videoId: "abc123",
  videoTitle: "Jensen Huang Interview",
  videoUrl: "https://www.youtube.com/watch?v=abc123",
  segments: [
    { seconds: 30, text: "Intro line" },
    { seconds: 60, text: "Second line" }
  ],
  metadata: {
    sourceUrl: "https://www.youtube.com/watch?v=abc123",
    pageTitle: "Jensen Huang Interview - YouTube",
    capturedAt: "2026-03-08T03:00:00.000Z",
    platform: "YouTube",
    surface: "youtube_watch"
  }
}

describe("SelectiveExporter YouTube export surface", () => {
  it("shows transcript content on the standard export screen with copy, export, and save actions", () => {
    render(
      <SelectiveExporter
        isOpen
        onClose={vi.fn()}
        capture={youtubeTranscriptCapture}
        conversationKey={youtubeTranscriptCapture.conversationKey}
        emptyStateMessage="No transcript"
        conversations={[]}
        youtubeStatus="ready"
      />
    )

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
    expect(screen.getByTestId("youtube-transcript-preview")).toHaveTextContent(
      "ready:2:Intro line"
    )
    expect(screen.getByText("2 segments detected")).toBeInTheDocument()
    expect(screen.queryByText("Back to export tools")).not.toBeInTheDocument()
  })
})
