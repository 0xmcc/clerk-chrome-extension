import { useEffect, useMemo, useRef, useState } from "react"
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
} from "react-router-dom"

import { TransformPanel } from "./components/TransformPanel"
import { openSignInPage } from "~utils/navigation"
import {
  conversationThreads,
  transformOutputs,
  type TransformType
} from "./data"
import {
  connectEchoGitHub,
  getEchoConversationDetail,
  getEchoConversationRepos,
  getEchoGitHubStatus,
  listEchoConversations,
  listEchoGitHubRepos,
  saveEchoConversationRepos,
  type EchoGitHubRepo,
  refreshEchoAuthStatus
} from "./lib/echoApi"
import { ConversationPage } from "./pages/ConversationPage"
import { ExplainerPage } from "./pages/ExplainerPage"
import { InstallPage } from "./pages/InstallPage"
import { LandingPage } from "./pages/LandingPage"
import { PaymentPage } from "./pages/PaymentPage"
import { SignupPage } from "./pages/SignupPage"
import { SurveyPage, type SurveyState } from "./pages/SurveyPage"
import { SyncingPage } from "./pages/SyncingPage"
import { WorkspacePage } from "./pages/WorkspacePage"

type RouterMode = "browser" | "memory"

export const SpacesApp = ({ routerMode = "browser" }: { routerMode?: RouterMode }) => {
  const Router = routerMode === "memory" ? MemoryRouter : BrowserRouter

  return (
    <div className="spaces-app">
      <Router>
        <SpacesRoutes />
      </Router>
    </div>
  )
}

const SpacesRoutes = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const featuresRef = useRef<HTMLDivElement>(null)
  const pricingRef = useRef<HTMLDivElement>(null)
  const howRef = useRef<HTMLDivElement>(null)

  const [signup, setSignup] = useState({ email: "", password: "" })
  const [payment, setPayment] = useState({ cardNumber: "", expiry: "", cvc: "" })
  const [survey, setSurvey] = useState<SurveyState>({ tools: [] })
  const [transformType, setTransformType] = useState<TransformType | null>(null)
  const [transformOutput, setTransformOutput] = useState<{ title: string; body: string } | null>(null)
  const [transformOpen, setTransformOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingTransformOpen, setPendingTransformOpen] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)
  const [conversations, setConversations] = useState(conversationThreads)

  useEffect(() => {
    if (location.pathname.startsWith("/conversation") && pendingTransformOpen) {
      setTransformOpen(true)
      setPendingTransformOpen(false)
    }

    if (!location.pathname.startsWith("/conversation")) {
      setTransformOpen(false)
    }
  }, [location.pathname, pendingTransformOpen])

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const scrollToHow = () => {
    howRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleEchoGitHubConnect = () => {
    if (!isSignedIn) {
      openSignInPage()
      return
    }

    void connectEchoGitHub()
  }

  const handleGenerate = (type: TransformType) => {
    setTransformType(type)
    setIsGenerating(true)
    setTimeout(() => {
      setTransformOutput(transformOutputs[type])
      setIsGenerating(false)
    }, 700)
  }

  const handleOpenConversation = (id: string, openPanel = false) => {
    navigate(`/conversation/${id}`)
    if (openPanel) {
      setTransformOutput(null)
      setTransformType(null)
      setPendingTransformOpen(true)
    }
  }

  const refreshEchoState = async () => {
    const hasSession = await refreshEchoAuthStatus()
    setIsSignedIn(hasSession)

    if (!hasSession) {
      setIsGitHubConnected(false)
      setConversations(conversationThreads)
      return
    }

    try {
      const [githubStatus, liveConversations] = await Promise.all([
        getEchoGitHubStatus(),
        listEchoConversations()
      ])
      setIsGitHubConnected(Boolean(githubStatus.connected))
      if (liveConversations.length > 0) {
        setConversations(liveConversations)
      }
    } catch {
      setConversations(conversationThreads)
    }
  }

  useEffect(() => {
    void refreshEchoState()
  }, [])

  useEffect(() => {
    if (!isSignedIn) return

    const handleFocus = () => {
      void refreshEchoState()
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [isSignedIn])

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              onStart={() => navigate("/signup")}
              onScrollToFeatures={scrollToFeatures}
              onScrollToPricing={scrollToPricing}
              onScrollToHow={scrollToHow}
              onSignInClick={openSignInPage}
              onConnectGitHub={handleEchoGitHubConnect}
              isSignedIn={isSignedIn}
              isGitHubConnected={isGitHubConnected}
              featuresRef={featuresRef}
              pricingRef={pricingRef}
              howRef={howRef}
            />
          }
        />
        <Route
          path="/signup"
          element={
            <SignupPage
              values={signup}
              onChange={setSignup}
              onSubmit={() => navigate("/payment")}
              onExistingAccount={() => navigate("/workspace")}
            />
          }
        />
        <Route
          path="/payment"
          element={<PaymentPage values={payment} onChange={setPayment} onSubmit={() => navigate("/survey")} />}
        />
        <Route
          path="/survey"
          element={<SurveyPage values={survey} onChange={setSurvey} onComplete={() => navigate("/explainer")} />}
        />
        <Route path="/explainer" element={<ExplainerPage onContinue={() => navigate("/install")} />} />
        <Route path="/install" element={<InstallPage onInstall={() => navigate("/syncing")} />} />
        <Route path="/syncing" element={<SyncingPage onComplete={() => navigate("/workspace")} />} />
        <Route
          path="/workspace"
          element={
            <WorkspacePage
              conversations={conversations}
              onOpenConversation={(id) => handleOpenConversation(id, false)}
              onTransformConversation={(id) => handleOpenConversation(id, true)}
              isSignedIn={isSignedIn}
              isGitHubConnected={isGitHubConnected}
              onSignInClick={openSignInPage}
              onConnectGitHub={handleEchoGitHubConnect}
            />
          }
        />
        <Route
          path="/conversation/:id"
          element={
            <ConversationWrapper
              conversations={conversations}
              onBack={() => navigate("/workspace")}
              onOpenTransform={() => setTransformOpen(true)}
              isTransformOpen={transformOpen}
              isSignedIn={isSignedIn}
              isGitHubConnected={isGitHubConnected}
              onSignInClick={openSignInPage}
              onConnectGitHub={handleEchoGitHubConnect}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {transformOpen ? (
        <div
          className="plasmo-fixed plasmo-inset-0 plasmo-bg-black/50 plasmo-z-50"
          onClick={() => setTransformOpen(false)}
        />
      ) : null}
      <TransformPanel
        open={transformOpen}
        selectedType={transformType}
        output={transformOutput}
        isGenerating={isGenerating}
        onClose={() => setTransformOpen(false)}
        onSelect={(type) => {
          setTransformType(type)
          setTransformOutput(null)
        }}
        onGenerate={handleGenerate}
        quickAction={{
          label: "Continue in new chat",
          onClick: () => setTransformType("summary"),
          icon: (
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          )
        }}
      />
    </>
  )
}

const ConversationWrapper = ({
  conversations,
  onBack,
  onOpenTransform,
  isTransformOpen,
  isSignedIn,
  isGitHubConnected,
  onSignInClick,
  onConnectGitHub
}: {
  conversations: typeof conversationThreads
  onBack: () => void
  onOpenTransform: () => void
  isTransformOpen: boolean
  isSignedIn: boolean
  isGitHubConnected: boolean
  onSignInClick: () => void
  onConnectGitHub: () => void
}) => {
  const { id } = useParams<{ id: string }>()
  const fallbackConversation = useMemo(
    () => conversations.find((c) => c.id === id) || conversations[0] || conversationThreads[0],
    [conversations, id]
  )
  const [conversation, setConversation] = useState(fallbackConversation)
  const [availableRepos, setAvailableRepos] = useState<EchoGitHubRepo[]>([])
  const [selectedRepoFullNames, setSelectedRepoFullNames] = useState<string[]>([])
  const [repoSelectionError, setRepoSelectionError] = useState("")

  useEffect(() => {
    setConversation(fallbackConversation)
  }, [fallbackConversation])

  useEffect(() => {
    let cancelled = false

    const loadConversationState = async () => {
      if (!id || !isSignedIn) {
        setAvailableRepos([])
        setSelectedRepoFullNames([])
        setRepoSelectionError("")
        return
      }

      try {
        const [detail, repos, selectedRepos] = await Promise.all([
          getEchoConversationDetail(id),
          listEchoGitHubRepos(),
          getEchoConversationRepos(id)
        ])

        if (cancelled) return

        setConversation(detail)
        setAvailableRepos(repos)
        setSelectedRepoFullNames(selectedRepos)
        setRepoSelectionError("")
      } catch (error) {
        if (cancelled) return
        setRepoSelectionError(
          error instanceof Error ? error.message : "Failed to load GitHub repos."
        )
      }
    }

    void loadConversationState()

    return () => {
      cancelled = true
    }
  }, [id, isSignedIn])

  const handleToggleRepo = async (repoFullName: string) => {
    if (!id || !isSignedIn) return

    const nextSelection = selectedRepoFullNames.includes(repoFullName)
      ? selectedRepoFullNames.filter((value) => value !== repoFullName)
      : [...selectedRepoFullNames, repoFullName]

    setSelectedRepoFullNames(nextSelection)
    setRepoSelectionError("")

    try {
      const persistedSelection = await saveEchoConversationRepos(id, nextSelection)
      setSelectedRepoFullNames(persistedSelection)
    } catch (error) {
      setRepoSelectionError(
        error instanceof Error ? error.message : "Failed to save GitHub repos."
      )
      setSelectedRepoFullNames(selectedRepoFullNames)
    }
  }

  return (
    <ConversationPage
      conversation={conversation}
      onBack={onBack}
      onOpenTransform={onOpenTransform}
      isTransformOpen={isTransformOpen}
      isSignedIn={isSignedIn}
      isGitHubConnected={isGitHubConnected}
      availableRepos={availableRepos}
      selectedRepoFullNames={selectedRepoFullNames}
      onToggleRepo={handleToggleRepo}
      onSignInClick={onSignInClick}
      onConnectGitHub={onConnectGitHub}
      repoSelectionError={repoSelectionError}
    />
  )
}
