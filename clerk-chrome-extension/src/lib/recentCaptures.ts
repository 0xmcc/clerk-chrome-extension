import type { RecentCaptureRecord } from "~popupBridge"
import { POPUP_RECENT_CAPTURES_KEY } from "~popupBridge"

const MAX_RECENT_CAPTURES = 6

const readStorage = async (): Promise<RecentCaptureRecord[]> =>
  new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve([])
      return
    }

    chrome.storage.local.get([POPUP_RECENT_CAPTURES_KEY], (result) => {
      const value = result?.[POPUP_RECENT_CAPTURES_KEY]
      resolve(Array.isArray(value) ? (value as RecentCaptureRecord[]) : [])
    })
  })

const writeStorage = async (captures: RecentCaptureRecord[]): Promise<void> =>
  new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve()
      return
    }

    chrome.storage.local.set({ [POPUP_RECENT_CAPTURES_KEY]: captures }, () => {
      resolve()
    })
  })

export const loadRecentCaptures = async (): Promise<RecentCaptureRecord[]> => {
  const captures = await readStorage()
  return captures
    .filter((capture) => capture && typeof capture.savedAt === "string")
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
    .slice(0, MAX_RECENT_CAPTURES)
}

export const saveRecentCapture = async (
  record: RecentCaptureRecord
): Promise<RecentCaptureRecord[]> => {
  const existing = await readStorage()
  const next = [
    record,
    ...existing.filter(
      (capture) =>
        capture.sourceUrl !== record.sourceUrl || capture.captureMode !== record.captureMode
    )
  ]
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
    .slice(0, MAX_RECENT_CAPTURES)

  await writeStorage(next)
  return next
}
