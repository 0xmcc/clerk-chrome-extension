import { useEffect, useState, useCallback, useRef } from "react"

import { detectRole, generateMessageId, getLinkedInAuthor, getMessageText } from "~scrapers/domUtils"
import { detectPlatform, getPlatformLabel, type Platform } from "~utils/platform"

const CHECKBOX_CONTAINER_CLASS = "exporter-checkbox-container"
const CHECKBOX_CLASS = "exporter-checkbox"

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

    ".font-claude-response",
    "[data-is-streaming]",
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
  
  // Checkbox state tracking
  const nodeToContainerRef = useRef(new Map<Element, HTMLDivElement>())
  const idToCheckboxRef = useRef(new Map<string, HTMLInputElement>())

  // Keep latest selection without re-creating callbacks
  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  const getConversationKey = useCallback(() => {
    return `${window.location.hostname}${window.location.pathname}${window.location.search}`
  }, [])

  const injectCheckbox = useCallback((node: Element, id: string) => {
    checkboxOverlay.injectCheckbox(node, id, selectedIdsRef.current.has(id), onToggleSelection)
  }, [onToggleSelection])

  const removeAllCheckboxes = useCallback(() => {
    checkboxOverlay.removeAllCheckboxes()
  }, [])

  const scanMessages = useCallback(() => {
    const foundMessages: Message[] = []
    const processedIds = new Set<string>()
    const processedNodes = new Set<Element>()
    const selectors = PLATFORM_SELECTORS[platformRef.current] || PLATFORM_SELECTORS.unknown
    const platformLabel = getPlatformLabel(platformRef.current)

    if (selectors.length === 0) {
      setMessages([])
      return
    }

    const shouldMergeSelectors = platformRef.current === "claude"

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector)
      if (nodes.length === 0) continue

      nodes.forEach((node, index) => {
        if (processedNodes.has(node)) return
        processedNodes.add(node)

        const id = generateMessageId(node, index)

        if (processedIds.has(id)) return
        processedIds.add(id)

        const role = detectRole(node, platformRef.current)
        const text = getMessageText(node, platformRef.current)

        // Derive a clearer author label per platform so exports distinguish you vs the AI
        let authorName: string
        if (platformRef.current === "linkedin") {
          authorName = getLinkedInAuthor(node, role)
        } else {
          authorName = role === "user" ? "You" : platformLabel
        }

        if (text) {
          foundMessages.push({ id, role, text, authorName, node })

          // Inject checkbox if exporter is open
          if (isExporterOpen) {
            injectCheckbox(node, id)
          }
        }
      })

      if (!shouldMergeSelectors && foundMessages.length > 0) {
        break
      }
    }

    setMessages(foundMessages)
  }, [isExporterOpen, injectCheckbox])

  // Update checkboxes when selectedIds changes
  useEffect(() => {
    if (!isExporterOpen) return

    console.log("[useMessageScanner] Syncing checkboxes, selectedIds size:", selectedIds.size)
    messages.forEach((msg) => {
      const shouldBeChecked = selectedIds.has(msg.id)
      const didUpdate = checkboxOverlay.updateCheckboxState(msg.id, shouldBeChecked)
      if (didUpdate) {
        console.log("[useMessageScanner] Updating checkbox", msg.id, "to", shouldBeChecked)
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
