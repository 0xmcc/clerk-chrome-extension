import type { ReactNode } from "react"

import { transformOptions, type TransformType } from "../data"
import { cn } from "../utils"
import { Button } from "./ui"

type TransformPanelProps = {
  open: boolean
  selectedType: TransformType | null
  output?: { title: string; body: string } | null
  isGenerating?: boolean
  onClose: () => void
  onSelect: (type: TransformType) => void
  onGenerate: (type: TransformType) => void
  quickAction?: { label: string; onClick: () => void; icon?: ReactNode }
}

export const TransformPanel = ({
  open,
  selectedType,
  output,
  isGenerating,
  onClose,
  onSelect,
  onGenerate,
  quickAction
}: TransformPanelProps) => {
  return (
    <aside
      className={cn(
        "plasmo-fixed plasmo-top-0 plasmo-right-0 plasmo-h-screen plasmo-w-[360px] plasmo-bg-[#0d0d0d] plasmo-border-l plasmo-border-[#1a1a1a] plasmo-transition-[transform] plasmo-duration-200 plasmo-z-[60] plasmo-flex plasmo-flex-col",
        open ? "plasmo-translate-x-0" : "plasmo-translate-x-full"
      )}
    >
      <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-border-b plasmo-border-[#1a1a1a] plasmo-px-4 plasmo-py-3">
        <div>
          <h3 className="plasmo-text-base plasmo-font-semibold">Transform</h3>
          <p className="plasmo-text-xs plasmo-text-[#71717a]">Turn this thread into a reusable artifact.</p>
        </div>
        <Button size="sm" variant="ghost" aria-label="Close transform panel" onClick={onClose}>
          ✕
        </Button>
      </div>

      <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-p-4 plasmo-space-y-5">
        {quickAction ? (
          <div className="plasmo-space-y-2">
            <div className="plasmo-text-[0.7rem] plasmo-uppercase plasmo-tracking-[0.1em] plasmo-text-[#52525b]">
              Quick action
            </div>
            <button
              className="plasmo-w-full plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-gradient-to-r plasmo-from-[rgba(59,130,246,0.14)] plasmo-to-[rgba(139,92,246,0.12)] plasmo-px-4 plasmo-py-3 plasmo-text-sm plasmo-font-medium plasmo-text-white hover:plasmo-border-[#2a2a2a]"
              onClick={quickAction.onClick}
            >
              {quickAction.icon}
              {quickAction.label}
            </button>
          </div>
        ) : null}

        <div className="plasmo-space-y-3">
          <div className="plasmo-text-[0.7rem] plasmo-uppercase plasmo-tracking-[0.1em] plasmo-text-[#52525b]">
            Transform into
          </div>
          <div className="plasmo-space-y-2">
            {transformOptions.map((option) => (
              <button
                key={option.type}
                className={cn(
                  "plasmo-w-full plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#121212] plasmo-px-4 plasmo-py-3 plasmo-text-left plasmo-transition-all",
                  selectedType === option.type
                    ? "plasmo-border-[#3b82f6] plasmo-bg-[rgba(59,130,246,0.08)]"
                    : "hover:plasmo-border-[#2a2a2a] hover:plasmo-bg-[#151515]"
                )}
                onClick={() => onSelect(option.type)}
              >
                <div
                  className={cn(
                    "plasmo-flex plasmo-h-10 plasmo-w-10 plasmo-items-center plasmo-justify-center plasmo-rounded-lg plasmo-bg-[#1f1f1f] plasmo-text-[#71717a]",
                    selectedType === option.type && "plasmo-bg-[rgba(59,130,246,0.2)] plasmo-text-[#60a5fa]"
                  )}
                >
                  {getIconForTransform(option.type)}
                </div>
                <div className="plasmo-flex-1">
                  <div className="plasmo-text-sm plasmo-font-semibold">{option.title}</div>
                  <div className="plasmo-text-xs plasmo-text-[#71717a]">{option.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="plasmo-space-y-3">
          <Button
            variant="primary"
            size="md"
            disabled={!selectedType || isGenerating}
            className="plasmo-w-full"
            onClick={() => selectedType && onGenerate(selectedType)}
          >
            {isGenerating ? "Generating..." : selectedType ? "Generate" : "Select a format"}
          </Button>

          {output ? (
            <div className="plasmo-rounded-xl plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#121212] plasmo-overflow-hidden">
              <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-border-b plasmo-border-[#1f1f1f] plasmo-px-4 plasmo-py-3">
                <div className="plasmo-text-xs plasmo-uppercase plasmo-tracking-[0.1em] plasmo-text-[#71717a]">
                  {output.title}
                </div>
                <div className="plasmo-flex plasmo-gap-2">
                  <Button size="sm" variant="ghost" onClick={() => copyOutput(output.body)}>
                    Copy
                  </Button>
                  <Button size="sm" variant="ghost">
                    Save
                  </Button>
                </div>
              </div>
              <div className="plasmo-max-h-[320px] plasmo-overflow-y-auto plasmo-p-4 plasmo-text-sm plasmo-leading-relaxed plasmo-text-[#d4d4d8]">
                <div dangerouslySetInnerHTML={{ __html: output.body }} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}

const getIconForTransform = (type: TransformType) => {
  switch (type) {
    case "insights":
      return (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
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
    default:
      return (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
  }
}

const copyOutput = (body: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof document !== "undefined") {
    const tmp = document.createElement("div")
    tmp.innerHTML = body
    navigator.clipboard.writeText(tmp.innerText)
  }
}
