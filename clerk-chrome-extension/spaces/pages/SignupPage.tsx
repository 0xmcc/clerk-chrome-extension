import { Link } from "react-router-dom"

import { Button, Card } from "../components/ui"

type SignupState = {
  email: string
  password: string
}

type SignupPageProps = {
  values: SignupState
  onChange: (values: SignupState) => void
  onSubmit: () => void
  onExistingAccount: () => void
}

export const SignupPage = ({ values: _values, onChange: _onChange, onSubmit, onExistingAccount }: SignupPageProps) => {
  return (
    <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-min-h-screen plasmo-px-4">
      <Card className="plasmo-w-full plasmo-max-w-md plasmo-bg-[#0f0f10] plasmo-border-[#1c1c1e] plasmo-p-8 plasmo-space-y-6">
        <div className="plasmo-text-center plasmo-space-y-2">
          <div className="plasmo-text-lg plasmo-font-semibold">spaces</div>
          <h1 className="plasmo-text-2xl plasmo-font-semibold">Create your account</h1>
          <p className="plasmo-text-sm plasmo-text-[#a1a1aa]">Start your 7-day free trial. No credit card required yet.</p>
        </div>

        <Button variant="primary" className="plasmo-w-full" onClick={onSubmit}>
          Continue with Google
        </Button>

        <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-text-xs plasmo-text-[#52525b]">
          <div className="plasmo-h-px plasmo-flex-1 plasmo-bg-[#1a1a1a]" />
          or
          <div className="plasmo-h-px plasmo-flex-1 plasmo-bg-[#1a1a1a]" />
        </div>

        {/* Email + password form intentionally removed for now; Google sign-in only */}

        <div className="plasmo-text-center plasmo-text-sm plasmo-text-[#a1a1aa]">
          Already have an account?{" "}
          <Link to="/workspace" onClick={onExistingAccount} className="plasmo-text-white">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  )
}
