import { useEffect, useState } from "react"
import {
  ClerkLoaded,
  ClerkLoading,
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
  useUser
} from "@clerk/chrome-extension"
import { Link, MemoryRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom"

import { CountButton } from "~features/count-button"

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

function AuthDebugger() {
  const { isSignedIn, user, isLoaded: userLoaded } = useUser()
  const { sessionId, isLoaded: authLoaded } = useAuth()

  useEffect(() => {
    if (!userLoaded || !authLoaded) {
      console.log("[Clerk Debug] Auth State Changed:", {
        isLoaded: false,
        timestamp: new Date().toISOString()
      })
      return
    }

    console.log("[Clerk Debug] Auth State Changed:", {
      isSignedIn,
      userId: user?.id,
      sessionId,
      timestamp: new Date().toISOString()
    })
  }, [authLoaded, isSignedIn, sessionId, user?.id, userLoaded])

  return null
}

function HomeRoute() {
  return (
    <div className="plasmo-space-y-4">
      <p className="plasmo-text-sm plasmo-text-slate-700">
        Quick counter demo. Use the nav to switch between Home and Profile.
      </p>
      <CountButton />
    </div>
  )
}

function ProfileRoute() {
  const { user } = useUser()

  return (
    <div className="plasmo-space-y-3">
      <SignedIn>
        <div className="plasmo-rounded-lg plasmo-border plasmo-border-slate-200 plasmo-bg-white plasmo-p-4 plasmo-space-y-2">
          <div className="plasmo-text-base plasmo-font-medium">Profile</div>
          <div className="plasmo-text-sm plasmo-text-slate-700">
            User ID: <code className="plasmo-bg-slate-100 plasmo-px-1 plasmo-rounded">{user?.id}</code>
          </div>
          <div className="plasmo-text-sm plasmo-text-slate-700">
            Email: {user?.primaryEmailAddress?.emailAddress ?? "—"}
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="plasmo-space-y-2">
          <p className="plasmo-text-sm plasmo-text-slate-700">Sign in to view your profile details.</p>
          {/* #region agent log */}
          {(() => {
            fetch("http://127.0.0.1:7248/ingest/06466d14-b0e3-48cd-8a4e-d324fcfcd858", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                runId: "pre-fix",
                hypothesisId: "H2",
                location: "popup.tsx:ProfileRoute",
                message: "Rendering SignedOut ProfileRoute with SignInButton",
                data: {},
                timestamp: Date.now()
              })
            }).catch(() => {})
            return null
          })()}
          {/* #endregion */}
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
    </div>
  )
}

function RoutedClerkProvider({ refreshKey }: { refreshKey: number }) {
  const navigate = useNavigate()

  return (
    <ClerkProvider
      key={refreshKey}
      publishableKey={PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
      afterSignOutUrl={POPUP_URL}
      signInFallbackRedirectUrl={POPUP_URL}
      signUpFallbackRedirectUrl={POPUP_URL}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {/* #region agent log */}
      {(() => {
        fetch("http://127.0.0.1:7248/ingest/06466d14-b0e3-48cd-8a4e-d324fcfcd858", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "popup.tsx:RoutedClerkProvider",
            message: "RoutedClerkProvider mounted with ClerkProvider",
            data: {
              hasRouterPush: !!navigate,
              popUpUrlDefined: !!POPUP_URL
            },
            timestamp: Date.now()
          })
        }).catch(() => {})
        return null
      })()}
      {/* #endregion */}
      <AuthDebugger />
      <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-h-[600px] plasmo-w-[800px] plasmo-flex-col">
        <ClerkLoading>
          <div className="plasmo-text-sm plasmo-text-slate-500">Loading session…</div>
        </ClerkLoading>
        <ClerkLoaded>
          <header className="plasmo-w-full plasmo-flex plasmo-items-center plasmo-justify-between plasmo-gap-4 plasmo-mb-4">
            <nav className="plasmo-flex plasmo-gap-3 plasmo-text-sm">
              <Link className="plasmo-text-slate-700 hover:plasmo-text-slate-900" to="/">
                Home
              </Link>
              <Link className="plasmo-text-slate-700 hover:plasmo-text-slate-900" to="/profile">
                Profile
              </Link>
            </nav>
            <div>
              <SignedOut>
                {/* #region agent log */}
                {(() => {
                  fetch("http://127.0.0.1:7248/ingest/06466d14-b0e3-48cd-8a4e-d324fcfcd858", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      runId: "pre-fix",
                      hypothesisId: "H3",
                      location: "popup.tsx:Header",
                      message: "Rendering SignedOut header with SignInButton",
                      data: {},
                      timestamp: Date.now()
                    })
                  }).catch(() => {})
                  return null
                })()}
                {/* #endregion */}
                <SignInButton mode="modal" />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </div>
          </header>
          <main className="plasmo-grow plasmo-w-full">
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/profile" element={<ProfileRoute />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </ClerkLoaded>
      </div>
    </ClerkProvider>
  )
}

function IndexPopup() {
  const [refreshKey, setRefreshKey] = useState(0)

  // Listen for messages from other tabs/windows
  useEffect(() => {
    const handleMessage = (message: any) => {
      console.log("[Clerk Debug] Message received:", message)
      if (message.type === 'CLERK_AUTH_COMPLETE') {
        console.log("[Clerk Debug] Auth complete message received, refreshing...")
        setRefreshKey(prev => prev + 1)
      }
    }

    chrome.runtime.onMessage?.addListener(handleMessage)
    
    return () => {
      chrome.runtime.onMessage?.removeListener(handleMessage)
    }
  }, [])

  return (
    <MemoryRouter>
      <RoutedClerkProvider refreshKey={refreshKey} />
    </MemoryRouter>
  )
}

export default IndexPopup
