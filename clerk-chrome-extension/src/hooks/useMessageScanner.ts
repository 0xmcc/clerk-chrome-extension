import { useEffect, useState, useCallback, useRef } from "react"

import { detectPlatform, getPlatformLabel, type Platform } from "~utils/platform"

export interface Message {
  id: string
  role: "user" | "assistant"
  text: string
  authorName: string
  node: Element
}

// Message selectors per platform (ordered by specificity)
const PLATFORM_SELECTORS: Record<Platform, string[]> = {
  chatgpt: [
    ".group.w-full.text-token-text-primary",
    "[data-message-id]",
    '[data-testid="conversation-turn"]',
    "[data-message-author-role]"
  ],
  claude: [
    '[data-testid="message-row"]',
    '[data-testid="message"]',
    '[data-testid*="chat-message"]',
    '[data-testid*="assistant-message"]',
    '[data-testid*="user-message"]'
  ],
  linkedin: [
    "[data-event-urn]",
    "li.msg-s-event-listitem",
    ".msg-s-event-listitem__message-bubble",
    "[data-event-id]",
    "[data-urn]",
    "[data-id]"
  ],
  unknown: [
    "[data-message-id]",
    '[data-testid="conversation-turn"]',
    "[data-message-author-role]"
  ]
}

// Detect message role from various attributes
const detectRole = (node: Element, platform: Platform): "user" | "assistant" => {
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

  // Check platform-specific hints
  if (platform === "claude") {
    const authorLabel =
      node.querySelector('[data-testid="message-author"]')?.textContent?.toLowerCase() ||
      node.querySelector('[data-testid="avatar"]')?.getAttribute("aria-label")?.toLowerCase()

    if (authorLabel?.includes("you")) return "user"
    if (authorLabel?.includes("claude")) return "assistant"
  }

  if (platform === "linkedin") {
    const liLabel = node.getAttribute("aria-label")?.toLowerCase()
    if (liLabel?.includes("you said") || liLabel?.includes("you sent")) return "user"
  }

  // Inspect dataset and class names for role hints
  const datasetValues = Object.values((node as HTMLElement).dataset || {})
    .join(" ")
    .toLowerCase()
  const className = (node as HTMLElement).className?.toString().toLowerCase() || ""

  if (
    datasetValues.includes("user") ||
    datasetValues.includes("human") ||
    datasetValues.includes("self") ||
    datasetValues.includes("outgoing") ||
    datasetValues.includes("sender") ||
    datasetValues.includes("me") ||
    className.includes("user") ||
    className.includes("human") ||
    className.includes("self") ||
    className.includes("outgoing") ||
    className.includes("sent") ||
    className.includes("me") ||
    className.includes("mine") ||
    className.includes("you")
  ) {
    return "user"
  }

  if (
    datasetValues.includes("assistant") ||
    datasetValues.includes("bot") ||
    datasetValues.includes("claude") ||
    datasetValues.includes("incoming") ||
    datasetValues.includes("received") ||
    className.includes("assistant") ||
    className.includes("bot") ||
    className.includes("claude") ||
    className.includes("incoming") ||
    className.includes("received")
  ) {
    return "assistant"
  }

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

  const img = node.querySelector("img")
  if (img) {
    const alt = img.getAttribute("alt")?.toLowerCase()
    if (alt?.includes("user") || alt?.includes("you")) {
      return "user"
    }
  }

  return "assistant"
}

// Generate unique ID for message
const generateMessageId = (node: Element, index: number): string => {
  const dataId =
    node.getAttribute("data-event-urn") ||
    node.getAttribute("data-message-id") ||
    node.getAttribute("data-id") ||
    node.getAttribute("id")

  if (dataId) return dataId

  const text = node.textContent || ""
  const hash = text.split("").reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0
  }, 0)

  return `msg-${Math.abs(hash)}-${index}`
}

const normalizeText = (text: string): string => {
  return text.replace(/\s+\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

const getLinkedInAuthor = (node: Element, role: "user" | "assistant"): string => {
  const nameFromHeading = node.querySelector(".msg-s-message-group__name")?.textContent
  if (nameFromHeading) return normalizeText(nameFromHeading)

  const a11yHeading = node.querySelector(".msg-s-event-listitem--group-a11y-heading")?.textContent
  if (a11yHeading) {
    const cleaned = normalizeText(a11yHeading)
    const parts = cleaned.split(" sent")
    if (parts[0]) return parts[0]
  }

  const imgAlt = node.querySelector(".msg-s-event-listitem__profile-picture")?.getAttribute("alt")
  if (imgAlt) return normalizeText(imgAlt)

  return role === "user" ? "You" : "Contact"
}

const getMessageText = (node: Element, platform: Platform): string => {
  if (platform === "linkedin") {
    const body =
      node.querySelector(".msg-s-event-listitem__body") ||
      node.querySelector(".msg-s-event__content") ||
      node.querySelector(".msg-s-event-listitem__message-bubble")

    if (body?.textContent) return normalizeText(body.textContent)
  }

  const text = node.textContent?.trim() || ""
  return normalizeText(text)
}

interface UseMessageScannerProps {
  selectedIds: Set<string>
  onToggleSelection: (id: string) => void
  isExporterOpen: boolean
}

export const useMessageScanner = ({ selectedIds, onToggleSelection, isExporterOpen }: UseMessageScannerProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const selectedIdsRef = useRef(selectedIds)
  const platformRef = useRef<Platform>(detectPlatform())
  const conversationKeyRef = useRef<string>(`${window.location.hostname}${window.location.pathname}${window.location.search}`)

  // Keep latest selection without re-creating callbacks
  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  const getConversationKey = useCallback(() => {
    return `${window.location.hostname}${window.location.pathname}${window.location.search}`
  }, [])

  // Inject checkbox into message node
  const injectCheckbox = useCallback((node: Element, id: string) => {
    // Check if checkbox already exists
    if (node.querySelector(".exporter-checkbox-container")) return

    // Create checkbox container
    const container = document.createElement("div")
    container.className = "exporter-checkbox-container"
    container.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 100;
      background: rgba(255, 255, 255, 0.9);
      padding: 4px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      user-select: none;
    `

    // Create checkbox
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.className = "exporter-checkbox"
    checkbox.dataset.messageId = id
    checkbox.checked = selectedIdsRef.current.has(id)
    checkbox.style.cssText = `
      width: 16px;
      height: 16px;
      cursor: pointer;
      margin: 0;
    `

    // Handle checkbox click
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation()
      console.log("[Checkbox] Clicked:", id, "Current checked:", checkbox.checked)
      onToggleSelection(id)
    })

    container.appendChild(checkbox)

    // Make parent position relative if it isn't
    const computedStyle = window.getComputedStyle(node as HTMLElement)
    if (computedStyle.position === "static") {
      ;(node as HTMLElement).style.position = "relative"
    }

    // Prepend to message node
    node.prepend(container)
  }, [onToggleSelection])

  // Remove all checkboxes
  const removeAllCheckboxes = useCallback(() => {
    document.querySelectorAll(".exporter-checkbox-container").forEach((el) => el.remove())
  }, [])

  const scanMessages = useCallback(() => {
    const foundMessages: Message[] = []
    const processedIds = new Set<string>()
    const selectors = PLATFORM_SELECTORS[platformRef.current] || PLATFORM_SELECTORS.unknown
    const platformLabel = getPlatformLabel(platformRef.current)

    if (selectors.length === 0) {
      setMessages([])
      return
    }

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector)
      if (nodes.length > 0) {
        nodes.forEach((node, index) => {
          const id = generateMessageId(node, index)

          if (processedIds.has(id)) return
          processedIds.add(id)

          const role = detectRole(node, platformRef.current)
          const text = getMessageText(node, platformRef.current)

          // Derive a clearer author label per platform so exports distinguish you vs the AI
          let authorName: string
          if (platformRef.current === "linkedin") {
            authorName = getLinkedInAuthor(node, role)
          } else if (platformRef.current === "chatgpt") {
            // On ChatGPT both sides are visually "ChatGPT"; treat user as "You" for exports
            authorName = role === "user" ? "You" : platformLabel
          } else {
            authorName = platformLabel
          }

          if (text) {
            foundMessages.push({ id, role, text, authorName, node })

            // Inject checkbox if exporter is open
            if (isExporterOpen) {
              injectCheckbox(node, id)
            }
          }
        })

        if (foundMessages.length > 0) break
      }
    }

    setMessages(foundMessages)
  }, [isExporterOpen, injectCheckbox])

  // Update checkboxes when selectedIds changes
  useEffect(() => {
    if (!isExporterOpen) return

    console.log("[useMessageScanner] Syncing checkboxes, selectedIds size:", selectedIds.size)
    messages.forEach((msg) => {
      const checkbox = msg.node.querySelector(`.exporter-checkbox[data-message-id="${msg.id}"]`) as HTMLInputElement
      if (checkbox) {
        const shouldBeChecked = selectedIds.has(msg.id)
        if (checkbox.checked !== shouldBeChecked) {
          console.log("[useMessageScanner] Updating checkbox", msg.id, "to", shouldBeChecked)
          checkbox.checked = shouldBeChecked
        }
      }
    })
  }, [isExporterOpen, selectedIds, messages])

  // Remove checkboxes when exporter closes
  useEffect(() => {
    if (!isExporterOpen) {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = null
      }
      removeAllCheckboxes()
      return
    }

    // Rescan to inject checkboxes when drawer opens
    scanMessages()
  }, [isExporterOpen, removeAllCheckboxes, scanMessages])

  const scheduleScan = useCallback(() => {
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
    scanTimeoutRef.current = setTimeout(() => {
      scanMessages()
      scanTimeoutRef.current = null
    }, 120)
  }, [scanMessages])

  useEffect(() => {
    if (!isExporterOpen) return

    scanMessages()

    const observer = new MutationObserver(() => {
      scheduleScan()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => {
      observer.disconnect()
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = null
      }
      removeAllCheckboxes()
    }
  }, [isExporterOpen, scanMessages, scheduleScan, removeAllCheckboxes])

  // Detect conversation changes via URL changes
  useEffect(() => {
    if (!isExporterOpen) return

    const interval = setInterval(() => {
      const key = getConversationKey()
      if (key !== conversationKeyRef.current) {
        conversationKeyRef.current = key
        removeAllCheckboxes()
        setMessages([])
        scanMessages()
      }
    }, 500)

    return () => clearInterval(interval)
  }, [getConversationKey, isExporterOpen, removeAllCheckboxes, scanMessages])

  return { messages, rescan: scanMessages, conversationKey: conversationKeyRef.current }
}
