import { Button, Card } from "../components/ui"

type InstallPageProps = {
  onInstall: () => void
}

export const InstallPage = ({ onInstall }: InstallPageProps) => {
  return (
    <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-min-h-screen plasmo-px-4">
      <Card className="plasmo-w-full plasmo-max-w-md plasmo-bg-[#0f0f10] plasmo-border-[#1c1c1e] plasmo-p-8 plasmo-space-y-6">
        <div className="plasmo-text-lg plasmo-font-semibold">spaces</div>
        <h1 className="plasmo-text-2xl plasmo-font-semibold">Install the extension</h1>
        <p className="plasmo-text-sm plasmo-text-[#a1a1aa]">
          The extension captures conversations as you chat. It runs silently in the background.
        </p>

        <div className="plasmo-flex plasmo-items-center plasmo-gap-4 plasmo-rounded-xl plasmo-border plasmo-border-[#1f1f1f] plasmo-bg-[#111111] plasmo-p-4">
          <div className="plasmo-flex plasmo-h-12 plasmo-w-12 plasmo-items-center plasmo-justify-center plasmo-rounded-lg plasmo-bg-[#18181b]">
            <svg width="28" height="28" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="plasmo-space-y-1">
            <div className="plasmo-text-sm plasmo-font-semibold">Spaces for Chrome</div>
            <div className="plasmo-text-xs plasmo-text-[#a1a1aa]">★★★★★ 4.9 • 2,400+ users</div>
          </div>
        </div>

        <Button variant="primary" className="plasmo-w-full" onClick={onInstall}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="plasmo-mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Add to Chrome
        </Button>
        <p className="plasmo-text-center plasmo-text-xs plasmo-text-[#a1a1aa]">Works with Chrome, Arc, Brave, and Edge</p>
      </Card>
    </div>
  )
}
