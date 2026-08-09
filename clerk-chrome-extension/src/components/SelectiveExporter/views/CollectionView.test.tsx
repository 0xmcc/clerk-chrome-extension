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
  syncedAt: {} as Record<string, number>,
  status: "ready" as const,
  onSelect: vi.fn(),
  onRetry: vi.fn(),
  dateMode: "last_message" as const,
  onDateModeChange: vi.fn()
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
    expect(
      screen.getAllByRole("button", { name: /Conversation/ })
    ).toHaveLength(3)
  })

  it("marks synced and unsynced conversations distinctly", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("synced"), conv("fresh")]}
        syncedIds={["synced"]}
      />
    )

    const syncedRow = screen.getByRole("button", {
      name: /Conversation synced/
    })
    const unsyncedRow = screen.getByRole("button", {
      name: /Conversation fresh/
    })

    expect(within(syncedRow).getByLabelText("Synced")).toBeInTheDocument()
    expect(within(unsyncedRow).getByLabelText("Not synced")).toBeInTheDocument()
  })

  it("states the sync state in words, not just a dot the eye can miss", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("synced"), conv("fresh")]}
        syncedIds={["synced"]}
      />
    )

    const syncedRow = screen.getByRole("button", {
      name: /Conversation synced/
    })
    const unsyncedRow = screen.getByRole("button", {
      name: /Conversation fresh/
    })

    expect(within(syncedRow).getByText("Synced")).toBeVisible()
    expect(within(unsyncedRow).getByText("Not synced")).toBeVisible()
  })

  it("marks an archived conversation as needing sync when it has a newer message", () => {
    const lastSyncedAt = 1_700_000_000
    render(
      <CollectionView
        {...baseProps}
        conversations={[
          conv("changed", {
            updatedAt: lastSyncedAt * 1000,
            messages: [
              {
                id: "new-message",
                role: "user",
                text: "A message sent after the previous sync",
                authorName: "You",
                createdAt: (lastSyncedAt + 10) * 1000,
                node: document.body
              }
            ]
          })
        ]}
        syncedIds={["changed"]}
        syncedAt={{ changed: lastSyncedAt }}
      />
    )

    const row = screen.getByRole("button", {
      name: /Conversation changed/
    })
    expect(within(row).getByLabelText("Needs sync")).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Sync 1 update" })
    ).toBeEnabled()
  })

  it("keeps the conversation synced when its latest activity predates the sync", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[
          conv("current", { updatedAt: 1_700_000_000_000 })
        ]}
        syncedIds={["current"]}
        syncedAt={{ current: 1_700_000_100 }}
      />
    )

    const row = screen.getByRole("button", {
      name: /Conversation current/
    })
    expect(within(row).getByLabelText("Synced")).toBeVisible()
  })

  it("labels the unknown state in words too", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("a")]}
        status="error"
      />
    )

    const row = screen.getByRole("button", { name: /Conversation a/ })
    expect(within(row).getByText("Unknown")).toBeVisible()
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

    fireEvent.click(
      screen.getByRole("button", { name: /Conversation pick-me/ })
    )

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

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Conversation keyed/ }),
      {
        key: "Enter"
      }
    )

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
    fireEvent.click(
      within(filters).getByRole("button", { name: /Not synced/i })
    )

    expect(screen.queryByText("Conversation done")).not.toBeInTheDocument()
    expect(screen.getByText("Conversation todo")).toBeInTheDocument()
  })

  it("offers a prominent bulk action for the conversations that still need syncing", () => {
    const onSyncUnsynced = vi.fn()
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("done"), conv("todo-a"), conv("todo-b")]}
        syncedIds={["done"]}
        onSyncUnsynced={onSyncUnsynced}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Sync 2 unsynced conversations" })
    )

    expect(onSyncUnsynced).toHaveBeenCalledOnce()
  })

  it("offers to re-sync all conversations when every conversation is already synced", () => {
    const onResyncAll = vi.fn()
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("a"), conv("b")]}
        syncedIds={["a", "b"]}
        onResyncAll={onResyncAll}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Re-sync all 2 conversations" })
    )

    expect(onResyncAll).toHaveBeenCalledOnce()
  })

  it("shows bulk-sync progress and offers retry after failures", () => {
    const onRetryFailedSyncs = vi.fn()
    const { rerender } = render(
      <CollectionView
        {...baseProps}
        conversations={[conv("a"), conv("b"), conv("c")]}
        bulkSync={{ state: "syncing", completed: 1, total: 3, failed: 0 }}
      />
    )

    expect(screen.getByText("Syncing 1 of 3 conversations")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /syncing 1 of 3/i })
    ).toBeDisabled()

    rerender(
      <CollectionView
        {...baseProps}
        conversations={[conv("a"), conv("b"), conv("c")]}
        bulkSync={{ state: "error", completed: 2, total: 3, failed: 1 }}
        onRetryFailedSyncs={onRetryFailedSyncs}
      />
    )

    expect(screen.getByText("2 synced · 1 failed")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry failed sync" }))
    expect(onRetryFailedSyncs).toHaveBeenCalledOnce()
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
    expect(
      within(row).getByLabelText("Sync status unknown")
    ).toBeInTheDocument()
    expect(within(row).queryByLabelText("Not synced")).not.toBeInTheDocument()
  })

  it("does not report a reachable older server as unreachable", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[conv("a")]}
        status="unsupported"
      />
    )

    expect(
      screen.getByText("Sync status endpoint unavailable")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Sync server unreachable")
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Sync status unknown")).toBeInTheDocument()
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

  it("shows an empty state that explains itself instead of looking like a blank panel", () => {
    render(<CollectionView {...baseProps} conversations={[]} />)

    expect(
      screen.getByText(/no conversations captured yet/i)
    ).toBeInTheDocument()
    // Must say *why* it is empty and what to do, or it reads as a broken panel.
    expect(
      screen.getByText(/open a conversation|browse|visit/i)
    ).toBeInTheDocument()
  })

  it("still shows the footer count in the empty state so the view never looks dead", () => {
    render(<CollectionView {...baseProps} conversations={[]} />)

    expect(screen.getByRole("contentinfo")).toBeInTheDocument()
  })

  it("shows one selected date and lets the user switch the collection to created date", () => {
    const onDateModeChange = vi.fn()
    const createdAt = Date.parse("2024-01-02T12:00:00.000Z")
    const updatedAt = Date.parse("2024-02-03T12:00:00.000Z")
    const { rerender } = render(
      <CollectionView
        {...baseProps}
        conversations={[conv("dated", { createdAt, updatedAt })]}
        onDateModeChange={onDateModeChange}
      />
    )

    expect(screen.getByText("Last message Feb 3, 2024")).toBeVisible()
    expect(screen.queryByText(/Created Jan 2, 2024/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Created" }))
    expect(onDateModeChange).toHaveBeenCalledWith("created")

    rerender(
      <CollectionView
        {...baseProps}
        conversations={[conv("dated", { createdAt, updatedAt })]}
        dateMode="created"
        onDateModeChange={onDateModeChange}
      />
    )
    expect(screen.getByText("Created Jan 2, 2024")).toBeVisible()
    expect(screen.queryByText(/Last message Feb 3, 2024/)).not.toBeInTheDocument()
  })

  it("uses the final message time for Last message when the transcript is loaded", () => {
    render(
      <CollectionView
        {...baseProps}
        conversations={[
          conv("loaded", {
            updatedAt: Date.parse("2024-03-01T12:00:00.000Z"),
            messages: [
              {
                id: "m1",
                role: "user",
                text: "Question",
                authorName: "You",
                createdAt: Date.parse("2024-02-01T12:00:00.000Z"),
                node: document.body
              },
              {
                id: "m2",
                role: "assistant",
                text: "Answer",
                authorName: "ChatGPT",
                createdAt: Date.parse("2024-02-10T12:00:00.000Z"),
                node: document.body
              }
            ]
          })
        ]}
      />
    )

    expect(screen.getByText("Last message Feb 10, 2024")).toBeVisible()
  })

  it("orders conversations by the selected date", () => {
    render(
      <CollectionView
        {...baseProps}
        dateMode="created"
        conversations={[
          conv("older", { createdAt: 1_000, updatedAt: 9_000 }),
          conv("newest", { createdAt: 9_000, updatedAt: 1_000 }),
          conv("middle", { createdAt: 5_000, updatedAt: 5_000 })
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
