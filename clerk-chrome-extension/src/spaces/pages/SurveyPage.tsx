import { useState } from "react"

import { Button, Card } from "../components/ui"
import { surveyOptions } from "../data"
import { cn } from "../utils"

export type SurveyState = {
  tools: string[]
  useCase?: string
  frustration?: string
}

type SurveyPageProps = {
  values: SurveyState
  onChange: (values: SurveyState) => void
  onComplete: () => void
}

export const SurveyPage = ({ values, onChange, onComplete }: SurveyPageProps) => {
  const [step, setStep] = useState(1)

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100

  const toggleTool = (tool: string) => {
    const hasTool = values.tools.includes(tool)
    const nextTools = hasTool ? values.tools.filter((t) => t !== tool) : [...values.tools, tool]
    onChange({ ...values, tools: nextTools })
  }

  const selectUseCase = (useCase: string) => onChange({ ...values, useCase })
  const selectFrustration = (frustration: string) => onChange({ ...values, frustration })

  const nextStep = () => {
    if (step < 3) {
      setStep(step + 1)
    } else {
      onComplete()
    }
  }

  return (
    <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-min-h-screen plasmo-px-4">
      <Card className="plasmo-w-full plasmo-max-w-xl plasmo-bg-[#0f0f10] plasmo-border-[#1c1c1e] plasmo-p-8 plasmo-space-y-6">
        <div className="plasmo-text-lg plasmo-font-semibold">spaces</div>

        <div className="plasmo-h-2 plasmo-rounded-full plasmo-bg-[#111111]">
          <div
            className="plasmo-h-full plasmo-rounded-full plasmo-bg-[#3b82f6] plasmo-transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {step === 1 ? (
          <div className="plasmo-space-y-4">
            <h2 className="plasmo-text-xl plasmo-font-semibold">Which AI tools do you use?</h2>
            <div className="plasmo-grid md:plasmo-grid-cols-3 plasmo-gap-3">
              {surveyOptions.tools.map((tool) => (
                <button
                  key={tool}
                  className={cn(
                    "plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-px-4 plasmo-py-3 plasmo-text-sm",
                    values.tools.includes(tool)
                      ? "plasmo-border-[#3b82f6] plasmo-text-white"
                      : "plasmo-text-[#a1a1aa] hover:plasmo-border-[#2a2a2a]"
                  )}
                  onClick={() => toggleTool(tool)}
                >
                  {tool}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="plasmo-space-y-4">
            <h2 className="plasmo-text-xl plasmo-font-semibold">What do you mainly use AI for?</h2>
            <div className="plasmo-grid md:plasmo-grid-cols-2 plasmo-gap-3">
              {surveyOptions.uses.map((useCase) => (
                <button
                  key={useCase}
                  className={cn(
                    "plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-px-4 plasmo-py-3 plasmo-text-sm plasmo-text-left",
                    values.useCase === useCase
                      ? "plasmo-border-[#3b82f6] plasmo-text-white"
                      : "plasmo-text-[#a1a1aa] hover:plasmo-border-[#2a2a2a]"
                  )}
                  onClick={() => selectUseCase(useCase)}
                >
                  {useCase}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="plasmo-space-y-4">
            <h2 className="plasmo-text-xl plasmo-font-semibold">What's your biggest frustration?</h2>
            <div className="plasmo-grid md:plasmo-grid-cols-2 plasmo-gap-3">
              {surveyOptions.frustrations.map((item) => (
                <button
                  key={item}
                  className={cn(
                    "plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-px-4 plasmo-py-3 plasmo-text-sm plasmo-text-left",
                    values.frustration === item
                      ? "plasmo-border-[#3b82f6] plasmo-text-white"
                      : "plasmo-text-[#a1a1aa] hover:plasmo-border-[#2a2a2a]"
                  )}
                  onClick={() => selectFrustration(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-pt-2">
          <Button variant="ghost" onClick={nextStep}>
            Skip
          </Button>
          <Button variant="primary" onClick={nextStep}>
            {step === 3 ? "Finish" : "Next"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
