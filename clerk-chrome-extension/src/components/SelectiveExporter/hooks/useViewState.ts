import { useState, useCallback } from "react"

import type { ViewMode } from "../types"

interface ViewStateReturn {
  /** Current view: "export" | "settings" | "analysis" */
  view: ViewMode
  /** Navigate to export view */
  goToExport: () => void
  /** Navigate to settings view */
  goToSettings: () => void
  /** Navigate to analysis view */
  goToAnalysis: () => void
  /** Set view directly */
  setView: (view: ViewMode) => void
}

/**
 * Hook for managing view state with a single source of truth.
 * Single enum state - no boolean drift possible.
 */
export const useViewState = (): ViewStateReturn => {
  const [view, setView] = useState<ViewMode>("export")

  const goToExport = useCallback(() => {
    setView("export")
  }, [])

  const goToSettings = useCallback(() => {
    setView("settings")
  }, [])

  const goToAnalysis = useCallback(() => {
    setView("analysis")
  }, [])

  return {
    view,
    goToExport,
    goToSettings,
    goToAnalysis,
    setView
  }
}
