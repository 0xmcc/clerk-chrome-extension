import Defuddle, { type DefuddleOptions } from "defuddle"

import { createMarkdownContent } from "../../node_modules/defuddle/dist/markdown.js"
import type { PageMarkdownCapture } from "./capture"

const CONTENT_ROOT_SELECTORS = [
  "[itemprop='articleBody']",
  "main article",
  "[role='main'] article",
  "article",
  ".post-content",
  ".entry-content",
  ".article-content",
  ".article-body",
  ".post-body",
  ".post-main",
  ".story-content",
  ".story-body",
  ".blog-content",
  ".page-content",
  ".content-area",
  ".markdown-body",
  ".prose",
  "main",
  "[role='main']"
] as const

const NOISY_CONTENT_HINT =
  /\b(author|bio|breadcrumb|comment|contents?|footer|header|hero|menu|nav|newsletter|promo|related|share|sidebar|social|tab|toc)\b/i
const MIN_CONTENT_TEXT_LENGTH = 400
const MIN_DESCENDANT_TEXT_RATIO = 0.6
const MIN_DESCENDANT_PARAGRAPH_RATIO = 0.5

export const buildDefuddleOptions = (url: string): DefuddleOptions => ({
  url,
  // The extension intentionally keeps the fallback local-only.
  // Defuddle's async fallback can call third-party services if enabled.
  useAsync: false
})

export const cloneDocumentForExtraction = (
  sourceDocument: Document
): Document => {
  const parser = new DOMParser()
  return parser.parseFromString(
    sourceDocument.documentElement.outerHTML,
    "text/html"
  )
}

interface ContentMetrics {
  headingCount: number
  linkDensity: number
  paragraphCount: number
  score: number
  textLength: number
}

const getNormalizedText = (element: Element): string =>
  (element.textContent ?? "").replace(/\s+/g, " ").trim()

export const measureContentCandidate = (element: Element): ContentMetrics => {
  const text = getNormalizedText(element)
  const textLength = text.length
  const paragraphCount = element.querySelectorAll("p").length
  const headingCount = element.querySelectorAll("h1, h2, h3").length
  const linkTextLength = Array.from(element.querySelectorAll("a")).reduce(
    (sum, link) => sum + getNormalizedText(link).length,
    0
  )
  const linkDensity = linkTextLength / Math.max(textLength, 1)
  const attributes = `${element.className ?? ""} ${element.id ?? ""}`
  const noisePenalty = NOISY_CONTENT_HINT.test(attributes) ? 1200 : 0

  return {
    textLength,
    paragraphCount,
    headingCount,
    linkDensity,
    score:
      textLength +
      paragraphCount * 250 +
      headingCount * 150 -
      linkDensity * 2500 -
      noisePenalty
  }
}

const chooseBestCandidate = (candidates: Element[]): Element | null => {
  let bestCandidate: Element | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const candidate of candidates) {
    const metrics = measureContentCandidate(candidate)
    if (metrics.textLength < MIN_CONTENT_TEXT_LENGTH) continue

    if (metrics.score > bestScore) {
      bestCandidate = candidate
      bestScore = metrics.score
    }
  }

  return bestCandidate
}

export const findPrimaryContentRoot = (
  sourceDocument: Document
): Element | null => {
  const selectorMatches = CONTENT_ROOT_SELECTORS.flatMap((selector) =>
    Array.from(sourceDocument.querySelectorAll(selector))
  )
  const uniqueCandidates = Array.from(new Set(selectorMatches))

  const rootCandidate =
    chooseBestCandidate(uniqueCandidates) ??
    chooseBestCandidate(Array.from(sourceDocument.body.children))

  if (!rootCandidate) return null

  let current = rootCandidate

  while (true) {
    const currentMetrics = measureContentCandidate(current)
    const childCandidates = Array.from(current.children).filter((child) => {
      const metrics = measureContentCandidate(child)

      if (metrics.textLength < MIN_CONTENT_TEXT_LENGTH) return false
      if (
        metrics.textLength <
        currentMetrics.textLength * MIN_DESCENDANT_TEXT_RATIO
      ) {
        return false
      }

      if (
        currentMetrics.paragraphCount >= 4 &&
        metrics.paragraphCount <
          Math.max(
            3,
            currentMetrics.paragraphCount * MIN_DESCENDANT_PARAGRAPH_RATIO
          )
      ) {
        return false
      }

      return true
    })

    const bestChild = chooseBestCandidate(childCandidates)
    if (!bestChild) {
      return current
    }

    current = bestChild
  }
}

export const buildDocumentForExtraction = (
  sourceDocument: Document
): Document => {
  const detachedDocument = cloneDocumentForExtraction(sourceDocument)
  const rootCandidate = findPrimaryContentRoot(detachedDocument)

  if (!rootCandidate) {
    return detachedDocument
  }

  const scopedDocument = detachedDocument.implementation.createHTMLDocument(
    sourceDocument.title || detachedDocument.title
  )

  if (detachedDocument.head) {
    for (const meta of Array.from(
      detachedDocument.head.querySelectorAll("meta, link[rel='canonical']")
    )) {
      scopedDocument.head.appendChild(meta.cloneNode(true))
    }
  }

  scopedDocument.body.appendChild(rootCandidate.cloneNode(true))

  return scopedDocument
}

export const normalizePageMarkdown = (markdown: string): string =>
  markdown
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

const DEFUDDLE_PARTIAL_MARKDOWN_PREFIX =
  "Partial conversion completed with errors. Original HTML:"
const REMOTE_MARKDOWN_FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n*/
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\([^)]+\)/g
const MARKDOWN_HEADING_PATTERN = /^#{1,6}\s+/gm
const MARKDOWN_BOILERPLATE_HINT =
  /\b(author|bio|breadcrumb|comment|contents?|cookie|footer|header|menu|nav|newsletter|promo|related|share|sidebar|sign up|subscribe)\b/gi

export const isDefuddleMarkdownFailure = (markdown: string): boolean =>
  normalizePageMarkdown(markdown).startsWith(DEFUDDLE_PARTIAL_MARKDOWN_PREFIX)

const stripMarkdownFrontmatter = (markdown: string): string =>
  markdown.replace(REMOTE_MARKDOWN_FRONTMATTER_PATTERN, "")

export const parseMarkdownFrontmatter = (
  markdown: string
): {
  attributes: Record<string, string>
  body: string
} => {
  const match = markdown.match(REMOTE_MARKDOWN_FRONTMATTER_PATTERN)

  if (!match) {
    return {
      attributes: {},
      body: markdown
    }
  }

  const attributes = match[1]
    .split("\n")
    .reduce<Record<string, string>>((accumulator, line) => {
      const separatorIndex = line.indexOf(":")
      if (separatorIndex <= 0) {
        return accumulator
      }

      const key = line.slice(0, separatorIndex).trim()
      const rawValue = line.slice(separatorIndex + 1).trim()
      const value = rawValue.replace(/^['"]|['"]$/g, "")

      if (key) {
        accumulator[key] = value
      }

      return accumulator
    }, {})

  return {
    attributes,
    body: markdown.slice(match[0].length)
  }
}

const normalizeComparableUrl = (input: string): string => {
  try {
    const url = new URL(input)
    url.hash = ""

    if (
      (url.protocol === "https:" && url.port === "443") ||
      (url.protocol === "http:" && url.port === "80")
    ) {
      url.port = ""
    }

    return url.toString().replace(/\/$/, "")
  } catch {
    return input.trim().replace(/\/$/, "")
  }
}

interface MarkdownQualityMetrics {
  boilerplateHitCount: number
  headingCount: number
  imageCount: number
  linkDensity: number
  paragraphCount: number
  score: number
  wordCount: number
}

export const measureMarkdownQuality = (
  markdown: string
): MarkdownQualityMetrics => {
  const markdownBody = stripMarkdownFrontmatter(normalizePageMarkdown(markdown))
  const linkTexts = Array.from(
    markdownBody.matchAll(MARKDOWN_LINK_PATTERN),
    (match) => match[1]
  )
  const plainText = markdownBody
    .replace(MARKDOWN_IMAGE_PATTERN, " ")
    .replace(MARKDOWN_LINK_PATTERN, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const wordCount = plainText ? plainText.split(/\s+/).length : 0
  const headingCount = (markdownBody.match(MARKDOWN_HEADING_PATTERN) ?? [])
    .length
  const paragraphCount = markdownBody.split(/\n{2,}/).filter((block) => {
    const normalizedBlock = block.replace(/[#>*_`~-]/g, " ").trim()
    return normalizedBlock.length >= 40
  }).length
  const imageCount = (markdownBody.match(MARKDOWN_IMAGE_PATTERN) ?? []).length
  const boilerplateHitCount = (plainText.match(MARKDOWN_BOILERPLATE_HINT) ?? [])
    .length
  const linkTextLength = linkTexts.reduce((sum, text) => sum + text.length, 0)
  const linkDensity = linkTextLength / Math.max(plainText.length, 1)

  return {
    wordCount,
    paragraphCount,
    headingCount,
    imageCount,
    boilerplateHitCount,
    linkDensity,
    score:
      wordCount * 18 +
      paragraphCount * 110 +
      headingCount * 140 -
      imageCount * 35 -
      boilerplateHitCount * 160 -
      linkDensity * 1800
  }
}

export const isUsablePageMarkdown = (
  markdown: string,
  pageTitle?: string
): boolean => {
  const normalized = stripMarkdownFrontmatter(normalizePageMarkdown(markdown))
  if (!normalized) {
    return false
  }

  const plainText = normalized
    .replace(/<[^>]+>/g, " ")
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

interface ResolvePageMarkdownParams extends ExtractPageMarkdownParams {
  preferRemote?: boolean
  remoteMarkdownLoader?: ((sourceUrl: string) => Promise<string | null>) | null
}

const buildPageMarkdownCapture = (
  baseCapture: Omit<PageMarkdownCapture, "title" | "markdown">,
  title: string,
  markdown: string
): PageMarkdownCapture => ({
  ...baseCapture,
  title,
  markdown
})

const buildRemotePageMarkdownCapture = ({
  sourceUrl,
  fallbackTitle,
  baseCapture,
  remoteMarkdown
}: Omit<
  ResolvePageMarkdownParams,
  "sourceDocument" | "preferRemote" | "remoteMarkdownLoader"
> & {
  remoteMarkdown: string
}): PageMarkdownCapture | null => {
  const { attributes, body } = parseMarkdownFrontmatter(remoteMarkdown)
  const extractedTitle = attributes.title?.trim() || fallbackTitle
  const comparableSourceUrl = normalizeComparableUrl(sourceUrl)
  const comparableRemoteSource = attributes.source
    ? normalizeComparableUrl(attributes.source)
    : null

  if (
    comparableRemoteSource &&
    comparableRemoteSource !== comparableSourceUrl
  ) {
    return null
  }

  const markdown = normalizePageMarkdown(body)
  if (!isUsablePageMarkdown(markdown, extractedTitle)) {
    return null
  }

  return buildPageMarkdownCapture(baseCapture, extractedTitle, markdown)
}

export const choosePreferredPageMarkdownCapture = (
  localCapture: PageMarkdownCapture | null,
  remoteCapture: PageMarkdownCapture | null
): PageMarkdownCapture | null => {
  if (!localCapture) return remoteCapture
  if (!remoteCapture) return localCapture

  const localMetrics = measureMarkdownQuality(localCapture.markdown)
  const remoteMetrics = measureMarkdownQuality(remoteCapture.markdown)

  return remoteMetrics.score + 180 >= localMetrics.score
    ? remoteCapture
    : localCapture
}

export const extractPageMarkdownCapture = ({
  sourceDocument,
  sourceUrl,
  fallbackTitle,
  baseCapture
}: ExtractPageMarkdownParams): PageMarkdownCapture => {
  const extractionDocument = buildDocumentForExtraction(sourceDocument)
  const defuddle = new Defuddle(
    extractionDocument,
    buildDefuddleOptions(sourceUrl)
  )
  const result = defuddle.parse()
  const extractedTitle = result.title?.trim() || fallbackTitle
  const htmlFallback = normalizePageMarkdown(result.content ?? "")
  const markdownCandidate = htmlFallback
    ? normalizePageMarkdown(createMarkdownContent(htmlFallback, sourceUrl))
    : ""

  // Defuddle returns a diagnostic wrapper instead of markdown when conversion fails.
  const markdown =
    markdownCandidate &&
    !isDefuddleMarkdownFailure(markdownCandidate) &&
    isUsablePageMarkdown(markdownCandidate, extractedTitle)
      ? markdownCandidate
      : htmlFallback

  if (!isUsablePageMarkdown(markdown, extractedTitle)) {
    throw new Error(
      "No meaningful page content found for page markdown export."
    )
  }

  return buildPageMarkdownCapture(baseCapture, extractedTitle, markdown)
}

export const resolvePageMarkdownCapture = async ({
  sourceDocument,
  sourceUrl,
  fallbackTitle,
  baseCapture,
  preferRemote = false,
  remoteMarkdownLoader = null
}: ResolvePageMarkdownParams): Promise<PageMarkdownCapture> => {
  let localCapture: PageMarkdownCapture | null = null
  let localError: unknown = null

  try {
    localCapture = extractPageMarkdownCapture({
      sourceDocument,
      sourceUrl,
      fallbackTitle,
      baseCapture
    })
  } catch (error) {
    localError = error
  }

  let remoteCapture: PageMarkdownCapture | null = null
  if (preferRemote && remoteMarkdownLoader) {
    try {
      const remoteMarkdown = await remoteMarkdownLoader(sourceUrl)
      if (remoteMarkdown) {
        remoteCapture = buildRemotePageMarkdownCapture({
          sourceUrl,
          fallbackTitle,
          baseCapture,
          remoteMarkdown
        })
      }
    } catch {
      remoteCapture = null
    }
  }

  const preferredCapture = choosePreferredPageMarkdownCapture(
    localCapture,
    remoteCapture
  )

  if (preferredCapture) {
    return preferredCapture
  }

  if (localError instanceof Error) {
    throw localError
  }

  throw new Error("No meaningful page content found for page markdown export.")
}
