import { describe, expect, it } from "vitest"

import type { Message } from "~hooks/useMessageScanner/types"

import {
  applyMessageSelectionForExport,
  createInitialMessageSelectionState,
  getMessageSelectionEntries,
  setMessageSelectionFilter,
  toggleMessageSelection
} from "./messageSelection"

const makeMessage = (
  index: number,
  role: Message["role"],
  text: string
): Message => ({
  id: `conv_test::m_${String(index).padStart(4, "0")}`,
  role,
  text,
  authorName: role === "user" ? "You" : role === "assistant" ? "ChatGPT" : role,
  node: document.createElement("div")
})

const messages = [
  makeMessage(0, "user", "First user question"),
  makeMessage(1, "assistant", "First assistant answer"),
  makeMessage(2, "user", "Second user question"),
  makeMessage(3, "assistant", "Second assistant answer")
]

describe("message selection helper", () => {
  it("defaults messages to included and excludes toggled messages while preserving order", () => {
    const state = toggleMessageSelection(
      createInitialMessageSelectionState(),
      "conv_test::m_0001"
    )

    expect(
      applyMessageSelectionForExport(messages, state).map((m) => m.text)
    ).toEqual([
        "First user question",
        "Second user question",
        "Second assistant answer"
      ])
  })

  it("filters selection entries by human and AI roles", () => {
    const humanState = setMessageSelectionFilter(
      createInitialMessageSelectionState(),
      "human"
    )
    const aiState = setMessageSelectionFilter(
      createInitialMessageSelectionState(),
      "ai"
    )

    expect(
      getMessageSelectionEntries(messages, humanState).map(
        (entry) => entry.message.text
      )
    ).toEqual(["First user question", "Second user question"])
    expect(
      getMessageSelectionEntries(messages, aiState).map(
        (entry) => entry.message.text
      )
    ).toEqual(["First assistant answer", "Second assistant answer"])
  })

  it("changes filters without mutating selected and excluded state", () => {
    const state = toggleMessageSelection(
      createInitialMessageSelectionState(),
      "conv_test::m_0001"
    )

    const selectedState = setMessageSelectionFilter(state, "selected")
    const excludedState = setMessageSelectionFilter(state, "excluded")

    expect(
      getMessageSelectionEntries(messages, selectedState).map(
        (entry) => entry.message.text
      )
    ).toEqual([
        "First user question",
        "Second user question",
        "Second assistant answer"
      ])
    expect(
      getMessageSelectionEntries(messages, excludedState).map(
        (entry) => entry.message.text
      )
    ).toEqual(["First assistant answer"])
  })
})
