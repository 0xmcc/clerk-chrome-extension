import type { Message } from "~hooks/useMessageScanner/types"

export type MessageSelectionFilter =
  | "all"
  | "human"
  | "ai"
  | "selected"
  | "excluded"

export interface MessageSelectionState {
  selectedById: Record<string, boolean>
  filter: MessageSelectionFilter
}

export interface MessageSelectionEntry {
  message: Message
  index: number
  selected: boolean
}

export const createInitialMessageSelectionState = (): MessageSelectionState => ({
  selectedById: {},
  filter: "all"
})

export const isSelectableMessage = (message: Message): boolean =>
  message.role === "user" || message.role === "assistant"

export const isMessageSelected = (
  state: MessageSelectionState,
  messageId: string
): boolean => state.selectedById[messageId] ?? true

export const toggleMessageSelection = (
  state: MessageSelectionState,
  messageId: string
): MessageSelectionState => ({
  ...state,
  selectedById: {
    ...state.selectedById,
    [messageId]: !isMessageSelected(state, messageId)
  }
})

export const setMessageSelectionFilter = (
  state: MessageSelectionState,
  filter: MessageSelectionFilter
): MessageSelectionState => ({
  ...state,
  filter
})

export const applyMessageSelectionForExport = (
  messages: Message[],
  state: MessageSelectionState
): Message[] =>
  messages.filter(
    (message) =>
      !isSelectableMessage(message) || isMessageSelected(state, message.id)
  )

export const getMessageSelectionEntries = (
  messages: Message[],
  state: MessageSelectionState
): MessageSelectionEntry[] =>
  messages
    .map((message, index) => ({
      message,
      index,
      selected: isMessageSelected(state, message.id)
    }))
    .filter((entry) => isSelectableMessage(entry.message))
    .filter((entry) => {
      switch (state.filter) {
        case "human":
          return entry.message.role === "user"
        case "ai":
          return entry.message.role === "assistant"
        case "selected":
          return entry.selected
        case "excluded":
          return !entry.selected
        case "all":
        default:
          return true
      }
    })

export const countSelectableMessages = (messages: Message[]): number =>
  messages.filter(isSelectableMessage).length

export const countSelectedSelectableMessages = (
  messages: Message[],
  state: MessageSelectionState
): number =>
  messages.filter(
    (message) =>
      isSelectableMessage(message) && isMessageSelected(state, message.id)
  ).length
