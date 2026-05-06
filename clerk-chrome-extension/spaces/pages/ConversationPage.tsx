import { useState } from "react"

import { Button } from "../components/ui"
import type { EchoGitHubRepo } from "../lib/echoApi"
import type { ConversationThread } from "../data"
import { cn } from "../utils"

type ConversationPageProps = {
  conversation: ConversationThread
  onBack: () => void
  onOpenTransform: () => void
  isTransformOpen: boolean
  isSignedIn: boolean
  isGitHubConnected: boolean
  availableRepos: EchoGitHubRepo[]
  selectedRepoFullNames: string[]
  onToggleRepo: (repoFullName: string) => void
  onSignInClick: () => void
  onConnectGitHub: () => void
  repoSelectionError?: string
}

export const ConversationPage = ({
  conversation,
  onBack,
  onOpenTransform,
  isTransformOpen,
  isSignedIn,
  isGitHubConnected,
  availableRepos,
  selectedRepoFullNames,
  onToggleRepo,
  onSignInClick,
  onConnectGitHub,
  repoSelectionError
}: ConversationPageProps) => {
  const [repoMenuOpen, setRepoMenuOpen] = useState(false)

  return (
    <div className="plasmo-relative plasmo-min-h-screen plasmo-px-6 plasmo-pb-16">
      <header className="plasmo-sticky plasmo-top-0 plasmo-z-10 plasmo-flex plasmo-items-center plasmo-justify-between plasmo-bg-[#09090b]/80 plasmo-backdrop-blur-xl plasmo-py-4">
        <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
          <Button variant="secondary" size="sm" onClick={onBack} aria-label="Back to conversations">
            ←
          </Button>
          <div>
            <h1 className="plasmo-text-xl plasmo-font-semibold">{conversation.title}</h1>
            <div className="plasmo-flex plasmo-gap-2 plasmo-text-xs plasmo-text-[#a1a1aa]">
              <span className="plasmo-rounded-full plasmo-bg-[#111111] plasmo-px-2 plasmo-py-0.5 plasmo-text-[0.7rem]">
                {conversation.source}
              </span>
              <span>{conversation.messagesCount} messages</span>
              <span>Dec 2, 2024</span>
            </div>
          </div>
        </div>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
          {!isSignedIn ? (
            <Button variant="secondary" size="sm" onClick={onSignInClick}>
              Sign in
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={onConnectGitHub}
          >
            {isGitHubConnected ? "GitHub connected" : "Connect GitHub"}
          </Button>
          <Button variant="secondary" size="sm">
            Copy
          </Button>
          <Button variant="primary" size="sm" onClick={onOpenTransform}>
            Transform
          </Button>
        </div>
      </header>

      <main
        className={cn(
          "plasmo-space-y-6 plasmo-pt-4 plasmo-transition-[margin] plasmo-duration-200",
          isTransformOpen && "plasmo-mr-[380px]"
        )}
      >
        <section className="plasmo-rounded-xl plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#0f0f10] plasmo-p-4 plasmo-space-y-3">
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <div>
              <h2 className="plasmo-text-sm plasmo-font-semibold plasmo-text-white">
                GitHub repos
              </h2>
              <p className="plasmo-text-xs plasmo-text-[#71717a]">
                Select multiple repos to receive a copy of this conversation.
              </p>
            </div>
            {isSignedIn && isGitHubConnected ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRepoMenuOpen((open) => !open)}
              >
                Choose repos
              </Button>
            ) : null}
          </div>

          {!isSignedIn ? (
            <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
              <Button variant="secondary" size="sm" onClick={onSignInClick}>
                Sign in
              </Button>
              <Button variant="secondary" size="sm" onClick={onConnectGitHub}>
                Connect GitHub
              </Button>
            </div>
          ) : !isGitHubConnected ? (
            <Button variant="secondary" size="sm" onClick={onConnectGitHub}>
              Connect GitHub
            </Button>
          ) : repoMenuOpen ? (
            <div className="plasmo-space-y-2">
              {availableRepos.map((repo) => (
                <label
                  key={repo.fullName}
                  className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-px-3 plasmo-py-2 plasmo-text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedRepoFullNames.includes(repo.fullName)}
                    onChange={() => onToggleRepo(repo.fullName)}
                  />
                  <span>{repo.fullName}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="plasmo-text-xs plasmo-text-[#71717a]">
              {selectedRepoFullNames.length > 0
                ? `${selectedRepoFullNames.length} repo${selectedRepoFullNames.length === 1 ? "" : "s"} selected`
                : "No repos selected yet."}
            </div>
          )}

          {repoSelectionError ? (
            <div className="plasmo-text-xs plasmo-text-[#f87171]">
              {repoSelectionError}
            </div>
          ) : null}
        </section>

        {conversation.messages.map((message) => (
          <article key={message.id} className="plasmo-space-y-3 plasmo-rounded-xl plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#0f0f10] plasmo-p-4">
            <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
              <div
                className={cn(
                  "plasmo-flex plasmo-h-10 plasmo-w-10 plasmo-items-center plasmo-justify-center plasmo-rounded-full plasmo-font-semibold",
                  message.role === "user" ? "plasmo-bg-[#1a1a1a]" : "plasmo-bg-[#1c1c1e]"
                )}
              >
                {message.author[0]}
              </div>
              <div className="plasmo-space-y-0.5">
                <div className="plasmo-text-sm plasmo-font-semibold">{message.author}</div>
                <div className="plasmo-text-xs plasmo-text-[#71717a]">{message.time}</div>
              </div>
            </div>
            <div className="plasmo-text-sm plasmo-text-[#d4d4d8] plasmo-leading-relaxed plasmo-space-y-3">
              {message.paragraphs.map((text, idx) => (
                <p key={idx}>{text}</p>
              ))}
            </div>
          </article>
        ))}
      </main>
    </div>
  )
}
