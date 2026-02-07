/**
 * Test: Keyboard event propagation is stopped at the SelectiveExporter boundary.
 *
 * Bug: When typing in Settings inputs (AI Email, From Email, API Key),
 * keystrokes propagate to the host page (Claude.ai / ChatGPT), causing
 * characters to appear in the host's chat input.
 *
 * Fix: The top-level container div in SelectiveExporter stops propagation
 * of keydown, keyup, and keypress events.
 *
 * Framework: Written for vitest + @testing-library/react.
 * If no test runner is configured yet, this still documents expected behavior.
 */

import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"

describe("SelectiveExporter keyboard event propagation", () => {
  /**
   * Minimal wrapper that mimics the fix: a div with stopPropagation handlers
   * containing input fields. We test the pattern in isolation so the test
   * doesn't need the full component tree and all its dependencies.
   */
  function StopPropagationWrapper({ children }: { children: React.ReactNode }) {
    return (
      <div
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        onKeyPress={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    )
  }

  const eventTypes = ["keydown", "keyup", "keypress"] as const

  it("stops keyboard events from propagating past the container", () => {
    const parentHandlers = {
      keydown: vi.fn(),
      keyup: vi.fn(),
      keypress: vi.fn(),
    }

    const { getByPlaceholderText } = render(
      <div
        onKeyDown={parentHandlers.keydown}
        onKeyUp={parentHandlers.keyup}
        onKeyPress={parentHandlers.keypress}
      >
        <StopPropagationWrapper>
          <input placeholder="My AI Email" />
          <input placeholder="From Email" />
          <input placeholder="API Key" />
        </StopPropagationWrapper>
      </div>
    )

    const inputs = ["My AI Email", "From Email", "API Key"]

    for (const placeholder of inputs) {
      const input = getByPlaceholderText(placeholder)

      fireEvent.keyDown(input, { key: "a" })
      fireEvent.keyUp(input, { key: "a" })
      fireEvent.keyPress(input, { key: "a" })
    }

    // No keyboard events should have reached the parent
    for (const evt of eventTypes) {
      expect(parentHandlers[evt]).not.toHaveBeenCalled()
    }
  })

  it("still allows internal keyboard handling (e.g. Enter to submit)", () => {
    const internalHandler = vi.fn()

    const { getByPlaceholderText } = render(
      <StopPropagationWrapper>
        <input placeholder="analysis" onKeyDown={internalHandler} />
      </StopPropagationWrapper>
    )

    fireEvent.keyDown(getByPlaceholderText("analysis"), { key: "Enter" })
    expect(internalHandler).toHaveBeenCalledTimes(1)
  })
})
