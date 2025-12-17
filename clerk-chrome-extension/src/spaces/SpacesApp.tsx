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
import {
  conversationThreads,
  transformOutputs,
  type TransformType
} from "./data"
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
              conversations={conversationThreads}
              onOpenConversation={(id) => handleOpenConversation(id, false)}
              onTransformConversation={(id) => handleOpenConversation(id, true)}
            />
          }
        />
        <Route
          path="/conversation/:id"
          element={
            <ConversationWrapper
              onBack={() => navigate("/workspace")}
              onOpenTransform={() => setTransformOpen(true)}
              isTransformOpen={transformOpen}
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
  onBack,
  onOpenTransform,
  isTransformOpen
}: {
  onBack: () => void
  onOpenTransform: () => void
  isTransformOpen: boolean
}) => {
  const { id } = useParams<{ id: string }>()
  const conversation = useMemo(
    () => conversationThreads.find((c) => c.id === id) || conversationThreads[0],
    [id]
  )

  return (
    <ConversationPage
      conversation={conversation}
      onBack={onBack}
      onOpenTransform={onOpenTransform}
      isTransformOpen={isTransformOpen}
    />
  )
}
