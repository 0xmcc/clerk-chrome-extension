export type TransformType = "insights" | "profile" | "summary" | "blog"

export type SourceType = "Claude" | "ChatGPT" | "Gemini"

export const featureCards = [
  {
    title: "All sources, one place",
    description: "Claude, ChatGPT, Gemini—captured automatically as you chat.",
    icon: "list"
  },
  {
    title: "Transform, don't just store",
    description: "Turn conversations into key insights, strategy docs, or blog drafts.",
    icon: "spark"
  },
  {
    title: "Context that travels",
    description: "Extract portable context profiles. Start fresh without starting over.",
    icon: "share"
  }
]

export const transformOptions = [
  {
    type: "insights" as TransformType,
    title: "Key Insights",
    description: "Decisions, learnings, takeaways"
  },
  {
    type: "profile" as TransformType,
    title: "Context Profile",
    description: "JSON to prime fresh conversations"
  },
  {
    type: "summary" as TransformType,
    title: "Strategy Doc",
    description: "Structured summary for sharing"
  },
  {
    type: "blog" as TransformType,
    title: "Blog Draft",
    description: "Content in your voice"
  }
]

export const transformOutputs: Record<
  TransformType,
  {
    title: string
    body: string
  }
> = {
  insights: {
    title: "Key Insights",
    body: `<h3>Core Problem</h3>
<ul>
  <li>Gap between "generating state" in AI convos and making it useful later</li>
  <li>Most people lose 90% of the value of their thinking</li>
</ul>

<h3>Strategic Decision</h3>
<ul>
  <li>Chrome extension sidesteps API/export fragmentation</li>
  <li>Capture at render layer where user already has access</li>
</ul>

<h3>Key Insight: Superhuman Model</h3>
<ul>
  <li>Speed as core value prop</li>
  <li>Opinionated workflow, not just a viewer</li>
</ul>`
  },
  profile: {
    title: "Context Profile",
    body: `<pre style="font-family: monospace; font-size: 0.9rem; color: #a1a1aa; white-space: pre-wrap;">{
  "context": {
    "project": "Personal data lake app",
    "approach": "Chrome extension + web app"
  },
  "decisions": {
    "capture_method": "Chrome extension",
    "model": "Superhuman for AI conversations"
  },
  "user_preferences": {
    "style": "Direct, minimal hand-holding"
  }
}</pre>`
  },
  summary: {
    title: "Strategy Doc",
    body: `<h3>Personal Data Lake: Product Spec</h3>
<p><strong>Problem:</strong> Users generate valuable "state" through AI conversations but lose 90% because it's not captured or searchable.</p>
<p><strong>Solution:</strong> Chrome extension that captures conversations, combined with Superhuman-style interface for browsing and transforming.</p>
<p><strong>Key tension:</strong> Be the pipe vs be the destination.</p>`
  },
  blog: {
    title: "Blog Draft",
    body: `<h3>Why Your AI Conversations Are Underutilized</h3>
<p>Every conversation with Claude or ChatGPT represents real intellectual work. You explain context, work through problems, reach conclusions.</p>
<p>Then you close the tab and it's gone.</p>
<p>What if all of that accumulated instead?</p>
<p><em>[Draft continues...]</em></p>`
  }
}

export type ConversationMessage = {
  id: string
  role: "user" | "assistant"
  author: string
  time: string
  paragraphs: string[]
}

export type ConversationThread = {
  id: string
  source: SourceType
  title: string
  preview: string
  messagesCount: number
  timestamp: string
  messages: ConversationMessage[]
}

export const conversationThreads: ConversationThread[] = [
  {
    id: "personal-data-lake",
    source: "Claude",
    title: "Personal data lake product spec",
    preview: "Discussion about Chrome extension architecture and transformation workflows",
    messagesCount: 39,
    timestamp: "2 hours ago",
    messages: [
      {
        id: "m1",
        role: "user",
        author: "You",
        time: "4:15 PM",
        paragraphs: [
          "Thoughts on the product spec implications for a personal data lake app that aggregates your LLM conversations from various AI apps and social media data?"
        ]
      },
      {
        id: "m2",
        role: "assistant",
        author: "Claude",
        time: "4:15 PM",
        paragraphs: [
          "This is a juicy one. The tweet articulates the vision well—the gap between \"generating state\" and having that state be useful later is where most people lose 90% of the value of their own thinking.",
          "Some real tensions I'd want the spec to grapple with:",
          "Data portability is the first wall. ChatGPT has export, Claude has export, but they're different formats with different metadata richness."
        ]
      },
      {
        id: "m3",
        role: "user",
        author: "You",
        time: "4:18 PM",
        paragraphs: [
          "I'm building this. Starting with a chrome extension that exports all your LLM conversations into a database. Then you can see them and interact with your convos in an app that is like superhuman is to Gmail."
        ]
      },
      {
        id: "m4",
        role: "assistant",
        author: "Claude",
        time: "4:18 PM",
        paragraphs: [
          "That's a strong wedge. Chrome extension sidesteps the API/export fragmentation problem entirely—you're capturing at the render layer where the user already has access.",
          "The Superhuman comp is clarifying. What made Superhuman work:",
          "Speed as the core value prop. Everything rendered instantly, keyboard-first. For LLM convos, the equivalent might be: how fast can I find \"that thing I figured out about BLoC architecture three weeks ago\"?"
        ]
      }
    ]
  },
  {
    id: "bloc-architecture",
    source: "Claude",
    title: "Flutter BLoC architecture deep dive",
    preview: "Explored the Logic Layer Problem and state management approaches",
    messagesCount: 47,
    timestamp: "Yesterday",
    messages: []
  },
  {
    id: "video-transcript",
    source: "ChatGPT",
    title: "Video transcript sync approach",
    preview: "Semantic chunking at sentence boundaries for bi-directional sync",
    messagesCount: 28,
    timestamp: "2 days ago",
    messages: []
  }
]

export const surveyOptions = {
  tools: ["Claude", "ChatGPT", "Gemini", "Perplexity", "Cursor", "Other"],
  uses: ["Coding & development", "Writing & content", "Research & learning", "Business strategy", "Creative projects"],
  frustrations: [
    "Re-explaining context every time",
    "Can't find past conversations",
    "Insights scattered everywhere",
    "Losing good ideas in the scroll"
  ]
}

export const sourcesPreview = [
  { name: "Claude", count: "523 convos", accent: "claude" },
  { name: "ChatGPT", count: "284 convos", accent: "gpt" },
  { name: "Gemini", count: "40 convos", accent: "gemini" }
]
