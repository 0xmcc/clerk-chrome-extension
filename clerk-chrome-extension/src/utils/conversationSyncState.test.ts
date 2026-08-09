import { describe, expect, it } from "vitest"

import type { Conversation } from "~hooks/useMessageScanner/types"

import {
  conversationsNeedingSync,
  getConversationSyncState
} from "./conversationSyncState"

const conversation = (
  id: string,
  updatedAt: number | undefined
): Conversation => ({
  id,
  platform: "chatgpt",
  updatedAt,
  messages: [],
  hasFullHistory: false,
  lastSeenAt: Date.now()
})

describe("conversation sync freshness", () => {
  it("distinguishes current, stale, and never-synced conversations", () => {
    expect(
      getConversationSyncState(conversation("current", 1_000_000), true, 2_000)
    ).toBe("synced")
    expect(
      getConversationSyncState(conversation("stale", 3_000_000), true, 2_000)
    ).toBe("stale")
    expect(
      getConversationSyncState(conversation("new", 3_000_000), false, undefined)
    ).toBe("unsynced")
  })

  it("returns both stale and never-synced conversations for the bulk action", () => {
    const current = conversation("current", 1_000_000)
    const stale = conversation("stale", 3_000_000)
    const unsynced = conversation("new", 3_000_000)

    expect(
      conversationsNeedingSync(
        [current, stale, unsynced],
        ["current", "stale"],
        { current: 2_000, stale: 2_000 }
      ).map(({ id }) => id)
    ).toEqual(["stale", "new"])
  })
})
