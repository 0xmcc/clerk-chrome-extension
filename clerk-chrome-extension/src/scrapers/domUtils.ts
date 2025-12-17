import type { Platform } from "~utils/platform"

// Detect message role from various attributes
export const detectRole = (node: Element, platform: Platform): "user" | "assistant" => {
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
export const generateMessageId = (node: Element, index: number): string => {
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

export const normalizeText = (text: string): string => {
  return text.replace(/\s+\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

export const getLinkedInAuthor = (node: Element, role: "user" | "assistant"): string => {
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

export const getMessageText = (node: Element, platform: Platform): string => {
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
