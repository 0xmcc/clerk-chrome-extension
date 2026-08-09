import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { HumanSentimentPanel } from "./HumanSentimentPanel"

describe("HumanSentimentPanel", () => {
  it("renders an analyze action before scores exist", () => {
    const onAnalyze = vi.fn()

    render(
      <HumanSentimentPanel
        status="idle"
        points={[{ messageIndex: 0, score: 0, label: "Neutral" }]}
        onAnalyze={onAnalyze}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Analyze sentiment" }))

    expect(screen.getByText("Human sentiment")).toBeInTheDocument()
    expect(onAnalyze).toHaveBeenCalled()
  })

  it("draws a neutral-start chart with message-index axes after analysis", () => {
    render(
      <HumanSentimentPanel
        status="ready"
        points={[
          { messageIndex: 0, score: 0, label: "Neutral" },
          { messageIndex: 2, score: -50, label: "Frustrated" },
          { messageIndex: 5, score: 80, label: "Happy" }
        ]}
        onAnalyze={vi.fn()}
      />
    )

    expect(
      screen.getByRole("img", { name: "Human sentiment over transcript" })
    ).toBeInTheDocument()
    expect(screen.getByText("+100")).toBeInTheDocument()
    expect(screen.getAllByText("0").length).toBeGreaterThan(0)
    expect(screen.getByText("-100")).toBeInTheDocument()
    expect(screen.getByText("Message index")).toBeInTheDocument()
    expect(screen.getByText(/Frustrated/)).toBeInTheDocument()
    expect(screen.getByText(/Happy/)).toBeInTheDocument()
  })
})
