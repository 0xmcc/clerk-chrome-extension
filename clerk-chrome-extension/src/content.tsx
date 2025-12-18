import { useState } from "react"
import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"

import { CountButton } from "~features/count-button"
import { FloatingButton } from "~features/floating-button"
import { SelectiveExporter } from "~components/SelectiveExporter"

// Message source identifier from interceptor
const INTERCEPTOR_SOURCE = "__echo_network_interceptor__"

// Listen for messages from MAIN world interceptor and forward to background
window.addEventListener(
  "message",
  (event) => {
    // Security: only accept messages from same window
    if (event.source !== window) return

    const data = event.data
    if (!data || data.source !== INTERCEPTOR_SOURCE) return

    console.log("[Content] Received intercepted data:", data.url)

    // Forward to background script
    chrome.runtime.sendMessage({
      action: "interceptedNetworkData",
      payload: {
        url: data.url,
        method: data.method,
        status: data.status,
        ok: data.ok,
        ts: data.ts,
        data: data.data
      }
    }).catch(err => {
      console.error("[Content] Failed to send to background:", err)
    })
  },
  false
)

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
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

const PlasmoOverlay = () => {
  const [isExporterOpen, setIsExporterOpen] = useState(false)

  return (
    <>
      {/* <div className="plasmo-z-50 plasmo-flex plasmo-fixed plasmo-top-32 plasmo-right-8">
        <CountButton />
      </div> */}
      <FloatingButton onOpenExporter={() => setIsExporterOpen(true)} />
      <SelectiveExporter isOpen={isExporterOpen} onClose={() => setIsExporterOpen(false)} />
    </>
  )
}

export default PlasmoOverlay
