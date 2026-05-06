import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"

import { ENABLE_SEND_TO_MY_AI } from "~config/features"
import { loadRecentCaptures } from "~lib/recentCaptures"
import {
  getConversationGitHubRepos,
  getGitHubAuthUrl,
  getGitHubStatus,
  listGitHubRepos,
  saveConversationGitHubRepos,
  type GitHubRepo,
  type GitHubStatus
} from "~lib/github"
import { requestClerkAuthRefresh, requestClerkSignOut } from "~utils/clerk"
import { debug } from "~utils/debug"
import type { HistoryFormat } from "./types"
import { openSignInPage } from "~utils/navigation"
import { detectPlatform, getPlatformLabel } from "~utils/platform"

import { DARK_THEME } from "./constants"
import {
  useAnalysisActions,
  useExportActions,
  usePromptContainers,
  useSettingsStorage,
  useViewState
} from "./hooks"
import type { SelectiveExporterProps } from "./types"
import { ActionArea } from "./views/ActionArea"
import { AnalysisView } from "./views/AnalysisView"
import { ExportView } from "./views/ExportView"
import { Header } from "./views/Header"
import { LinkedInHelperView } from "./views/LinkedInHelperView"
import { MessageIndexView } from "./views/MessageIndexView"
import { SettingsView } from "./views/SettingsView"
import { SubHeader } from "./views/SubHeader"
import { YouTubeTranscriptView } from "./views/YouTubeTranscriptView"

export const SelectiveExporter = ({
  isOpen,
  onClose,
  capture,
  conversationKey,
  emptyStateMessage,
  conversations = [],
  activeConvoKey,
  onSelectConversation,
  youtubeStatus,
  youtubeErrorMessage
}: SelectiveExporterProps) => {
  const hasInitializedRef = useRef(false)
  const platformLabelRef = useRef(getPlatformLabel())
  const isLinkedIn = useMemo(() => detectPlatform() === "linkedin", [])
  const [authStatus, setAuthStatus] = useState<
    "unknown" | "signedOut" | "signedIn"
  >("unknown")
  const [awaitingSignIn, setAwaitingSignIn] = useState(false)
  const [includeHiddenMessages, setIncludeHiddenMessages] = useState(false)
  const [githubStatus, setGitHubStatus] = useState<GitHubStatus>({ connected: false })
  const [savedConversationId, setSavedConversationId] = useState<string | null>(null)
  const [availableGitHubRepos, setAvailableGitHubRepos] = useState<GitHubRepo[]>([])
  const [selectedGitHubRepoFullNames, setSelectedGitHubRepoFullNames] = useState<string[]>([])
  const [githubRepoMessage, setGitHubRepoMessage] = useState("")
  const [isGitHubRepoMenuOpen, setIsGitHubRepoMenuOpen] = useState(false)
  const [isGitHubReposLoading, setIsGitHubReposLoading] = useState(false)
  const [isSavingGitHubRepos, setIsSavingGitHubRepos] = useState(false)

  const isStructuredCapture = capture?.captureMode === "structured_conversation"
  const isYouTubeCapture = capture?.captureMode === "youtube_transcript"
  const isYouTubeSurface = isYouTubeCapture || Boolean(youtubeStatus && youtubeStatus !== "idle")
  const captureTitle =
    (isYouTubeCapture ? capture.videoTitle : capture?.title) ||
    capture?.metadata.pageTitle || `${platformLabelRef.current} Conversation`

  // Derive isSignedOut for minimal churn (keeps existing prop names)
  const isSignedOut =
    authStatus === "signedOut" && (isStructuredCapture || isYouTubeCapture)

  // View state management (single enum - no boolean drift)
  const { view, goToExport, goToSettings, goToConversationIndex } = useViewState()

  // Settings storage
  const {
    analysisSystemPrompt,
    followupSystemPrompt,
    personalContext,
    aiEmail,
    setAiEmail,
    aiEmailFrom,
    setAiEmailFrom,
    aiEmailProvider,
    setAiEmailProvider,
    aiEmailApiKey,
    setAiEmailApiKey
  } = useSettingsStorage()

  // Get messages in order (must be before early return to maintain hook order)
  const selectedMessages = useMemo(() => {
    const transcriptMessages =
      capture?.captureMode === "structured_conversation" ? capture.messages : []
    return transcriptMessages.filter(
      (m) => includeHiddenMessages || (m.role !== "system" && m.role !== "tool")
    )
  }, [capture, includeHiddenMessages])
  const selectedCount =
    capture?.captureMode === "page_markdown"
      ? 1
      : capture?.captureMode === "youtube_transcript"
        ? capture.segments.length
        : selectedMessages.length
  const summaryText =
    capture?.captureMode === "page_markdown"
      ? "Page markdown capture ready"
      : isYouTubeSurface
        ? youtubeStatus === "loading"
          ? "Transcript loading"
          : youtubeStatus === "error" || youtubeStatus === "no_transcript"
            ? "Transcript unavailable"
            : `${selectedCount} segments detected`
        : `${selectedCount} messages detected`
  const availableHistoryFormats: HistoryFormat[] =
    capture?.captureMode === "page_markdown" || isYouTubeSurface
      ? ["markdown"]
      : ["markdown", "json"]
  const canSave = isStructuredCapture || isYouTubeCapture
  const currentCaptureSourceUrl = useMemo(() => {
    if (!capture || capture.captureMode === "page_markdown") {
      return null
    }

    if (capture.captureMode === "youtube_transcript") {
      return capture.videoUrl || capture.metadata.sourceUrl
    }

    return capture.metadata.sourceUrl
  }, [capture])

  // Export actions
  const {
    exportState,
    statusMessage,
    historyFormat,
    handleCopy,
    handleExport,
    handleSendToAI,
    handleSaveToDatabase,
    setHistoryFormat,
    setExportState,
    setStatusMessage,
    generateHistory,
    resetExportState
  } = useExportActions({
    capture: capture?.captureMode === "structured_conversation"
      ? { ...capture, messages: selectedMessages }
      : capture,
    historyFormat: "markdown",
    platformLabel: platformLabelRef.current,
    conversationTitle: captureTitle,
    aiEmail,
    aiEmailFrom,
    aiEmailApiKey,
    aiEmailProvider
  })

  // Analysis actions
  const {
    analysisMessages,
    analysisInput,
    handleAnalysisSend,
    setAnalysisInput,
    formatAnalysisText,
    resetAnalysisState
  } = useAnalysisActions({
    messages: selectedMessages,
    analysisSystemPrompt,
    followupSystemPrompt,
    personalContext,
    setExportState
  })

  // Prompt containers (LinkedIn helper)
  const {
    promptContainers,
    chatEntries,
    replyNote,
    selectedPromptId,
    setReplyNote,
    handleSuggest,
    handleAddChatMessage,
    resetContainers
  } = usePromptContainers({ messages: selectedMessages })

  // Reset state when conversation changes
  useEffect(() => {
    hasInitializedRef.current = false
    goToExport()
    resetAnalysisState()
    resetContainers()
    setSavedConversationId(null)
    setAvailableGitHubRepos([])
    setSelectedGitHubRepoFullNames([])
    setGitHubRepoMessage("")
    setIsGitHubRepoMenuOpen(false)
    setIsGitHubReposLoading(false)
    setIsSavingGitHubRepos(false)
  }, [conversationKey, goToExport, resetAnalysisState, resetContainers])

  // Track initialization state
  useEffect(() => {
    if (isOpen && selectedCount > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true
    }
    if (!isOpen) {
      hasInitializedRef.current = false
    }
  }, [isOpen, selectedCount])

  const handleClose = () => {
    onClose()
  }

  const handleLogout = useCallback(() => requestClerkSignOut(), [])

  // Manage body padding when drawer opens/closes
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.paddingRight = "420px"
    } else {
      document.documentElement.style.paddingRight = ""
    }

    return () => {
      document.documentElement.style.paddingRight = ""
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      resetExportState()
    }
  }, [isOpen, resetExportState])

  // Auth probe: check if user is signed in when drawer opens
  useEffect(() => {
    if (!isOpen) return

    debug.any(["auth", "clerk", "panel"], "authProbe: start")
    requestClerkAuthRefresh()
      .then((result) => {
        debug.any(["auth", "clerk", "panel"], "authProbe: response", {
          hasSession: result.hasSession,
          error: result.error ?? null
        })
        setAuthStatus(result.hasSession ? "signedIn" : "signedOut")
      })
      .catch((e) => {
        debug.any(["auth", "clerk", "panel"], "authProbe: error", {
          error: e instanceof Error ? e.message : String(e)
        })
      })
  }, [isOpen])

  const handleSignInClick = useCallback(() => {
    openSignInPage()
    setAwaitingSignIn(true)
  }, [])

  const handleConfirmSignedIn = useCallback(async () => {
    const result = await requestClerkAuthRefresh()
    // Always derive state from what background reports
    setAuthStatus(result.hasSession ? "signedIn" : "signedOut")
    setAwaitingSignIn(false)

    if (result.hasSession) {
      const conversationId = await handleSaveToDatabase()
      if (conversationId) {
        setSavedConversationId(conversationId)
      }
    } else {
      setStatusMessage(
        "Sign in not detected yet. Please try again in a moment."
      )
    }
  }, [handleSaveToDatabase, setStatusMessage])

  const handleHistoryMenuChange = (value: "markdown" | "json") => {
    setHistoryFormat(value)
  }

  const handleSave = useCallback(async () => {
    const conversationId = await handleSaveToDatabase()
    if (conversationId) {
      setSavedConversationId(conversationId)
    }
    return conversationId
  }, [handleSaveToDatabase])

  const refreshGitHubStatus = useCallback(async () => {
    if (authStatus !== "signedIn") {
      setGitHubStatus({ connected: false })
      return
    }

    try {
      const nextStatus = await getGitHubStatus()
      setGitHubStatus(nextStatus)
    } catch {
      setGitHubStatus({ connected: false })
    }
  }, [authStatus])

  useEffect(() => {
    if (!isOpen) return
    void refreshGitHubStatus()
  }, [isOpen, refreshGitHubStatus])

  useEffect(() => {
    if (authStatus !== "signedIn") return

    const handleFocus = () => {
      void refreshGitHubStatus()
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [authStatus, refreshGitHubStatus])

  const handleGitHubClick = useCallback(async () => {
    if (authStatus !== "signedIn") {
      handleSignInClick()
      return
    }

    if (githubStatus.connected) {
      return
    }

    const url = await getGitHubAuthUrl()

    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url })
    } else {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }, [authStatus, githubStatus.connected, handleSignInClick])

  useEffect(() => {
    if (
      !isOpen ||
      authStatus !== "signedIn" ||
      !githubStatus.connected ||
      !canSave ||
      !currentCaptureSourceUrl ||
      !capture
    ) {
      setAvailableGitHubRepos([])
      setSelectedGitHubRepoFullNames([])
      setGitHubRepoMessage("")
      setIsGitHubRepoMenuOpen(false)
      setIsGitHubReposLoading(false)
      return
    }

    let cancelled = false

    const loadGitHubRepoState = async () => {
      setIsGitHubReposLoading(true)
      setGitHubRepoMessage("")

      try {
        const [repos, recentCaptures] = await Promise.all([
          listGitHubRepos(),
          loadRecentCaptures()
        ])

        if (cancelled) return

        setAvailableGitHubRepos(repos)

        const matchingCapture = recentCaptures.find(
          (recentCapture) =>
            recentCapture.captureMode === capture.captureMode &&
            recentCapture.sourceUrl === currentCaptureSourceUrl
        )
        const conversationId = matchingCapture?.id ?? null

        setSavedConversationId(conversationId)

        if (!conversationId) {
          setSelectedGitHubRepoFullNames([])
          return
        }

        const selectedRepos = await getConversationGitHubRepos(conversationId)

        if (cancelled) return

        setSelectedGitHubRepoFullNames(selectedRepos)
      } catch (error) {
        if (cancelled) return

        setAvailableGitHubRepos([])
        setSelectedGitHubRepoFullNames([])
        setGitHubRepoMessage(
          error instanceof Error ? error.message : "Failed to load GitHub repos."
        )
      } finally {
        if (!cancelled) {
          setIsGitHubReposLoading(false)
        }
      }
    }

    void loadGitHubRepoState()

    return () => {
      cancelled = true
    }
  }, [
    authStatus,
    canSave,
    capture,
    currentCaptureSourceUrl,
    githubStatus.connected,
    isOpen
  ])

  const handleToggleGitHubRepo = useCallback(
    async (repoFullName: string) => {
      if (
        authStatus !== "signedIn" ||
        !githubStatus.connected ||
        !canSave ||
        isSavingGitHubRepos
      ) {
        return
      }

      setIsSavingGitHubRepos(true)
      setGitHubRepoMessage("")

      try {
        let conversationId = savedConversationId

        if (!conversationId) {
          setGitHubRepoMessage("Saving conversation before updating GitHub repos...")
          conversationId = await handleSave()

          if (!conversationId) {
            setGitHubRepoMessage("Save this conversation first to choose GitHub repos.")
            return
          }
        }

        const nextSelection = selectedGitHubRepoFullNames.includes(repoFullName)
          ? selectedGitHubRepoFullNames.filter((value) => value !== repoFullName)
          : [...selectedGitHubRepoFullNames, repoFullName]

        const savedRepos = await saveConversationGitHubRepos(
          conversationId,
          nextSelection
        )

        setSavedConversationId(conversationId)
        setSelectedGitHubRepoFullNames(savedRepos)
        setGitHubRepoMessage("")
      } catch (error) {
        setGitHubRepoMessage(
          error instanceof Error ? error.message : "Failed to save GitHub repos."
        )
      } finally {
        setIsSavingGitHubRepos(false)
      }
    },
    [
      authStatus,
      canSave,
      githubStatus.connected,
      handleSave,
      isSavingGitHubRepos,
      savedConversationId,
      selectedGitHubRepoFullNames
    ]
  )

  if (!isOpen) return null

  return (
    <div
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onKeyPress={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "420px", // layout.chat_panel_width
        backgroundColor: DARK_THEME.background,
        color: DARK_THEME.text,
        boxShadow: DARK_THEME.panelShadow,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
      <Header
        title={captureTitle}
        summaryText={summaryText}
        onSettingsClick={goToSettings}
        onIndexClick={goToConversationIndex}
        onClose={handleClose}
        showAuthBanner={isSignedOut}
        onSignInClick={handleSignInClick}
      />

      <SubHeader view={view} onBack={goToExport} />

      {/* Preview Area */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px",
          backgroundColor: DARK_THEME.panel
        }}>
        <style>{`
          .analysis-markdown h1 { font-size: 18px; margin: 10px 0 6px; font-weight: 700; }
          .analysis-markdown h2 { font-size: 16px; margin: 8px 0 4px; font-weight: 700; }
          .analysis-markdown h3 { font-size: 14px; margin: 6px 0 4px; font-weight: 700; }
          .analysis-markdown p { margin: 6px 0; }
          .analysis-markdown ul { margin: 6px 0 6px 18px; padding: 0; }
          .analysis-markdown li { list-style: disc; margin: 4px 0; }
          .analysis-markdown strong { font-weight: 700; }
        `}</style>
        {!capture && !isYouTubeSurface ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: DARK_THEME.muted
            }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
            <p style={{ margin: 0, fontSize: "14px" }}>
              {emptyStateMessage.split("\n").map((line, index) => (
                <Fragment key={`${line}-${index}`}>
                  {index > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </p>
          </div>
        ) : (
          <div
            style={{
              fontSize: "14px",
              lineHeight: 1.6,
              color: DARK_THEME.text
            }}>
            {view === "youtube_transcript" ? (
              <YouTubeTranscriptView
                segments={capture?.captureMode === "youtube_transcript" ? capture.segments : []}
                status={youtubeStatus ?? "idle"}
                errorMessage={youtubeErrorMessage}
                videoId={
                  capture?.captureMode === "youtube_transcript"
                    ? capture.videoId
                    : undefined
                }
                videoTitle={
                  capture?.captureMode === "youtube_transcript"
                    ? capture.videoTitle
                    : undefined
                }
                videoUrl={
                  capture?.captureMode === "youtube_transcript"
                    ? capture.videoUrl
                    : undefined
                }
              />
            ) : view === "analysis" ? (
              <AnalysisView
                analysisMessages={analysisMessages}
                formatAnalysisText={formatAnalysisText}
              />
            ) : view === "conversation_index" ? (
              <MessageIndexView
                conversations={conversations}
                activeConvoKey={activeConvoKey}
                onSelect={(key) => {
                  onSelectConversation?.(key)
                  goToExport()
                }}
              />
            ) : view === "export" ? (
              <ExportView
                historyFormat={historyFormat}
                availableHistoryFormats={availableHistoryFormats}
                selectedCount={selectedCount}
                exportState={exportState}
                onHistoryFormatChange={handleHistoryMenuChange}
                onCopy={handleCopy}
                onExport={handleExport}
                onSendToAI={handleSendToAI}
                showSendToMyAI={ENABLE_SEND_TO_MY_AI && isStructuredCapture}
                generateHistory={generateHistory}
                previewContent={
                  isYouTubeSurface ? (
                    <YouTubeTranscriptView
                      segments={capture?.captureMode === "youtube_transcript" ? capture.segments : []}
                      status={youtubeStatus ?? "idle"}
                      errorMessage={youtubeErrorMessage}
                      videoId={capture?.captureMode === "youtube_transcript" ? capture.videoId : undefined}
                      videoTitle={capture?.captureMode === "youtube_transcript" ? capture.videoTitle : undefined}
                      videoUrl={capture?.captureMode === "youtube_transcript" ? capture.videoUrl : undefined}
                    />
                  ) : undefined
                }
              />
            ) : (
              <SettingsView
                messages={selectedMessages}
                aiEmail={aiEmail}
                onAiEmailChange={setAiEmail}
                aiEmailFrom={aiEmailFrom}
                onAiEmailFromChange={setAiEmailFrom}
                aiEmailProvider={aiEmailProvider}
                onAiEmailProviderChange={setAiEmailProvider}
                aiEmailApiKey={aiEmailApiKey}
                onAiEmailApiKeyChange={setAiEmailApiKey}
                onLogout={handleLogout}
                setStatusMessage={setStatusMessage}
                isSignedOut={isSignedOut}
                onSignInClick={handleSignInClick}
                includeHidden={includeHiddenMessages}
                onIncludeHiddenChange={setIncludeHiddenMessages}
                showSendToMyAI={ENABLE_SEND_TO_MY_AI}
              />
            )}
          </div>
        )}
      </div>

      {/* LinkedIn Response Helper */}
      {isLinkedIn && view === "export" && promptContainers.length > 0 && (
        <LinkedInHelperView
          chatEntries={chatEntries}
          replyNote={replyNote}
          promptContainers={promptContainers}
          selectedPromptId={selectedPromptId}
          onReplyNoteChange={setReplyNote}
          onAddChatMessage={handleAddChatMessage}
          onSuggest={handleSuggest}
        />
      )}

      <ActionArea
        view={view}
        selectedCount={selectedCount}
        canSave={canSave}
        exportState={exportState}
        statusMessage={statusMessage}
        analysisInput={analysisInput}
        isSignedOut={isSignedOut}
        awaitingSignIn={awaitingSignIn}
        githubButtonLabel={
          authStatus === "signedIn"
            ? githubStatus.connected
              ? undefined
              : "Connect GitHub"
            : undefined
        }
        githubConnected={githubStatus.connected}
        onGitHubClick={handleGitHubClick}
        githubRepos={availableGitHubRepos}
        selectedGitHubRepoFullNames={selectedGitHubRepoFullNames}
        githubRepoMenuOpen={isGitHubRepoMenuOpen}
        githubReposLoading={isGitHubReposLoading}
        githubRepoSelectionBusy={isSavingGitHubRepos}
        githubRepoMessage={githubRepoMessage}
        onGitHubRepoMenuToggle={() =>
          setIsGitHubRepoMenuOpen((currentValue) => !currentValue)
        }
        onGitHubRepoToggle={handleToggleGitHubRepo}
        onAnalysisInputChange={setAnalysisInput}
        onAnalysisSend={handleAnalysisSend}
        onBackToExport={goToExport}
        onSave={handleSave}
        onSignInClick={handleSignInClick}
        onConfirmSignedIn={handleConfirmSignedIn}
      />
    </div>
  )
}
