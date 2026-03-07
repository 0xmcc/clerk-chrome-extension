import { useState } from "react"

import { sendAgentMailTestEmail } from "../services/agentmail"

type UseSendToMyAITestOptions = {
  setStatusMessage: (message: string) => void
}

type TestEmailParams = {
  aiEmail: string
  aiEmailFrom: string
  aiEmailApiKey: string
}

export const useSendToMyAITest = ({
  setStatusMessage
}: UseSendToMyAITestOptions) => {
  const [isTesting, setIsTesting] = useState(false)

  const sendTestEmail = async ({
    aiEmail,
    aiEmailFrom,
    aiEmailApiKey
  }: TestEmailParams): Promise<boolean> => {
    if (!aiEmail.trim() || !aiEmailFrom.trim() || !aiEmailApiKey.trim()) {
      setStatusMessage("Fill in all email settings first")
      return false
    }

    setIsTesting(true)

    try {
      await sendAgentMailTestEmail({
        toAddress: aiEmail,
        fromAddress: aiEmailFrom,
        apiKey: aiEmailApiKey
      })
      setStatusMessage("✅ Test email sent!")
      return true
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Test failed")
      return false
    } finally {
      setIsTesting(false)
    }
  }

  return {
    isTesting,
    sendTestEmail
  }
}
