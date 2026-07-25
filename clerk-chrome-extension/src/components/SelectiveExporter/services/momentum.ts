import {
  buildCaptureExportPayload,
  type SerializableExportCapture
} from "~lib/exportCapture"
import type { MomentumSyncResult } from "~utils/momentumSync"

export interface SyncCaptureToMomentumConfig {
  url: string
  token: string
}

/**
 * Push a captured conversation to the local momentum sync API via the background
 * worker (which owns the extension origin the server requires). The built export
 * payload is enriched with `capturedAt` so momentum can sort the synced
 * conversation as recent.
 */
export const syncCaptureToMomentum = async (
  capture: SerializableExportCapture,
  { url, token }: SyncCaptureToMomentumConfig
): Promise<MomentumSyncResult> => {
  const payload = buildCaptureExportPayload(capture, "extension")
  const enrichedPayload = {
    ...payload,
    metadata: {
      ...payload.metadata,
      capturedAt: capture.metadata.capturedAt
    }
  }

  return (await chrome.runtime.sendMessage({
    action: "momentumSync",
    url,
    token,
    payload: enrichedPayload
  })) as MomentumSyncResult
}
