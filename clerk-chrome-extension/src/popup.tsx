import { ClerkProvider, useUser } from "@clerk/chrome-extension"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"

import { API_BASE_URL } from "~config/api"
import { buildCaptureExportPayload, getCaptureCount } from "~lib/exportCapture"
import { loadRecentCaptures, saveRecentCapture } from "~lib/recentCaptures"
import {
  buildFallbackPageContext,
  POPUP_GET_CAPTURE,
  POPUP_GET_PAGE_CONTEXT,
  POPUP_RECENT_CAPTURES_KEY,
  type PopupGetCaptureResponse,
  type PopupGetPageContextResponse,
  type PopupPageContext,
  type PopupSerializableCapture,
  type RecentCaptureRecord
} from "~popupBridge"
import { requestClerkToken } from "~utils/clerk"
import { openSignInPage } from "~utils/navigation"

import "~style.css"

const PUBLISHABLE_KEY = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const SYNC_HOST = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST
const POPUP_URL = chrome.runtime.getURL("popup.html")

if (!PUBLISHABLE_KEY) {
  throw new Error("Please add the PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY to the .env.development file")
}

if (!SYNC_HOST) {
  throw new Error("Please add PLASMO_PUBLIC_CLERK_SYNC_HOST to the .env.development file")
}

const WORKSPACE_URL = new URL("/workspace", `${SYNC_HOST.replace(/\/$/, "")}/`).toString()
const RECENT_CAPTURES_URL = new URL(
  "/workspace?view=recent",
  `${SYNC_HOST.replace(/\/$/, "")}/`
).toString()

type SaveStatus = "idle" | "loading" | "success" | "error"
type PopupActionKind = "save" | "workspace" | "signin" | "recent" | "loading"

interface PopupAction {
  kind: PopupActionKind
  label: string
}

interface SaveState {
  status: SaveStatus
  message: string
}

const INITIAL_PAGE_CONTEXT: PopupPageContext = {
  url: "",
  pageTitle: "",
  title: "Checking current page…",
  platform: "unknown",
  sourceLabel: "MomentumAI",
  surfaceLabel: "Live capture",
  supported: false,
  captureActive: false,
  captureReady: false,
  itemCount: 0,
  itemLabel: "messages",
  status: "waiting",
  statusLabel: "Loading current tab",
  statusDetail: "Reading the page, account, and recent save state."
}

const SOURCE_PALETTE: Record<
  PopupPageContext["platform"],
  { accent: string; accentSoft: string; accentStrong: string; accentRgb: string }
> = {
  chatgpt: {
    accent: "#6ff7c8",
    accentSoft: "rgba(111, 247, 200, 0.16)",
    accentStrong: "rgba(111, 247, 200, 0.34)",
    accentRgb: "111 247 200"
  },
  claude: {
    accent: "#ffbe7a",
    accentSoft: "rgba(255, 190, 122, 0.16)",
    accentStrong: "rgba(255, 190, 122, 0.32)",
    accentRgb: "255 190 122"
  },
  youtube: {
    accent: "#ff8b77",
    accentSoft: "rgba(255, 139, 119, 0.16)",
    accentStrong: "rgba(255, 139, 119, 0.3)",
    accentRgb: "255 139 119"
  },
  linkedin: {
    accent: "#7cb6ff",
    accentSoft: "rgba(124, 182, 255, 0.16)",
    accentStrong: "rgba(124, 182, 255, 0.3)",
    accentRgb: "124 182 255"
  },
  unknown: {
    accent: "#9aa7bf",
    accentSoft: "rgba(154, 167, 191, 0.16)",
    accentStrong: "rgba(154, 167, 191, 0.3)",
    accentRgb: "154 167 191"
  }
}

const queryActiveTab = async (): Promise<chrome.tabs.Tab | null> =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] ?? null)
    })
  })

const sendMessageToTab = async <T,>(
  tabId: number,
  message: Record<string, unknown>
): Promise<T> =>
  new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve(response as T)
    })
  })

const formatRelativeTime = (value?: string | null): string => {
  if (!value) return "Never"

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return "Recently"

  const diffMs = Date.now() - parsed
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes <= 0) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(parsed).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  })
}

const pluralize = (count: number, label: string) =>
  `${count} ${label}${count === 1 ? "" : "s"}`

const resolvePrimaryAction = ({
  authLoaded,
  isSignedIn,
  pageContext,
  recentCaptures,
  saveState
}: {
  authLoaded: boolean
  isSignedIn: boolean
  pageContext: PopupPageContext
  recentCaptures: RecentCaptureRecord[]
  saveState: SaveState
}): PopupAction => {
  if (!authLoaded) {
    return { kind: "loading", label: "Checking account…" }
  }

  if (saveState.status === "success") {
    return recentCaptures.length > 0
      ? { kind: "recent", label: "View recent captures" }
      : { kind: "workspace", label: "Open workspace" }
  }

  if (pageContext.captureReady) {
    if (isSignedIn) {
      return {
        kind: "save",
        label:
          pageContext.captureMode === "youtube_transcript"
            ? "Save transcript"
            : "Save current conversation"
      }
    }

    return { kind: "signin", label: "Sign in to save" }
  }

  if (!isSignedIn) {
    return { kind: "signin", label: "Sign in to save" }
  }

  if (recentCaptures.length > 0) {
    return { kind: "recent", label: "View recent captures" }
  }

  return { kind: "workspace", label: "Open workspace" }
}

const resolveSecondaryAction = (primaryAction: PopupAction): PopupAction | null => {
  if (primaryAction.kind === "workspace" || primaryAction.kind === "loading") {
    return null
  }

  return { kind: "workspace", label: "Open workspace" }
}

const InfoTile = ({
  label,
  value,
  meta,
  tone = "neutral"
}: {
  label: string
  value: ReactNode
  meta: ReactNode
  tone?: "neutral" | "ready" | "warning" | "error"
}) => (
  <div className={`momentum-info-card momentum-info-card--${tone}`}>
    <div className="momentum-info-label">{label}</div>
    <div className="momentum-info-value">{value}</div>
    <div className="momentum-info-meta">{meta}</div>
  </div>
)

const AccountIdentity = ({
  email,
  initials,
  signedIn
}: {
  email: string
  initials: string
  signedIn: boolean
}) => (
  <div className="momentum-account">
    <div className={`momentum-account-avatar ${signedIn ? "is-live" : ""}`}>{initials}</div>
    <span>{email}</span>
  </div>
)

function PopupSurface() {
  const { isLoaded: authLoaded, isSignedIn, user } = useUser()
  const refreshInFlightRef = useRef(false)

  const [pageContext, setPageContext] = useState<PopupPageContext>(INITIAL_PAGE_CONTEXT)
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null)
  const [recentCaptures, setRecentCaptures] = useState<RecentCaptureRecord[]>([])
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message: ""
  })
  const [isRefreshingPage, setIsRefreshingPage] = useState(false)

  const refreshPageContext = useCallback(async () => {
    if (refreshInFlightRef.current) return

    refreshInFlightRef.current = true
    setIsRefreshingPage(true)

    try {
      const tab = await queryActiveTab()
      setActiveTab(tab)

      const fallbackContext = buildFallbackPageContext(tab?.url, tab?.title)
      if (!tab?.id) {
        setPageContext(fallbackContext)
        return
      }

      try {
        const response = await sendMessageToTab<PopupGetPageContextResponse>(tab.id, {
          type: POPUP_GET_PAGE_CONTEXT
        })

        setPageContext(response?.ok ? response.context : fallbackContext)
      } catch {
        setPageContext(fallbackContext)
      }
    } finally {
      refreshInFlightRef.current = false
      setIsRefreshingPage(false)
    }
  }, [])

  const loadRecents = useCallback(async () => {
    setRecentCaptures(await loadRecentCaptures())
  }, [])

  useEffect(() => {
    void refreshPageContext()
    void loadRecents()

    const interval = window.setInterval(() => {
      void refreshPageContext()
    }, 2500)

    const handleFocus = () => {
      void refreshPageContext()
    }

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local" || !changes[POPUP_RECENT_CAPTURES_KEY]) return
      void loadRecents()
    }

    window.addEventListener("focus", handleFocus)
    chrome.storage?.onChanged?.addListener(handleStorageChange)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
      chrome.storage?.onChanged?.removeListener(handleStorageChange)
    }
  }, [loadRecents, refreshPageContext])

  useEffect(() => {
    if (saveState.status === "idle" || saveState.status === "loading") return

    const timer = window.setTimeout(() => {
      setSaveState((current) =>
        current.status === "loading" ? current : { status: "idle", message: "" }
      )
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [saveState])

  useEffect(() => {
    setSaveState((current) =>
      current.status === "loading" ? current : { status: "idle", message: "" }
    )
  }, [pageContext.url])

  const primaryAction = useMemo(
    () =>
      resolvePrimaryAction({
        authLoaded,
        isSignedIn: !!isSignedIn,
        pageContext,
        recentCaptures,
        saveState
      }),
    [authLoaded, isSignedIn, pageContext, recentCaptures, saveState]
  )

  const secondaryAction = useMemo(
    () => resolveSecondaryAction(primaryAction),
    [primaryAction]
  )

  const palette = SOURCE_PALETTE[pageContext.platform] || SOURCE_PALETTE.unknown
  const themeStyle = useMemo(
    () =>
      ({
        "--momentum-accent": palette.accent,
        "--momentum-accent-soft": palette.accentSoft,
        "--momentum-accent-strong": palette.accentStrong,
        "--momentum-accent-rgb": palette.accentRgb
      }) as CSSProperties,
    [palette]
  )

  const accountEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.fullName ||
    user?.firstName ||
    "Sign in required"
  const accountInitials = (
    user?.firstName?.[0] ||
    user?.primaryEmailAddress?.emailAddress?.[0] ||
    "M"
  ).toUpperCase()
  const lastSavedCapture = recentCaptures[0]

  const heroDetail = useMemo(() => {
    if (pageContext.captureReady && !isSignedIn && authLoaded) {
      return "This context is ready. Sign in once and it will save instantly."
    }

    if (saveState.status === "loading") {
      return "Saving the latest context to your workspace."
    }

    return pageContext.statusDetail
  }, [authLoaded, isSignedIn, pageContext, saveState.status])

  const captureValue = pageContext.captureReady
    ? `${pluralize(pageContext.itemCount, pageContext.itemLabel.slice(0, -1))} ready`
    : pageContext.captureActive
      ? "Watching this page"
      : pageContext.supported
        ? "Waiting for context"
        : "Not supported here"

  const accountMeta = !authLoaded
    ? "Checking whether your account is connected."
    : isSignedIn
      ? "Signed in and ready to sync."
      : "Sign in once to save and revisit recent captures."

  const lastSaveValue = lastSavedCapture?.title || "Nothing saved yet"
  const lastSaveMeta = lastSavedCapture
    ? `${lastSavedCapture.source} · ${formatRelativeTime(lastSavedCapture.savedAt)}`
    : "Your latest successful save will appear here."

  const recentPreview = recentCaptures.slice(0, 2)

  const openWorkspace = useCallback((recent = false) => {
    chrome.tabs.create({ url: recent ? RECENT_CAPTURES_URL : WORKSPACE_URL })
  }, [])

  const handleSaveCurrent = useCallback(async () => {
    if (!activeTab?.id) {
      setSaveState({
        status: "error",
        message: "This tab can’t be inspected right now."
      })
      return
    }

    setSaveState({
      status: "loading",
      message: "Saving the latest context…"
    })

    try {
      const response = await sendMessageToTab<PopupGetCaptureResponse>(activeTab.id, {
        type: POPUP_GET_CAPTURE
      })

      if (!response?.ok || !response.capture) {
        throw new Error(response?.error || response?.context?.statusDetail || "Nothing is ready to save yet.")
      }

      const token = await requestClerkToken()
      const payload = buildCaptureExportPayload(
        response.capture,
        "chrome_extension_popup"
      )

      const saveResponse = await fetch(`${API_BASE_URL}/v1/conversations/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const result = await saveResponse.json().catch(() => null)
      if (!saveResponse.ok) {
        throw new Error(
          result?.error ||
            result?.message ||
            `Save failed with status ${saveResponse.status}`
        )
      }

      const savedAt = new Date().toISOString()
      const nextRecents = await saveRecentCapture({
        id: result?.conversation?.id ?? payload.conversationId,
        title: payload.title,
        source: response.context.sourceLabel,
        sourceUrl: payload.metadata.sourceUrl,
        captureMode: response.capture.captureMode,
        savedAt
      })

      setRecentCaptures(nextRecents)
      setSaveState({
        status: "success",
        message:
          response.capture.captureMode === "youtube_transcript"
            ? `Transcript saved. ${pluralize(getCaptureCount(response.capture), "segment")} synced just now.`
            : `Conversation saved. ${pluralize(getCaptureCount(response.capture), "message")} synced just now.`
      })
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error ? error.message : "The current context could not be saved."
      })
    }
  }, [activeTab?.id])

  const handleAction = useCallback(
    async (action: PopupAction | null) => {
      if (!action || action.kind === "loading") return

      if (action.kind === "save") {
        await handleSaveCurrent()
        return
      }

      if (action.kind === "signin") {
        openSignInPage()
        return
      }

      if (action.kind === "recent") {
        openWorkspace(true)
        return
      }

      openWorkspace(false)
    },
    [handleSaveCurrent, openWorkspace]
  )

  const primaryDisabled =
    primaryAction.kind === "loading" || saveState.status === "loading"

  const actionLabel =
    saveState.status === "loading" && primaryAction.kind === "save"
      ? "Saving…"
      : primaryAction.label

  return (
    <div className="momentum-popup">
      <div className="momentum-frame" style={themeStyle}>
        <div className="momentum-backdrop" />

        <header className="momentum-topbar">
          <div className="momentum-brand">
            <div className="momentum-brand-mark">M</div>
            <div>
              <div className="momentum-brand-name">MomentumAI</div>
              <div className="momentum-brand-subtitle">{pageContext.sourceLabel}</div>
            </div>
          </div>
          <div className={`momentum-chip momentum-chip--${pageContext.status}`}>
            {pageContext.supported ? "Supported" : "Unsupported"}
          </div>
        </header>

        <section className="momentum-hero">
          <div className="momentum-hero-copy">
            <div className="momentum-chip-row">
              <div className="momentum-chip momentum-chip--source">
                {pageContext.surfaceLabel}
              </div>
              <div
                className={`momentum-chip momentum-chip--${
                  pageContext.captureReady ? "ready" : pageContext.status
                }`}>
                {pageContext.captureReady
                  ? "Capture ready"
                  : pageContext.captureActive
                    ? "Capture active"
                    : "Standby"}
              </div>
            </div>

            <h1 className="momentum-title">{pageContext.title}</h1>
            <p className="momentum-subtitle">{heroDetail}</p>
          </div>

          <div className={`momentum-orb momentum-orb--${pageContext.status}`}>
            <div className="momentum-orb-ring" />
            <div className="momentum-orb-core" />
          </div>

          <div className="momentum-hero-footer">
            <div className="momentum-hero-status">
              <span>{pageContext.statusLabel}</span>
              <span className="momentum-dot" />
              <span>
                {pageContext.captureReady
                  ? pluralize(pageContext.itemCount, pageContext.itemLabel.slice(0, -1))
                  : pageContext.captureActive
                    ? "Listening now"
                    : "Waiting"}
              </span>
            </div>
            {isRefreshingPage ? (
              <div className="momentum-refresh-status">Refreshing…</div>
            ) : null}
          </div>
        </section>

        {saveState.status !== "idle" ? (
          <div className={`momentum-banner momentum-banner--${saveState.status}`}>
            {saveState.message}
          </div>
        ) : null}

        <div className="momentum-info-grid">
          <InfoTile
            label="Capture"
            tone={
              pageContext.captureReady
                ? "ready"
                : pageContext.status === "error"
                  ? "error"
                  : pageContext.captureActive
                    ? "warning"
                    : "neutral"
            }
            value={captureValue}
            meta={pageContext.sourceLabel + " · " + pageContext.surfaceLabel}
          />

          <InfoTile
            label="Account"
            tone={
              !authLoaded ? "warning" : isSignedIn ? "ready" : "neutral"
            }
            value={
              <AccountIdentity
                email={accountEmail}
                initials={accountInitials}
                signedIn={!!isSignedIn}
              />
            }
            meta={accountMeta}
          />

          <InfoTile
            label="Last Save"
            tone={lastSavedCapture ? "ready" : "neutral"}
            value={lastSaveValue}
            meta={lastSaveMeta}
          />
        </div>

        {recentPreview.length > 0 ? (
          <section className="momentum-recents">
            <div className="momentum-section-heading">Recent captures</div>
            <div className="momentum-recent-list">
              {recentPreview.map((capture) => (
                <div className="momentum-recent-item" key={`${capture.id}:${capture.savedAt}`}>
                  <div className="momentum-recent-title">{capture.title}</div>
                  <div className="momentum-recent-meta">
                    {capture.source} · {formatRelativeTime(capture.savedAt)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="momentum-actions">
          <button
            className="momentum-primary-button"
            disabled={primaryDisabled}
            onClick={() => void handleAction(primaryAction)}>
            {actionLabel}
          </button>

          {secondaryAction ? (
            <button
              className="momentum-secondary-button"
              disabled={saveState.status === "loading"}
              onClick={() => void handleAction(secondaryAction)}>
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function IndexPopup() {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
      afterSignOutUrl={POPUP_URL}
      signInFallbackRedirectUrl={POPUP_URL}
      signUpFallbackRedirectUrl={POPUP_URL}>
      <PopupSurface />
    </ClerkProvider>
  )
}

export default IndexPopup
