import { ConversationDepthIndicator } from "../components/ConversationDepthIndicator"
import { DARK_THEME } from "../constants"
import { AccountSection } from "./settings/AccountSection"
import { ExportBehaviorSection } from "./settings/ExportBehaviorSection"
import { GitHubSection } from "./settings/GitHubSection"
import { MomentumSyncSection } from "./settings/MomentumSyncSection"
import { SendToMyAISettingsSection } from "./settings/SendToMyAISettingsSection"

interface SettingsViewProps {
  messages: Array<{ text: string; role: string }>
  aiEmail: string
  aiEmailFrom: string
  aiEmailProvider: string
  aiEmailApiKey: string
  onAiEmailChange: (value: string) => void
  onAiEmailFromChange: (value: string) => void
  onAiEmailProviderChange: (value: string) => void
  onAiEmailApiKeyChange: (value: string) => void
  onLogout: () => Promise<{ success: boolean; error?: string }>
  setStatusMessage: (message: string) => void
  isSignedOut: boolean
  onSignInClick: () => void
  includeHidden: boolean
  onIncludeHiddenChange: (value: boolean) => void
  showSendToMyAI: boolean
  momentumSyncUrl: string
  momentumSyncToken: string
  onMomentumSyncUrlChange: (value: string) => void
  onMomentumSyncTokenChange: (value: string) => void
}

export const SettingsView = ({
  messages,
  aiEmail,
  aiEmailFrom,
  aiEmailProvider,
  aiEmailApiKey,
  onAiEmailChange,
  onAiEmailFromChange,
  onAiEmailProviderChange,
  onAiEmailApiKeyChange,
  onLogout,
  setStatusMessage,
  isSignedOut,
  onSignInClick,
  includeHidden,
  onIncludeHiddenChange,
  showSendToMyAI,
  momentumSyncUrl,
  momentumSyncToken,
  onMomentumSyncUrlChange,
  onMomentumSyncTokenChange
}: SettingsViewProps) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
    <div
      style={{
        paddingBottom: "16px",
        borderBottom: `1px solid ${DARK_THEME.borderSubtle}`
      }}>
      <ConversationDepthIndicator messages={messages} />
    </div>

    {showSendToMyAI && (
      <SendToMyAISettingsSection
        aiEmail={aiEmail}
        aiEmailFrom={aiEmailFrom}
        aiEmailProvider={aiEmailProvider}
        aiEmailApiKey={aiEmailApiKey}
        onAiEmailChange={onAiEmailChange}
        onAiEmailFromChange={onAiEmailFromChange}
        onAiEmailProviderChange={onAiEmailProviderChange}
        onAiEmailApiKeyChange={onAiEmailApiKeyChange}
        setStatusMessage={setStatusMessage}
      />
    )}

    <ExportBehaviorSection
      includeHidden={includeHidden}
      onIncludeHiddenChange={onIncludeHiddenChange}
    />

    <MomentumSyncSection
      momentumSyncUrl={momentumSyncUrl}
      momentumSyncToken={momentumSyncToken}
      onMomentumSyncUrlChange={onMomentumSyncUrlChange}
      onMomentumSyncTokenChange={onMomentumSyncTokenChange}
    />

    <AccountSection
      onLogout={onLogout}
      setStatusMessage={setStatusMessage}
      isSignedOut={isSignedOut}
      onSignInClick={onSignInClick}
    />

    <GitHubSection />
  </div>
)
