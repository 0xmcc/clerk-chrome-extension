import { useEffect, useState, useCallback, useRef } from "react"

export interface Message {
  id: string
  role: "user" | "assistant"
  text: string
  node: Element
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

interface UseMessageScannerProps {
  selectedIds: Set<string>
  onToggleSelection: (id: string) => void
  isExporterOpen: boolean
}

export const useMessageScanner = ({ selectedIds, onToggleSelection, isExporterOpen }: UseMessageScannerProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const selectedIdsRef = useRef(selectedIds)

  // Keep latest selection without re-creating callbacks
  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

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

    for (const selector of MESSAGE_SELECTORS) {
      const nodes = document.querySelectorAll(selector)
      if (nodes.length > 0) {
        nodes.forEach((node, index) => {
          const id = generateMessageId(node, index)

          if (processedIds.has(id)) return
          processedIds.add(id)

          const role = detectRole(node)
          const text = node.textContent?.trim() || ""

          if (text) {
            foundMessages.push({ id, role, text, node })

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

  return { messages, rescan: scanMessages }
}
