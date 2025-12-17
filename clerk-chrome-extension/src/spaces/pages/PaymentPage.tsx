import type { FormEvent } from "react"
import { Button, Card } from "../components/ui"

type PaymentState = {
  cardNumber: string
  expiry: string
  cvc: string
}

type PaymentPageProps = {
  values: PaymentState
  onChange: (values: PaymentState) => void
  onSubmit: () => void
}

export const PaymentPage = ({ values, onChange, onSubmit }: PaymentPageProps) => {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  const updateField = (key: keyof PaymentState, value: string) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-min-h-screen plasmo-px-4">
      <Card className="plasmo-w-full plasmo-max-w-md plasmo-bg-[#0f0f10] plasmo-border-[#1c1c1e] plasmo-p-8 plasmo-space-y-6">
        <div className="plasmo-text-center plasmo-space-y-2">
          <div className="plasmo-text-lg plasmo-font-semibold">spaces</div>
          <h1 className="plasmo-text-2xl plasmo-font-semibold">Start your trial</h1>
          <p className="plasmo-text-sm plasmo-text-[#a1a1aa]">You won't be charged until your 7-day trial ends.</p>
        </div>

        <div className="plasmo-inline-flex plasmo-items-center plasmo-gap-2 plasmo-rounded-full plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-px-3 plasmo-py-2 plasmo-text-xs plasmo-text-[#d4d4d8]">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          7 days free, then $12/month
        </div>

        <div className="plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-p-4">
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <div className="plasmo-text-sm plasmo-font-semibold">Pro Plan</div>
            <div className="plasmo-text-lg plasmo-font-semibold">
              $12 <span className="plasmo-text-sm plasmo-text-[#a1a1aa]">/mo</span>
            </div>
          </div>
          <div className="plasmo-text-xs plasmo-text-[#a1a1aa]">Unlimited capture · All transforms · Export anytime</div>
        </div>

        <form className="plasmo-space-y-4" onSubmit={handleSubmit}>
          <label className="plasmo-block plasmo-space-y-2">
            <span className="plasmo-text-sm plasmo-text-[#a1a1aa]">Card number</span>
            <input
              type="text"
              value={values.cardNumber}
              onChange={(e) => updateField("cardNumber", e.target.value)}
              placeholder="1234 1234 1234 1234"
              className="plasmo-w-full plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#0d0d0d] plasmo-px-4 plasmo-py-3 plasmo-text-sm focus:plasmo-outline-none focus:plasmo-border-[#3b82f6]"
            />
          </label>
          <div className="plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
            <label className="plasmo-block plasmo-space-y-2">
              <span className="plasmo-text-sm plasmo-text-[#a1a1aa]">Expiry</span>
              <input
                type="text"
                value={values.expiry}
                onChange={(e) => updateField("expiry", e.target.value)}
                placeholder="MM / YY"
                className="plasmo-w-full plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#0d0d0d] plasmo-px-4 plasmo-py-3 plasmo-text-sm focus:plasmo-outline-none focus:plasmo-border-[#3b82f6]"
              />
            </label>
            <label className="plasmo-block plasmo-space-y-2">
              <span className="plasmo-text-sm plasmo-text-[#a1a1aa]">CVC</span>
              <input
                type="text"
                value={values.cvc}
                onChange={(e) => updateField("cvc", e.target.value)}
                placeholder="123"
                className="plasmo-w-full plasmo-rounded-lg plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#0d0d0d] plasmo-px-4 plasmo-py-3 plasmo-text-sm focus:plasmo-outline-none focus:plasmo-border-[#3b82f6]"
              />
            </label>
          </div>
          <Button type="submit" variant="primary" className="plasmo-w-full">
            Start free trial
          </Button>
        </form>

        <div className="plasmo-text-center plasmo-text-sm plasmo-text-[#a1a1aa]">
          Cancel anytime. No questions asked.
        </div>
      </Card>
    </div>
  )
}
