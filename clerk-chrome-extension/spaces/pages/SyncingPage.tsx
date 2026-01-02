import { useEffect, useState } from "react"

import { Card } from "../components/ui"

type SyncingPageProps = {
  onComplete: () => void
}

export const SyncingPage = ({ onComplete }: SyncingPageProps) => {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 800),
      setTimeout(() => setStage(2), 1600),
      setTimeout(() => setStage(3), 2400),
      setTimeout(onComplete, 3600)
    ]

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  const counts = [
    stage >= 1 ? "247 found" : "--",
    stage >= 2 ? "156 found" : "--",
    stage >= 3 ? "23 found" : "--"
  ]

  const statuses = [
    "Finding conversations across your AI tools",
    "Scanning ChatGPT...",
    "Scanning Gemini...",
    "Processing conversations..."
  ]

  return (
    <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-min-h-screen plasmo-px-4">
      <Card className="plasmo-w-full plasmo-max-w-md plasmo-bg-[#0f0f10] plasmo-border-[#1c1c1e] plasmo-p-8 plasmo-space-y-6 plasmo-text-center">
        <div className="plasmo-text-lg plasmo-font-semibold">spaces</div>

        <div className="plasmo-relative plasmo-flex plasmo-items-center plasmo-justify-center plasmo-h-32">
          <div
            className="plasmo-absolute plasmo-h-24 plasmo-w-24 plasmo-rounded-full plasmo-border plasmo-border-[#1f1f1f] plasmo-animate-spin"
            style={{ animationDuration: "12s" }}
          />
          <div
            className="plasmo-absolute plasmo-h-16 plasmo-w-16 plasmo-rounded-full plasmo-border plasmo-border-[#27272a] plasmo-animate-spin"
            style={{ animationDuration: "8s" }}
          />
          <div className="plasmo-relative plasmo-flex plasmo-h-12 plasmo-w-12 plasmo-items-center plasmo-justify-center plasmo-rounded-full plasmo-bg-[#18181b] plasmo-text-white">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>

        <div className="plasmo-space-y-2">
          <h2 className="plasmo-text-xl plasmo-font-semibold">Syncing your conversations...</h2>
          <p className="plasmo-text-sm plasmo-text-[#a1a1aa]">{statuses[Math.min(stage, statuses.length - 1)]}</p>
        </div>

        <div className="plasmo-grid plasmo-grid-cols-3 plasmo-gap-3">
          {[
            { name: "Claude", color: "plasmo-bg-[#1c1c1e]" },
            { name: "ChatGPT", color: "plasmo-bg-[#1a2b1f]" },
            { name: "Gemini", color: "plasmo-bg-[#111827]" }
          ].map((source, idx) => (
            <div
              key={source.name}
              className="plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-p-4 plasmo-space-y-2"
            >
              <div className={`plasmo-h-8 plasmo-w-8 plasmo-rounded-full ${source.color}`} />
              <div className="plasmo-text-sm plasmo-font-semibold">{source.name}</div>
              <div className="plasmo-text-xs plasmo-text-[#a1a1aa]">{counts[idx]}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
