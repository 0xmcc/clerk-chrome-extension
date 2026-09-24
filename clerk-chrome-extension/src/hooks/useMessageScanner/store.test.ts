import { beforeEach, describe, expect, it } from "vitest"

import { getNewestUpdatedAt, sharedStore } from "./store"
import type { Conversation } from "./types"

const convo = (
  id: string,
  platform: Conversation["platform"],
  updatedAt: number | undefined
): Conversation => ({
  id,
  platform,
  title: id,
  createdAt: updatedAt,
  updatedAt,
  messages: [],
  hasFullHistory: false,
  lastSeenAt: 0
})

const put = (c: Conversation) => sharedStore.set(`${c.platform}:${c.id}`, c)

// Ingestion asks the store how fresh its knowledge is so it can stop paging
// once it reaches conversations it already has. A wrong answer here is the
// difference between one request per page load and hundreds.
describe("getNewestUpdatedAt", () => {
  beforeEach(() => {
    sharedStore.clear()
  })

  it("returns null when nothing is stored — the first ever load", () => {
    expect(getNewestUpdatedAt("chatgpt")).toBeNull()
  })

  it("returns the newest updatedAt, not the last one inserted", () => {
    put(convo("a", "chatgpt", 300))
    put(convo("b", "chatgpt", 900))
    put(convo("c", "chatgpt", 100))

    expect(getNewestUpdatedAt("chatgpt")).toBe(900)
  })

  it("ignores conversations from another platform", () => {
    // Claude conversations share the store; letting one set the ChatGPT
    // cutoff would stop ChatGPT ingestion short of conversations it never saw.
    put(convo("a", "chatgpt", 300))
    put(convo("b", "claude", 5000))

    expect(getNewestUpdatedAt("chatgpt")).toBe(300)
  })

  it("returns null when the platform has nothing stored yet", () => {
    put(convo("b", "claude", 5000))

    expect(getNewestUpdatedAt("chatgpt")).toBeNull()
  })

  it("skips entries with no usable updatedAt", () => {
    put(convo("a", "chatgpt", undefined))
    put(convo("b", "chatgpt", 400))

    expect(getNewestUpdatedAt("chatgpt")).toBe(400)
  })

  it("returns null when every stored entry lacks updatedAt", () => {
    put(convo("a", "chatgpt", undefined))

    expect(getNewestUpdatedAt("chatgpt")).toBeNull()
  })
})
