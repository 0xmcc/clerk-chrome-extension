interface FloatingButtonProps {
  onOpenExporter?: () => void
}

export const FloatingButton = ({ onOpenExporter }: FloatingButtonProps) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    onOpenExporter?.()

    console.log("[FloatingButton] Clicked - opening exporter")
  }

  const handleRightClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    chrome.runtime.sendMessage({ action: "openOptionsPage" })
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
      <button
        type="button"
        aria-label="Capture this page for AI"
        onClick={handleClick}
        onContextMenu={handleRightClick}
        title="Capture this page for AI"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "50px",
          height: "50px",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          color: "white",
          cursor: "pointer",
          zIndex: 2147483646,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
          transition: "all 0.3s ease",
          opacity: 0.7,
          userSelect: "none",
          border: "2px solid rgba(255, 255, 255, 0.2)",
          animation: "none",
          padding: 0
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
      </button>
    </>
  )
}
