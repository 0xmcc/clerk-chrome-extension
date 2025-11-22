import { useEffect, useState } from "react"

export interface Message {
  id: string
  role: "user" | "assistant"
  text: string
}

// ChatGPT message selectors (multiple fallbacks)
const MESSAGE_SELECTORS = [
  ".group.w-full.text-token-text-primary",
  "[data-message-id]",
  '[data-testid="conversation-turn"]',
  "[data-message-author-role]"
]

// Detect message role from various attributes
const detectRole = (node: Element): "user" | "assistant" => {
  // Check data attributes
  const roleAttr =
    node.getAttribute("data-message-author-role") ||
    node.getAttribute("data-role") ||
    node.getAttribute("data-testid")

  if (roleAttr) {
    const lower = roleAttr.toLowerCase()
    if (lower.includes("assistant") || lower.includes("gpt") || lower.includes("system")) {
      return "assistant"
    }
    if (lower.includes("user") || lower.includes("you")) {
      return "user"
    }
  }

  // Check aria-label
  const ariaLabel = node.getAttribute("aria-label")
  if (ariaLabel) {
    const lower = ariaLabel.toLowerCase()
    if (lower.includes("assistant") || lower.includes("gpt")) {
      return "assistant"
    }
    if (lower.includes("user") || lower.includes("you")) {
      return "user"
    }
  }

  // Check for img alt text (avatar detection)
  const img = node.querySelector("img")
  if (img) {
    const alt = img.getAttribute("alt")?.toLowerCase()
    if (alt?.includes("user") || alt?.includes("you")) {
      return "user"
    }
  }

  // Default to assistant if unsure
  return "assistant"
}

// Generate unique ID for message
const generateMessageId = (node: Element, index: number): string => {
  // Try to get ID from attributes
  const dataId =
    node.getAttribute("data-message-id") ||
    node.getAttribute("data-id") ||
    node.getAttribute("id")

  if (dataId) return dataId

  // Generate hash from content
  const text = node.textContent || ""
  const hash = text.split("").reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0
  }, 0)

  return `msg-${Math.abs(hash)}-${index}`
}

export const useMessageScanner = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [scanTimeout, setScanTimeout] = useState<NodeJS.Timeout | null>(null)

  const scanMessages = () => {
    const foundMessages: Message[] = []
    const processedIds = new Set<string>()

    // Try each selector until we find messages
    for (const selector of MESSAGE_SELECTORS) {
      const nodes = document.querySelectorAll(selector)
      if (nodes.length > 0) {
        nodes.forEach((node, index) => {
          const id = generateMessageId(node, index)

          // Skip if already processed
          if (processedIds.has(id)) return
          processedIds.add(id)

          const role = detectRole(node)
          const text = node.textContent?.trim() || ""

          if (text) {
            foundMessages.push({ id, role, text })
          }
        })

        // If we found messages with this selector, stop trying others
        if (foundMessages.length > 0) break
      }
    }

    setMessages(foundMessages)
  }

  // Debounced scan (prevents excessive scanning during rapid DOM changes)
  const scheduleScan = () => {
    if (scanTimeout) clearTimeout(scanTimeout)
    const timeout = setTimeout(() => {
      scanMessages()
    }, 120)
    setScanTimeout(timeout)
  }

  useEffect(() => {
    // Initial scan
    scanMessages()

    // Watch for new messages (MutationObserver)
    const observer = new MutationObserver(() => {
      scheduleScan()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => {
      observer.disconnect()
      if (scanTimeout) clearTimeout(scanTimeout)
    }
  }, [])

  return { messages, rescan: scanMessages }
}
