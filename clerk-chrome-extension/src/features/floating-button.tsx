import { useEffect, useState } from "react"

interface FloatingButtonProps {
  onOpenExporter?: () => void
}

export const FloatingButton = ({ onOpenExporter }: FloatingButtonProps) => {
  const [isEnabled, setIsEnabled] = useState(true)
  const [isActive, setIsActive] = useState(false)

  // Load enabled state from storage
  useEffect(() => {
    chrome.storage.sync.get(["floatingButtonEnabled"], (result) => {
      setIsEnabled(result.floatingButtonEnabled !== false)
    })

    // Listen for storage changes
    const handleStorageChange = (changes: any, namespace: string) => {
      if (namespace === "sync" && changes.floatingButtonEnabled) {
        setIsEnabled(changes.floatingButtonEnabled.newValue !== false)
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Open selective exporter
    if (onOpenExporter) {
      onOpenExporter()
    }

    console.log("[FloatingButton] Clicked - opening exporter")
  }

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Open extension options page
    chrome.runtime.sendMessage({ action: "openOptionsPage" })
  }

  if (!isEnabled) {
    return null
  }

  return (
    <>
      <style>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          }
          50% {
            box-shadow: 0 4px 20px rgba(255, 107, 107, 0.4);
          }
          100% {
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          }
        }
      `}</style>
      <div
        onClick={handleClick}
        onContextMenu={handleRightClick}
        title="Text Tools - Click for options"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "50px",
          height: "50px",
          background: isActive
            ? "linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)"
            : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          color: "white",
          cursor: "pointer",
          zIndex: 10000,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
          transition: "all 0.3s ease",
          opacity: 0.7,
          userSelect: "none",
          border: "2px solid rgba(255, 255, 255, 0.2)",
          animation: isActive ? "pulse 1.5s infinite" : "none"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1"
          e.currentTarget.style.transform = "scale(1.1)"
          e.currentTarget.style.boxShadow = "0 6px 25px rgba(0, 0, 0, 0.25)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.7"
          e.currentTarget.style.transform = "scale(1)"
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.15)"
        }}>
        ✨
      </div>
    </>
  )
}
