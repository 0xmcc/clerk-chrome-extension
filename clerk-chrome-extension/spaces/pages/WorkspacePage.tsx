import { Button, Card, SectionHeader, StatPill } from "../components/ui"
import type { ConversationThread } from "../data"
import { cn } from "../utils"

type WorkspacePageProps = {
  conversations: ConversationThread[]
  onOpenConversation: (conversationId: string) => void
  onTransformConversation: (conversationId: string) => void
}

export const WorkspacePage = ({
  conversations,
  onOpenConversation,
  onTransformConversation
}: WorkspacePageProps) => {
  return (
    <div className="plasmo-space-y-8 plasmo-px-6 plasmo-pb-16">
      <header className="plasmo-flex plasmo-items-center plasmo-justify-between">
        <div className="plasmo-text-xl plasmo-font-semibold">spaces</div>
        <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
          <StatPill>
            <span className="plasmo-h-2 plasmo-w-2 plasmo-rounded-full plasmo-bg-[#22c55e]" />
            Extension active
          </StatPill>
          <div className="plasmo-flex plasmo-h-10 plasmo-w-10 plasmo-items-center plasmo-justify-center plasmo-rounded-full plasmo-bg-[#1a1a1a] plasmo-font-semibold">
            M
          </div>
        </div>
      </header>

      <div className="plasmo-space-y-2">
        <SectionHeader
          title="Conversations"
          subtitle="847 captured across 3 sources"
          actions={<Button variant="secondary">Filter</Button>}
        />
        <div className="plasmo-flex plasmo-gap-2 plasmo-text-sm plasmo-flex-wrap">
          {[
            { label: "All", count: 847, active: true },
            { label: "Claude", count: 523, active: false },
            { label: "ChatGPT", count: 284, active: false },
            { label: "Gemini", count: 40, active: false }
          ].map((filter) => (
            <button
              key={filter.label}
              className={cn(
                "plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-rounded-full plasmo-border plasmo-px-3 plasmo-py-1",
                filter.active
                  ? "plasmo-border-white plasmo-text-white"
                  : "plasmo-border-[#1f1f1f] plasmo-text-[#a1a1aa] hover:plasmo-border-[#2a2a2a]"
              )}
            >
              {filter.label}
              <span className="plasmo-rounded-full plasmo-bg-[#1f1f1f] plasmo-px-2 plasmo-py-0.5 plasmo-text-xs">
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="plasmo-space-y-3">
        {conversations.map((convo) => (
          <Card
            key={convo.id}
            className="plasmo-flex plasmo-gap-4 plasmo-p-5 plasmo-bg-[#0f0f10] plasmo-border-[#1c1c1e] hover:plasmo-border-[#2a2a2a] plasmo-cursor-pointer"
            onClick={() => onOpenConversation(convo.id)}
          >
            <div
              className={cn(
                "plasmo-flex plasmo-h-10 plasmo-w-10 plasmo-items-center plasmo-justify-center plasmo-rounded-lg plasmo-font-semibold",
                convo.source === "Claude" && "plasmo-bg-[#1c1c1e]",
                convo.source === "ChatGPT" && "plasmo-bg-[#1a2b1f]",
                convo.source === "Gemini" && "plasmo-bg-[#111827]"
              )}
            >
              {convo.source[0]}
            </div>
            <div className="plasmo-flex-1 plasmo-space-y-1">
              <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
                <h3 className="plasmo-text-base plasmo-font-semibold">{convo.title}</h3>
                <span className="plasmo-text-xs plasmo-text-[#a1a1aa]">{convo.timestamp}</span>
              </div>
              <p className="plasmo-text-sm plasmo-text-[#a1a1aa]">{convo.preview}</p>
              <div className="plasmo-flex plasmo-gap-3 plasmo-text-xs plasmo-text-[#71717a]">
                <span>{convo.messagesCount} messages</span>
                <span>•</span>
                <span>{convo.source}</span>
              </div>
            </div>
            <div
              className="plasmo-flex plasmo-flex-col plasmo-gap-2"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <Button variant="secondary" size="sm" onClick={() => onOpenConversation(convo.id)}>
                View
              </Button>
              <Button variant="primary" size="sm" onClick={() => onTransformConversation(convo.id)}>
                Transform
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
