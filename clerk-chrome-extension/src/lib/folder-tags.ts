/**
 * Recording which bookmarks folder a save came from.
 *
 * Bookmark folders are invisible to the X API — it returns one flat list with
 * no way to filter by folder — so the folder a tweet was saved from only
 * exists at save time, in the URL. If we do not write it down here, nothing
 * downstream can ever recover it.
 *
 * The reels publisher selects rows by exactly these tags.
 */

/** Tabs that live at the folder position in the path but are not folders. */
const NOT_FOLDERS = new Set(["all"])

const FOLDER_PATH = /^\/i\/(?:bookmarks|history)\/([^/]+)\/?$/

/** Lowercase, punctuation to dashes, no leading/trailing or doubled dashes. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Tags for a save made at `pathname`. Empty unless we are inside a folder.
 *
 * @param folderName optional human-readable name, added as a readable slug
 *                   alongside the stable id.
 */
export function folderTagsFrom(pathname: string, folderName?: string): string[] {
  const match = FOLDER_PATH.exec(pathname)
  if (!match) return []

  const folderId = match[1]
  if (NOT_FOLDERS.has(folderId.toLowerCase())) return []

  const tags = [`folder:${folderId}`]

  if (folderName) {
    const slug = slugify(folderName)
    if (slug) tags.push(slug)
  }

  return tags
}

/**
 * Union of the tags a row already has with the ones this save adds.
 *
 * The tweets upsert matches on tweet_id, so writing `tags` straight through
 * would erase whatever a previous folder put there — and a tweet can sit in
 * more than one folder.
 */
export function mergeTags(
  existing: string[] | null | undefined,
  incoming: string[]
): string[] {
  const out: string[] = []
  for (const tag of [...(existing ?? []), ...incoming]) {
    const trimmed = (tag ?? "").trim()
    if (trimmed && !out.includes(trimmed)) out.push(trimmed)
  }
  return out
}
