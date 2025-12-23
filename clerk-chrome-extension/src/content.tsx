import { useState, useEffect, useRef } from "react"
import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"

import { FloatingButton } from "~features/floating-button"
import { SelectiveExporter } from "~components/SelectiveExporter"
import { useMessageScanner } from "~hooks/useMessageScanner"

export const config: PlasmoCSConfig = {
  matches: [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://*.claude.ai/*"
  ]
}

/**
 * Generates a style element with adjusted CSS to work correctly within a Shadow DOM.
 *
 * Tailwind CSS relies on `rem` units, which are based on the root font size (typically defined on the <html>
 * or <body> element). However, in a Shadow DOM (as used by Plasmo), there is no native root element, so the
 * rem values would reference the actual page's root font size—often leading to sizing inconsistencies.
 *
 * To address this, we:
 * 1. Replace the `:root` selector with `:host(plasmo-csui)` to properly scope the styles within the Shadow DOM.
 * 2. Convert all `rem` units to pixel values using a fixed base font size, ensuring consistent styling
 *    regardless of the host page's font size.
 */
export const getStyle = (): HTMLStyleElement => {
  const baseFontSize = 16

  let updatedCssText = cssText.replaceAll(":root", ":host(plasmo-csui)")
  const remRegex = /([\d.]+)rem/g
  updatedCssText = updatedCssText.replace(remRegex, (match, remValue) => {
    const pixelsValue = parseFloat(remValue) * baseFontSize

    return `${pixelsValue}px`
  })

  const styleElement = document.createElement("style")

  styleElement.textContent = updatedCssText

  return styleElement
}

// Rescan-on-open cooldown to prevent repeated rescans
const RESCAN_ON_OPEN_COOLDOWN_MS = 10000

const PlasmoOverlay = () => {
  const [isExporterOpen, setIsExporterOpen] = useState(false)

  // Track rescan-on-open attempts with timestamp for cooldown-based retry
  const rescanOnOpenAttemptsRef = useRef<Map<string, number>>(new Map())

  // Always-on scanner - no props, returns stable activeConvoKey and activeMessageCount for guards
  const { messages, conversationKey, rescan, activeConvoKey, activeMessageCount } = useMessageScanner()

  // Guarded rescan-on-open: uses store-based activeMessageCount and cooldown retry
  useEffect(() => {
    if (!isExporterOpen) return
    if (!activeConvoKey) return // No active conversation
    if (activeMessageCount > 0) return // Already have messages in store for this convo

    // Check cooldown - allow retry after timeout
    const lastAttempt = rescanOnOpenAttemptsRef.current.get(activeConvoKey) ?? 0
    const now = Date.now()
    if (now - lastAttempt < RESCAN_ON_OPEN_COOLDOWN_MS) return

    rescanOnOpenAttemptsRef.current.set(activeConvoKey, now)
    // Small delay to allow interceptor events to arrive first
    const timer = setTimeout(() => rescan(), 300)
    return () => clearTimeout(timer)
  }, [isExporterOpen, activeConvoKey, activeMessageCount, rescan])

  return (
    <>
      <FloatingButton onOpenExporter={() => setIsExporterOpen(true)} />
      <SelectiveExporter
        isOpen={isExporterOpen}
        onClose={() => setIsExporterOpen(false)}
        messages={messages}
        conversationKey={conversationKey}
      />
    </>
  )
}

export default PlasmoOverlay
