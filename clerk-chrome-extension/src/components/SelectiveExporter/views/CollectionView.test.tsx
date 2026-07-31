import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { Conversation } from "~hooks/useMessageScanner/types"

import { CollectionView } from "./CollectionView"

const conv = (
  id: string,
  overrides: Partial<Conversation> = {}
): Conversation => ({
  id,
  platform: "chatgpt",
  title: `Conversation ${id}`,
  messages: [],
  hasFullHistory: false,
  lastSeenAt: Date.now(),
  ...overrides
})

const baseProps = {
  conversations: [] as Conversation[],
  syncedIds: [] as string[],
  status: "ready" as const,
  onSelect: vi.fn(),
  onRetry: vi.fn()
}

describe("CollectionView", () => {
  it("renders every conversation — the list is the hero", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("a"), conv("b"), conv("c")]}
      />
    )

    expect(screen.getByText("Conversation a")).toBeInTheDocument()
    expect(screen.getByText("Conversation b")).toBeInTheDocument()
    expect(screen.getByText("Conversation c")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Conversation/ })).toHaveLength(3)
  })

  it("marks synced and unsynced conversations distinctly", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("synced"), conv("fresh")]}
        syncedIds={["synced"]}
      />
    )

    const syncedRow = screen.getByRole("button", { name: /Conversation synced/ })
    const unsyncedRow = screen.getByRole("button", { name: /Conversation fresh/ })

    expect(within(syncedRow).getByLabelText("Synced")).toBeInTheDocument()
    expect(within(unsyncedRow).getByLabelText("Not synced")).toBeInTheDocument()
  })

  it("selects a conversation on click, returning to the detail view", () => {
    const onSelect = vi.fn()
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("pick-me")]}
        onSelect={onSelect}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Conversation pick-me/ }))

    expect(onSelect).toHaveBeenCalledWith("chatgpt:pick-me")
  })

  it("selects a conversation from the keyboard", () => {
    const onSelect = vi.fn()
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("keyed")]}
        onSelect={onSelect}
      />
    )

    fireEvent.keyDown(screen.getByRole("button", { name: /Conversation keyed/ }), {
      key: "Enter"
    })

    expect(onSelect).toHaveBeenCalledWith("chatgpt:keyed")
  })

  it("filters to only unsynced conversations so the core question is one click away", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("done"), conv("todo")]}
        syncedIds={["done"]}
      />
    )

    const filters = screen.getByRole("group", { name: /filter conversations/i })
    fireEvent.click(within(filters).getByRole("button", { name: /Not synced/i }))

    expect(screen.queryByText("Conversation done")).not.toBeInTheDocument()
    expect(screen.getByText("Conversation todo")).toBeInTheDocument()
  })

  it("keeps counts in a subtle footer, not as the headline", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("a"), conv("b")]}
        syncedIds={["a"]}
      />
    )

    const footer = screen.getByRole("contentinfo")
    expect(within(footer).getByText(/1 of 2 synced/i)).toBeInTheDocument()
  })

  it("highlights the conversation currently open in the detail view", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("active"), conv("other")]}
        activeConvoKey="chatgpt:active"
      />
    )

    expect(
      screen.getByRole("button", { name: /Conversation active/ })
    ).toHaveAttribute("aria-current", "true")
    expect(
      screen.getByRole("button", { name: /Conversation other/ })
    ).not.toHaveAttribute("aria-current", "true")
  })

  it("shows unknown — not 'unsynced' — when the sync server is unreachable", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("a")]}
        status="error"
      />
    )

    const row = screen.getByRole("button", { name: /Conversation a/ })
    expect(within(row).getByLabelText("Sync status unknown")).toBeInTheDocument()
    expect(within(row).queryByLabelText("Not synced")).not.toBeInTheDocument()
  })

  it("offers a retry when the sync server is unreachable", () => {
    const onRetry = vi.fn()
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("a")]}
        status="error"
        onRetry={onRetry}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it("shows an empty state when nothing has been captured", () => {
    render(<CollectionView {...baseProps} conversations={[]} />)

    expect(screen.getByText(/no conversations captured yet/i)).toBeInTheDocument()
  })

  it("orders conversations most recently seen first", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[
          conv("older", { lastSeenAt: 1_000 }),
          conv("newest", { lastSeenAt: 9_000 }),
          conv("middle", { lastSeenAt: 5_000 })
        ]}
      />
    )

    const titles = screen
      .getAllByRole("button", { name: /Conversation/ })
      .map((el) => el.textContent)

    expect(titles[0]).toContain("newest")
    expect(titles[1]).toContain("middle")
    expect(titles[2]).toContain("older")
  })
})
