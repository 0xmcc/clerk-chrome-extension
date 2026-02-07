---
name: ai-handoff
version: 1.0.0
description: Receive and continue AI conversation transcripts sent via email from the "Send to my AI" Chrome extension.
homepage: https://github.com/0xmcc/clerk-chrome-extension
---

# AI Handoff

Receive AI conversation transcripts via email and seamlessly continue where they left off.

## What This Is

Your human uses a Chrome extension that captures full conversations from ChatGPT and Claude. When they click **"Send to my AI"**, it emails you a conversation transcript as a markdown attachment with a structured handoff prompt.

Your job: pick up where the other AI left off.

## How It Works

1. Human has a conversation on ChatGPT or Claude
2. They click "Send to my AI" in the extension
3. A transcript file (`.md`) is downloaded and emailed to your inbox
4. You detect the handoff email, read the attachment, and continue the work

## Email Format

**Subject:** `AI Handoff: <conversation title or first message, clipped to 60 chars>`

**Body:**
```
This email contains an AI conversation transcript as an attachment.

HANDOFF_PROMPT:
This is a transcript of a real conversation between a user and an AI.
Treat it as authoritative context. Use it to understand:
- what the user was trying to accomplish
- what has already been explored
- what decisions or conclusions were reached
- what remains unresolved

Do not repeat or summarize the conversation unless necessary.
Continue from where it left off. If there is a clear next step, propose it.
If there are multiple plausible next steps, list them.
If the conversation is complete, say so.
```

**Attachment:** `ai-handoff-<source>-<timestamp>.md`
- `<source>` is `chatgpt` or `claude`
- `<timestamp>` is ISO compact format like `20260207T191240Z`

## Transcript Format

```markdown
# AI Conversation Transcript

- **Source:** <original conversation URL>
- **Captured at:** <ISO timestamp>
- **Platform:** <ChatGPT or Claude>
- **Messages:** <count>

---

**1. User**
<message text>

**2. Assistant**
<message text>

...
```

## Processing a Handoff

When you detect an email matching this pattern:

### 1. Identify it as a handoff
- Subject starts with `AI Handoff:`
- Body contains `HANDOFF_PROMPT:`
- Has a `.md` attachment with `ai-handoff-` prefix

### 2. Download and read the transcript
- Fetch the attachment content
- Parse the metadata (source URL, platform, message count)
- Read the full conversation verbatim

### 3. Analyze the conversation
Follow the handoff prompt exactly:
- **What was the user trying to accomplish?**
- **What has already been explored?**
- **What decisions or conclusions were reached?**
- **What remains unresolved?**

### 4. Notify your human
Send a message to your human with:
- A brief summary of what the conversation was about (2-3 sentences max)
- The key unresolved items or next steps
- Ask if they want you to continue from where it left off

### 5. Continue the work
If asked to continue:
- Do NOT repeat or re-summarize the conversation
- Pick up from the last message
- If there's a clear next step, propose it
- If there are multiple paths, list them
- If the conversation is complete, say so

## Email Monitoring

To process handoffs automatically, check your inbox periodically:

### Heartbeat approach
Add to your `HEARTBEAT.md`:
```markdown
## AI Handoff Check (every 15 minutes)
Check inbox for emails with subject starting "AI Handoff:"
If found, process the transcript and notify human.
```

### Cron approach
Set up a cron job that checks for handoff emails:
```
Schedule: every 15 minutes
Action: Check inbox for unread emails matching "AI Handoff:" subject
```

## Detection Logic (Pseudocode)

```
for each unread email:
  if subject starts with "AI Handoff:":
    attachment = find .md attachment with "ai-handoff-" prefix
    if attachment exists:
      transcript = download(attachment)
      analysis = analyze_conversation(transcript)
      notify_human(analysis)
      mark_email_as_read()
```

## Constraints

- **Never modify the transcript.** It is the source of truth.
- **Never summarize unless asked.** The human already lived through the conversation.
- **Be opinionated about next steps.** Don't just list options — recommend one.
- **Respect the original AI's work.** Don't redo what was already done well.
- **Act fast.** The human sent this because they want continuity, not a delay.

## Example Notification

> 📨 **AI Handoff received** from ChatGPT
>
> **Topic:** Beehiiv newsletter automation app design
> **Messages:** 36 messages covering app architecture, UI layout, and draft/send workflow
>
> **Where it left off:** You and ChatGPT defined the core app structure — sidebar with drafts, WYSIWYG editor, send flow via Beehiiv API. The API integration details and content generation pipeline are still unresolved.
>
> Want me to pick up from here?

## Settings

The extension stores one user setting:

| Setting | Description |
|---------|-------------|
| **My AI Email** | The email address where handoffs are sent. Configured in the extension's Settings view. |

---

Built for the [clerk-chrome-extension](https://github.com/0xmcc/clerk-chrome-extension). Works with any AI agent that can read email.
