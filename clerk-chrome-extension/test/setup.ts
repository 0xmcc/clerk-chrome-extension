import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

import "@testing-library/jest-dom/vitest"

const createChromeMock = () => ({
  runtime: {
    sendMessage: vi.fn(),
    getManifest: vi.fn(() => ({
      name: "MomentumAI Test",
      version: "1.0.0"
    }))
  },
  storage: {
    local: {
      get: vi.fn(
        (
          _keys: unknown,
          callback?: (result: Record<string, unknown>) => void
        ) => {
          callback?.({})
        }
      ),
      set: vi.fn()
    }
  }
})

beforeEach(() => {
  vi.stubGlobal("chrome", createChromeMock())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
