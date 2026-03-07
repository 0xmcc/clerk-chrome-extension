import { DARK_THEME } from "../../constants"

type ExportBehaviorSectionProps = {
  includeHidden: boolean
  onIncludeHiddenChange: (value: boolean) => void
}

export const ExportBehaviorSection = ({
  includeHidden,
  onIncludeHiddenChange
}: ExportBehaviorSectionProps) => (
  <div>
    <label
      style={{
        display: "block",
        fontSize: "13px",
        fontWeight: 600,
        color: DARK_THEME.text,
        marginBottom: "12px"
      }}>
      Export Behavior
    </label>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <input
        type="checkbox"
        id="settingsIncludeHiddenToggle"
        checked={includeHidden}
        onChange={(e) => onIncludeHiddenChange(e.target.checked)}
        style={{ cursor: "pointer", accentColor: DARK_THEME.accent }}
      />
      <label
        htmlFor="settingsIncludeHiddenToggle"
        style={{
          fontSize: "13px",
          color: DARK_THEME.text,
          cursor: "pointer",
          userSelect: "none"
        }}>
        Include hidden system prompts and tool usage
      </label>
    </div>
    <div
      style={{ fontSize: "11px", color: DARK_THEME.muted, marginTop: "6px" }}>
      When active, exports include background AI mechanics.
    </div>
  </div>
)
