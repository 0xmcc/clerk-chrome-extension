import type { RefObject } from "react"

import { Button, Card } from "../components/ui"
import { cn } from "../utils"

type LandingPageProps = {
  onStart: () => void
  onScrollToFeatures: () => void
  onScrollToPricing: () => void
  onScrollToHow: () => void
  featuresRef: RefObject<HTMLDivElement>
  pricingRef: RefObject<HTMLDivElement>
  howRef: RefObject<HTMLDivElement>
}

const featureCards = [
  {
    title: "All sources, one place",
    description:
      "Claude, ChatGPT, Gemini—it doesn't matter where the conversation happened. Echo captures everything.",
    icon: "list"
  },
  {
    title: "Transform, don't just store",
    description:
      "Turn conversations into key insights, strategy docs, blog drafts, or portable context profiles—one click.",
    icon: "spark"
  },
  {
    title: "Context that travels",
    description:
      "Extract your AI's primed state as JSON. Start fresh conversations that pick up exactly where you left off.",
    icon: "share"
  }
]

export const LandingPage = ({
  onStart,
  onScrollToFeatures,
  onScrollToPricing,
  onScrollToHow,
  featuresRef,
  pricingRef,
  howRef
}: LandingPageProps) => {
  return (
    <div className="plasmo-relative plasmo-flex plasmo-flex-col plasmo-gap-24 plasmo-pb-16">
      <nav className="plasmo-fixed plasmo-left-0 plasmo-right-0 plasmo-top-0 plasmo-z-20 plasmo-flex plasmo-items-center plasmo-justify-between plasmo-bg-[rgba(9,9,11,0.8)] plasmo-backdrop-blur-xl plasmo-px-8 plasmo-py-5">
        <div className="plasmo-text-lg plasmo-font-semibold">echo</div>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-8 plasmo-text-sm">
          <button className="plasmo-text-[#a1a1aa] hover:plasmo-text-white" onClick={onScrollToFeatures}>
            Features
          </button>
          <button className="plasmo-text-[#a1a1aa] hover:plasmo-text-white" onClick={onScrollToHow}>
            How it works
          </button>
          <button className="plasmo-text-[#a1a1aa] hover:plasmo-text-white" onClick={onScrollToPricing}>
            Pricing
          </button>
          <Button size="sm" variant="primary" onClick={onStart}>
            Get started
          </Button>
        </div>
      </nav>

      <section className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-text-center plasmo-pt-36 plasmo-px-6 plasmo-gap-10">
        <div className="plasmo-inline-flex plasmo-items-center plasmo-gap-2 plasmo-rounded-full plasmo-border plasmo-border-[rgba(59,130,246,0.2)] plasmo-bg-[rgba(59,130,246,0.1)] plasmo-px-4 plasmo-py-2 plasmo-text-xs plasmo-text-[#60a5fa]">
          <span className="plasmo-h-1.5 plasmo-w-1.5 plasmo-rounded-full plasmo-bg-[#60a5fa]" />
          Now in beta
        </div>
        <div className="plasmo-space-y-5">
          <h1
            className="plasmo-text-[clamp(2.5rem,8vw,4.5rem)] plasmo-font-semibold plasmo-leading-[1.1] plasmo-max-w-5xl plasmo-mx-auto"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #a1a1aa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}
          >
            Stop losing your best AI conversations
          </h1>
          <p className="plasmo-text-[1.15rem] plasmo-text-[#71717a] plasmo-max-w-3xl plasmo-leading-[1.6] plasmo-mx-auto">
            Echo captures every conversation across Claude, ChatGPT, and Gemini—then transforms them into insights, docs,
            and reusable context.
          </p>
        </div>
        <div className="plasmo-flex plasmo-gap-4 plasmo-flex-wrap plasmo-justify-center">
          <Button size="lg" variant="primary" onClick={onScrollToPricing}>
            Start free trial
          </Button>
          <Button size="lg" variant="secondary" onClick={onScrollToHow}>
            See how it works
          </Button>
        </div>

        <div className="plasmo-w-full plasmo-max-w-5xl plasmo-mx-auto plasmo-relative">
          <div className="plasmo-rounded-2xl plasmo-border plasmo-border-[#27272a] plasmo-bg-[#18181b] plasmo-overflow-hidden plasmo-shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
            <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-border-b plasmo-border-[#27272a] plasmo-bg-[#0d0d0d] plasmo-px-5 plasmo-py-4">
              <div className="plasmo-h-3 plasmo-w-3 plasmo-rounded-full plasmo-bg-[#ef4444]" />
              <div className="plasmo-h-3 plasmo-w-3 plasmo-rounded-full plasmo-bg-[#eab308]" />
              <div className="plasmo-h-3 plasmo-w-3 plasmo-rounded-full plasmo-bg-[#22c55e]" />
            </div>
            <div className="plasmo-flex plasmo-min-h-[420px]">
              <div className="plasmo-flex-1 plasmo-border-r plasmo-border-[#27272a] plasmo-p-6 plasmo-opacity-70">
                {previewChat.map((item) => (
                  <div key={item.id} className="plasmo-mb-6">
                    <div className="plasmo-text-[0.72rem] plasmo-text-[#52525b] plasmo-mb-2">{item.label}</div>
                    <div className="plasmo-text-sm plasmo-text-[#71717a] plasmo-leading-[1.55]">{item.text}</div>
                  </div>
                ))}
              </div>
              <div className="plasmo-w-[320px] plasmo-bg-[#0d0d0d] plasmo-p-5 plasmo-space-y-4">
                <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-border-b plasmo-border-[#1f1f23] plasmo-pb-4">
                  <div className="plasmo-text-[0.95rem] plasmo-font-semibold">echo</div>
                  <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-text-[0.7rem] plasmo-text-[#4ade80]">
                    <span className="plasmo-h-1.5 plasmo-w-1.5 plasmo-rounded-full plasmo-bg-[#4ade80]" />
                    Syncing
                  </div>
                </div>
                <div className="plasmo-rounded-lg plasmo-border plasmo-border-[#27272a] plasmo-bg-[#18181b] plasmo-p-4">
                  <div className="plasmo-text-[0.6rem] plasmo-uppercase plasmo-tracking-[0.05em] plasmo-text-[#52525b] plasmo-mb-2">
                    This conversation
                  </div>
                  <div className="plasmo-text-sm plasmo-font-medium plasmo-mb-1">Flutter architecture deep dive</div>
                  <div className="plasmo-text-xs plasmo-text-[#52525b]">47 messages · Claude</div>
                </div>
                <div className="plasmo-text-[0.65rem] plasmo-uppercase plasmo-tracking-[0.08em] plasmo-text-[#52525b]">
                  Transform into
                </div>
                <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-rounded-md plasmo-border plasmo-border-[#3b82f6] plasmo-bg-[#18181b] plasmo-p-3">
                  <div className="plasmo-flex plasmo-h-7 plasmo-w-7 plasmo-items-center plasmo-justify-center plasmo-rounded-md plasmo-bg-[rgba(59,130,246,0.2)] plasmo-text-[#60a5fa]">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                  <div className="plasmo-text-[0.85rem] plasmo-text-[#e4e4e7]">Key Insights</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={featuresRef} id="features" className="plasmo-px-6">
        <div className="plasmo-max-w-5xl plasmo-mx-auto plasmo-text-center plasmo-mb-14">
          <h2 className="plasmo-text-[2rem] plasmo-font-semibold plasmo-leading-tight plasmo-mb-4">
            Your conversations, working for you
          </h2>
          <p className="plasmo-text-[1.05rem] plasmo-text-[#71717a] plasmo-max-w-2xl plasmo-mx-auto">
            Every insight you've ever reached with AI—searchable, transformable, portable.
          </p>
        </div>
        <div className="plasmo-grid plasmo-grid-cols-1 md:plasmo-grid-cols-3 plasmo-gap-6 plasmo-max-w-6xl plasmo-mx-auto">
          {featureCards.map((feature) => (
            <Card
              key={feature.title}
              className="plasmo-p-8 plasmo-bg-[#18181b] plasmo-border-[#27272a] hover:plasmo-border-[#3f3f46] hover:plasmo-translate-y-[-2px] plasmo-transition"
            >
              <div className="plasmo-h-12 plasmo-w-12 plasmo-rounded-xl plasmo-bg-[#27272a] plasmo-flex plasmo-items-center plasmo-justify-center plasmo-mb-5 plasmo-text-[#a1a1aa]">
                {renderIcon(feature.icon)}
              </div>
              <h3 className="plasmo-text-lg plasmo-font-semibold plasmo-mb-2">{feature.title}</h3>
              <p className="plasmo-text-sm plasmo-text-[#71717a] plasmo-leading-[1.6]">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section ref={howRef} id="how-it-works" className="plasmo-bg-[#0d0d0d] plasmo-px-6 plasmo-py-24">
        <div className="plasmo-max-w-4xl plasmo-mx-auto plasmo-space-y-12">
          <h2 className="plasmo-text-[2rem] plasmo-font-semibold plasmo-text-center">How it works</h2>
          <div className="plasmo-flex plasmo-flex-col plasmo-gap-10">
            {howSteps.map((step) => (
              <div key={step.id} className="plasmo-flex plasmo-items-start plasmo-gap-6">
                <div className="plasmo-flex plasmo-h-12 plasmo-w-12 plasmo-items-center plasmo-justify-center plasmo-rounded-full plasmo-bg-[#27272a] plasmo-text-xl plasmo-font-semibold">
                  {step.id}
                </div>
                <div className="plasmo-pt-1">
                  <h3 className="plasmo-text-xl plasmo-font-semibold plasmo-mb-2">{step.title}</h3>
                  <p className="plasmo-text-[#71717a] plasmo-leading-[1.6]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={pricingRef} id="pricing" className="plasmo-px-6 plasmo-pb-20 plasmo-pt-4">
        <div className="plasmo-max-w-lg plasmo-mx-auto plasmo-text-center">
          <Card className="plasmo-bg-[#18181b] plasmo-border-[#27272a] plasmo-px-10 md:plasmo-px-12 plasmo-py-12 plasmo-rounded-[1.65rem]">
            <div className="plasmo-text-[0.78rem] plasmo-uppercase plasmo-tracking-[0.12em] plasmo-text-[#71717a] plasmo-mb-4">
              Early access
            </div>
            <div className="plasmo-flex plasmo-items-baseline plasmo-justify-center plasmo-gap-2 plasmo-mb-2">
              <span className="plasmo-text-[1.6rem] plasmo-text-[#a1a1aa]">$</span>
              <span className="plasmo-text-[3.25rem] plasmo-font-semibold plasmo-leading-[1]">12</span>
            </div>
            <div className="plasmo-text-[#71717a] plasmo-mb-10">per month</div>
            <div className="plasmo-text-left plasmo-mb-10 plasmo-divide-y plasmo-divide-[#2b2b2f] plasmo-space-y-0">
              {pricingFeatures.map((item, idx) => (
                <div key={item} className={cn("plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-py-3.5", idx === 0 && "plasmo-pt-0")}>
                  <svg width="20" height="20" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="plasmo-text-[1rem] plasmo-text-[#d4d4d8]">{item}</span>
                </div>
              ))}
            </div>
            <button
              className="plasmo-mt-2 plasmo-w-full plasmo-rounded-[0.9rem] plasmo-bg-white plasmo-py-4 plasmo-text-base plasmo-font-medium plasmo-text-[#0b0b0d] plasmo-transition hover:plasmo-bg-[#e8e8eb]"
              onClick={onStart}
            >
              Start 7-day free trial
            </button>
          </Card>
        </div>
      </section>

      <footer className="plasmo-border-t plasmo-border-[#1f1f23] plasmo-px-6 plasmo-py-12 plasmo-text-center">
        <p className="plasmo-text-sm plasmo-text-[#52525b]">© 2024 Echo. All rights reserved.</p>
        <div className="plasmo-mt-4 plasmo-flex plasmo-justify-center plasmo-gap-8">
          {["Privacy", "Terms", "Contact"].map((item) => (
            <button
              key={item}
              className="plasmo-text-sm plasmo-text-[#71717a] hover:plasmo-text-white plasmo-transition"
            >
              {item}
            </button>
          ))}
        </div>
      </footer>
    </div>
  )
}

const previewChat = [
  {
    id: "c1",
    label: "You",
    text: "I keep running into this issue where my product specs don't translate cleanly into code..."
  },
  {
    id: "c2",
    label: "Claude",
    text:
      "You're describing what I'd call the Logic Layer Problem—the gap between product requirements and technical implementation..."
  },
  {
    id: "c3",
    label: "You",
    text: "That makes sense. So with BLoC, where exactly does that translation happen?"
  }
]

const howSteps = [
  {
    id: 1,
    title: "Install the extension",
    desc: "Echo runs silently in the background while you chat. No copy-paste, no exports, no extra steps."
  },
  {
    id: 2,
    title: "Keep using AI normally",
    desc: "Chat with Claude, GPT, or Gemini like you always do. Echo captures your conversations automatically."
  },
  {
    id: 3,
    title: "Transform when you need it",
    desc: "Open the sidebar, pick a format, and transform any conversation into an artifact you can use."
  }
]

const pricingFeatures = [
  "Unlimited conversation capture",
  "Claude, ChatGPT, and Gemini",
  "All transform types",
  "Custom prompts",
  "Export anytime"
]

const renderIcon = (type: string) => {
  if (type === "spark") {
    return (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )
  }
  if (type === "share") {
    return (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    )
  }
  return (
    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 12h16m-7 6h7" />
    </svg>
  )
}
