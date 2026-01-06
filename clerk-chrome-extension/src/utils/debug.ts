/**
 * Lightweight debug logging utility with multi-tag support.
 * Toggle via PLASMO_PUBLIC_DEBUG env var (comma-separated tags).
 *
 * Usage:
 *   debug.any(["auth", "clerk"], "message", data)  // logs if ANY tag enabled
 *   debug.all(["auth", "token"], "message", data)  // logs if ALL tags enabled
 */

const PLASMO_DEBUG = process.env.PLASMO_PUBLIC_DEBUG || ""
const enabledTags = new Set(
  PLASMO_DEBUG.split(",")
    .map((t) => t.trim())
    .filter(Boolean)
)
const isDebugEnabled = enabledTags.size > 0

function formatPrefix(tags: string[]): string {
  return `[${tags.join(",")}]`
}

export const debug = {
  /** Log if ANY of the provided tags is enabled */
  any(tags: string[], ...args: unknown[]): void {
    if (!isDebugEnabled) return
    if (!tags.some((t) => enabledTags.has(t))) return
    console.log(formatPrefix(tags), ...args)
  },

  /** Log if ALL of the provided tags are enabled */
  all(tags: string[], ...args: unknown[]): void {
    if (!isDebugEnabled) return
    if (!tags.every((t) => enabledTags.has(t))) return
    console.log(formatPrefix(tags), ...args)
  },

  /** Check if a specific tag is enabled */
  isEnabled(tag: string): boolean {
    return enabledTags.has(tag)
  },

  /** Always logs errors (not gated by debug flags) */
  error(...args: unknown[]): void {
    console.error(...args)
  }
}
