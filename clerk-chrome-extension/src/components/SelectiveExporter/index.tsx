import { useEffect, useMemo, useRef, useCallback, useState } from "react"

import { detectPlatform, getPlatformLabel } from "~utils/platform"
import { requestClerkSignOut, requestClerkAuthRefresh } from "~utils/clerk"
import { openSignInPage } from "~utils/navigation"
import { debug } from "~utils/debug"

import type { SelectiveExporterProps } from "./types"
import { DARK_THEME } from "./constants"
import { Header } from "./views/Header"
import { SubHeader } from "./views/SubHeader"
import { ActionArea } from "./views/ActionArea"
import { SettingsView } from "./views/SettingsView"
import { AnalysisView } from "./views/AnalysisView"
import { ExportView } from "./views/ExportView"
import { LinkedInHelperView } from "./views/LinkedInHelperView"
import { useSettingsStorage, useExportActions, useAnalysisActions, useViewState, usePromptContainers } from "./hooks"

export const SelectiveExporter = ({ isOpen, onClose, messages, conversationKey, conversationTitle }: SelectiveExporterProps) => {
  const hasInitializedRef = useRef(false)
  const platformLabelRef = useRef(getPlatformLabel())
  const isLinkedIn = useMemo(() => detectPlatform() === "linkedin", [])
  const [authStatus, setAuthStatus] = useState<"unknown" | "signedOut" | "signedIn">("unknown")
  const [awaitingSignIn, setAwaitingSignIn] = useState(false)

  // Derive isSignedOut for minimal churn (keeps existing prop names)
  const isSignedOut = authStatus === "signedOut"

  // View state management (single enum - no boolean drift)
  const { view, goToExport, goToSettings } = useViewState()

  // Settings storage
  const {
    analysisSystemPrompt,
    followupSystemPrompt,
    personalContext,
    analysisLocked,
    followupLocked,
    setAnalysisSystemPrompt,
    setFollowupSystemPrompt,
    setPersonalContext,
    toggleAnalysisLock,
    toggleFollowupLock
  } = useSettingsStorage()

  // Get messages in order (must be before early return to maintain hook order)
  const selectedMessages = messages
  const selectedCount = selectedMessages.length

  // Export actions
  const {
    exportState,
    statusMessage,
    historyFormat,
    handleCopy,
    handleExport,
    handleSaveToDatabase,
    setHistoryFormat,
    setExportState,
    setStatusMessage,
    generateHistory,
    resetExportState
  } = useExportActions({
    messages: selectedMessages,
    historyFormat: "markdown",
    platformLabel: platformLabelRef.current,
    conversationTitle
  })

  // Analysis actions
  const {
    analysisMessages,
    analysisInput,
    handleAnalysisSend,
    setAnalysisInput,
    formatAnalysisText,
    buildAnalysisSystemPrompt,
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
  }, [conversationKey, goToExport, resetAnalysisState, resetContainers])

  // Track initialization state
  useEffect(() => {
    if (isOpen && messages.length > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true
    }
    if (!isOpen) {
      hasInitializedRef.current = false
    }
  }, [isOpen, messages.length])

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
      handleSaveToDatabase() // Auto-save on success
    } else {
      setStatusMessage("Sign in not detected yet. Please try again in a moment.")
    }
  }, [handleSaveToDatabase, setStatusMessage])

  const handleHistoryMenuChange = (value: "markdown" | "json") => {
    setHistoryFormat(value)
  }

  if (!isOpen) return null

  return (
    <div
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
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
      <Header
        title={conversationTitle || `${platformLabelRef.current} Conversation`}
        messageCount={selectedCount}
        onSettingsClick={goToSettings}
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
        {selectedCount === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: DARK_THEME.muted }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
            <p style={{ margin: 0, fontSize: "14px" }}>
              No messages found yet.
              <br />
              Once messages load, they'll appear here automatically.
            </p>
          </div>
        ) : (
          <div style={{ fontSize: "14px", lineHeight: 1.6, color: DARK_THEME.text }}>
            {view === "analysis" ? (
              <AnalysisView
                analysisMessages={analysisMessages}
                formatAnalysisText={formatAnalysisText}
              />
            ) : view === "export" ? (
              <ExportView
                historyFormat={historyFormat}
                selectedCount={selectedCount}
                exportState={exportState}
                onHistoryFormatChange={handleHistoryMenuChange}
                onCopy={handleCopy}
                onExport={handleExport}
                generateHistory={generateHistory}
              />
            ) : (
              <SettingsView
                messages={selectedMessages}
                analysisSystemPrompt={analysisSystemPrompt}
                followupSystemPrompt={followupSystemPrompt}
                personalContext={personalContext}
                analysisLocked={analysisLocked}
                followupLocked={followupLocked}
                onAnalysisPromptChange={setAnalysisSystemPrompt}
                onFollowupPromptChange={setFollowupSystemPrompt}
                onPersonalContextChange={setPersonalContext}
                onAnalysisLockToggle={toggleAnalysisLock}
                onFollowupLockToggle={toggleFollowupLock}
                buildAnalysisSystemPrompt={buildAnalysisSystemPrompt}
                onLogout={handleLogout}
                setStatusMessage={setStatusMessage}
                isSignedOut={isSignedOut}
                onSignInClick={handleSignInClick}
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
        exportState={exportState}
        statusMessage={statusMessage}
        analysisInput={analysisInput}
        isSignedOut={isSignedOut}
        awaitingSignIn={awaitingSignIn}
        onAnalysisInputChange={setAnalysisInput}
        onAnalysisSend={handleAnalysisSend}
        onBackToExport={goToExport}
        onSave={handleSaveToDatabase}
        onSignInClick={handleSignInClick}
        onConfirmSignedIn={handleConfirmSignedIn}
      />
    </div>
  )
}