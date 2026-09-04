export interface MessageImage {
  name?: string
  url: string
}

const IMAGE_URL_KEYS = [
  "asset_pointer",
  "content_url",
  "download_url",
  "image_url",
  "source",
  "url"
] as const

const IMAGE_CHILD_KEYS = [
  "attachments",
  "blocks",
  "content",
  "files",
  "image",
  "images",
  "parts",
  "source"
] as const

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

export const isDurableImageUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value)

const getImageUrl = (value: unknown): string | null => {
  if (isDurableImageUrl(value)) return value

  const record = toRecord(value)
  if (!record) return null

  for (const key of IMAGE_URL_KEYS) {
    const candidate = record[key]
    if (isDurableImageUrl(candidate)) return candidate
  }

  return null
}

const isImageLike = (record: Record<string, unknown>): boolean => {
  const typeValues = [
    record.type,
    record.content_type,
    record.mime_type,
    record.media_type
  ]

  return typeValues.some(
    (value) => typeof value === "string" && value.toLowerCase().includes("image")
  )
}

const getImageName = (record: Record<string, unknown>): string | undefined => {
  const value = record.name ?? record.filename ?? record.title
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

/**
 * Extracts externally fetchable image URLs from the structured message blocks
 * returned by ChatGPT and Claude. Blob, data, and internal asset pointers are
 * deliberately excluded: they cannot resolve after the source tab closes.
 */
export const collectMessageImages = (value: unknown): MessageImage[] => {
  const images: MessageImage[] = []
  const seenUrls = new Set<string>()

  const add = (record: Record<string, unknown>) => {
    if (!isImageLike(record)) return

    const url = IMAGE_URL_KEYS.map((key) => getImageUrl(record[key])).find(
      (candidate): candidate is string => Boolean(candidate)
    )
    if (!url || seenUrls.has(url)) return

    seenUrls.add(url)
    images.push({ url, name: getImageName(record) })
  }

  const visit = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit)
      return
    }

    const record = toRecord(candidate)
    if (!record) return

    add(record)
    for (const key of IMAGE_CHILD_KEYS) {
      if (key in record) visit(record[key])
    }
  }

  visit(value)
  return images
}

export const appendImageMarkdown = (
  text: string,
  images: readonly MessageImage[] | undefined
): string => {
  if (!images?.length) return text

  const references = images.map(
    (image, index) => `![${image.name || `Image ${index + 1}`}](${image.url})`
  )

  return [text, ...references].filter(Boolean).join("\n\n")
}
