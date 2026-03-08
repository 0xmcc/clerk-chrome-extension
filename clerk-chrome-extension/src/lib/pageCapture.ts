import Defuddle, { type DefuddleOptions } from "defuddle"

import type { PageMarkdownCapture } from "./capture"

export const buildDefuddleOptions = (url: string): DefuddleOptions => ({
  markdown: true,
  url,
  // The extension intentionally keeps the fallback local-only.
  // Defuddle's async fallback can call third-party services if enabled.
  useAsync: true
})

export const cloneDocumentForExtraction = (
  sourceDocument: Document
): Document => {
  const parser = new DOMParser()
  return parser.parseFromString(sourceDocument.documentElement.outerHTML, "text/html")
}

export const normalizePageMarkdown = (markdown: string): string =>
  markdown
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

export const isUsablePageMarkdown = (
  markdown: string,
  pageTitle?: string
): boolean => {
  const normalized = normalizePageMarkdown(markdown)
  if (!normalized) {
    return false
  }

  const plainText = normalized
    .replace(/[#>*_`\-\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!plainText) {
    return false
  }

  const normalizedTitle = normalizePageMarkdown(pageTitle ?? "").toLowerCase()
  if (normalizedTitle && plainText.toLowerCase() === normalizedTitle) {
    return false
  }

  return plainText.length >= 20 || plainText.split(/\s+/).length >= 4
}

interface ExtractPageMarkdownParams {
  sourceDocument: Document
  sourceUrl: string
  fallbackTitle: string
  baseCapture: Omit<PageMarkdownCapture, "title" | "markdown">
}

export const extractPageMarkdownCapture = ({
  sourceDocument,
  sourceUrl,
  fallbackTitle,
  baseCapture
}: ExtractPageMarkdownParams): PageMarkdownCapture => {
  const detachedDocument = cloneDocumentForExtraction(sourceDocument)
  const defuddle = new Defuddle(detachedDocument, buildDefuddleOptions(sourceUrl))
  const result = defuddle.parse()
  const markdown = normalizePageMarkdown(result.contentMarkdown ?? result.content ?? "")

  if (!isUsablePageMarkdown(markdown, result.title || fallbackTitle)) {
    throw new Error("No meaningful page content found for page markdown export.")
  }

  return {
    ...baseCapture,
    title: result.title?.trim() || fallbackTitle,
    markdown
  }
}
