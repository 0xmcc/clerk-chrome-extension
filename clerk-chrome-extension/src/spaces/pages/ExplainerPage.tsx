import { useState } from "react"

import { Button, Card } from "../components/ui"
import { sourcesPreview, transformOptions } from "../data"
import { cn } from "../utils"

type ExplainerPageProps = {
  onContinue: () => void
}

export const ExplainerPage = ({ onContinue }: ExplainerPageProps) => {
  const [step, setStep] = useState(1)

  const goNext = () => {
    if (step < 3) {
      setStep(step + 1)
    } else {
      onContinue()
    }
  }

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  return (
    <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-min-h-screen plasmo-px-4">
      <Card className="plasmo-w-full plasmo-max-w-3xl plasmo-bg-[#0f0f10] plasmo-border-[#1c1c1e] plasmo-p-8 plasmo-space-y-8">
        <div className="plasmo-text-lg plasmo-font-semibold">spaces</div>

        <div className="plasmo-flex plasmo-justify-center plasmo-gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "plasmo-h-2.5 plasmo-w-2.5 plasmo-rounded-full",
                step >= i ? "plasmo-bg-white" : "plasmo-bg-[#1a1a1a]"
              )}
            />
          ))}
        </div>

        {step === 1 ? (
          <div className="plasmo-space-y-5">
            <h2 className="plasmo-text-2xl plasmo-font-semibold">Every insight, one place</h2>
            <p className="plasmo-text-sm plasmo-text-[#a1a1aa]">
              All your AI conversations—every decision, breakthrough, and idea—captured automatically and ready to use.
            </p>
            <div className="plasmo-grid sm:plasmo-grid-cols-3 plasmo-gap-3">
              {sourcesPreview.map((source) => (
                <div
                  key={source.name}
                  className="plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-p-4 plasmo-space-y-2"
                >
                  <div
                    className={cn(
                      "plasmo-h-10 plasmo-w-10 plasmo-rounded-lg plasmo-flex plasmo-items-center plasmo-justify-center plasmo-font-semibold",
                      source.accent === "claude" && "plasmo-bg-[#1c1c1e]",
                      source.accent === "gpt" && "plasmo-bg-[#1a2b1f]",
                      source.accent === "gemini" && "plasmo-bg-[#111827]"
                    )}
                  >
                    {source.name[0]}
                  </div>
                  <div className="plasmo-text-sm plasmo-font-semibold">{source.name}</div>
                  <div className="plasmo-text-xs plasmo-text-[#a1a1aa]">{source.count}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="plasmo-space-y-5">
            <h2 className="plasmo-text-2xl plasmo-font-semibold">Transform, don't just store</h2>
            <p className="plasmo-text-sm plasmo-text-[#a1a1aa]">
              Turn conversations into key insights, strategy docs, or blog drafts with one click.
            </p>
            <div className="plasmo-grid sm:plasmo-grid-cols-2 lg:plasmo-grid-cols-4 plasmo-gap-3">
              {transformOptions.map((option) => (
                <div
                  key={option.type}
                  className="plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-p-4 plasmo-space-y-2"
                >
                  <div className="plasmo-flex plasmo-h-10 plasmo-w-10 plasmo-items-center plasmo-justify-center plasmo-rounded-lg plasmo-bg-[#1f1f1f] plasmo-text-[#71717a]">
                    {renderTransformIcon(option.type)}
                  </div>
                  <div className="plasmo-text-sm plasmo-font-semibold">{option.title}</div>
                  <div className="plasmo-text-xs plasmo-text-[#a1a1aa]">{option.description}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="plasmo-space-y-5">
            <h2 className="plasmo-text-2xl plasmo-font-semibold">How it works</h2>
            <p className="plasmo-text-sm plasmo-text-[#a1a1aa]">Three simple steps. No behavior change required.</p>
            <div className="plasmo-space-y-3">
              {[
                { title: "Install the extension", desc: "Takes 10 seconds. Works with Chrome, Arc, Brave, Edge." },
                { title: "Keep chatting normally", desc: "The extension runs silently. No extra steps." },
                { title: "Transform when you need it", desc: "One click to turn any conversation into an artifact." }
              ].map((item, idx) => (
                <div
                  key={item.title}
                  className="plasmo-flex plasmo-items-start plasmo-gap-3 plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-p-4"
                >
                  <div className="plasmo-h-7 plasmo-w-7 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-rounded-full plasmo-bg-[#1a1a1a] plasmo-text-sm plasmo-font-semibold">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="plasmo-text-sm plasmo-font-semibold">{item.title}</div>
                    <div className="plasmo-text-xs plasmo-text-[#a1a1aa]">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
          <Button variant="ghost" onClick={goBack}>
            Back
          </Button>
          <Button variant="primary" onClick={goNext}>
            {step === 3 ? "Install extension" : "Continue"}
          </Button>
        </div>
      </Card>
    </div>
  )
}

const renderTransformIcon = (type: string) => {
  switch (type) {
    case "profile":
      return (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      )
    case "summary":
      return (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case "blog":
      return (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    default:
      return (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
  }
}
