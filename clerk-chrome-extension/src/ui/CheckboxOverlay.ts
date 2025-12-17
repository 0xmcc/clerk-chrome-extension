type ToggleHandler = (id: string) => void

const CHECKBOX_CONTAINER_CLASS = "exporter-checkbox-container"
const CHECKBOX_CLASS = "exporter-checkbox"

class CheckboxOverlay {
  private nodeToContainer = new Map<Element, HTMLDivElement>()
  private idToCheckbox = new Map<string, HTMLInputElement>()

  injectCheckbox(node: Element, id: string, isSelected: boolean, onToggle: ToggleHandler): void {
    if (this.nodeToContainer.has(node)) return

    const existingContainer = node.querySelector(`.${CHECKBOX_CONTAINER_CLASS}`) as HTMLDivElement | null
    if (existingContainer) {
      const checkbox = existingContainer.querySelector(`.${CHECKBOX_CLASS}`) as HTMLInputElement | null
      if (checkbox) {
        checkbox.dataset.messageId = id
        checkbox.checked = isSelected
        this.nodeToContainer.set(node, existingContainer)
        this.idToCheckbox.set(id, checkbox)
      }
      return
    }

    const container = document.createElement("div")
    container.className = CHECKBOX_CONTAINER_CLASS
    container.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 100;
      background: rgba(255, 255, 255, 0.9);
      padding: 4px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      user-select: none;
    `

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.className = CHECKBOX_CLASS
    checkbox.dataset.messageId = id
    checkbox.checked = isSelected
    checkbox.style.cssText = `
      width: 16px;
      height: 16px;
      cursor: pointer;
      margin: 0;
    `

    checkbox.addEventListener("click", (e) => {
      e.stopPropagation()
      console.log("[Checkbox] Clicked:", id, "Current checked:", checkbox.checked)
      onToggle(id)
    })

    container.appendChild(checkbox)

    const computedStyle = window.getComputedStyle(node as HTMLElement)
    if (computedStyle.position === "static") {
      ;(node as HTMLElement).style.position = "relative"
    }

    node.prepend(container)

    this.nodeToContainer.set(node, container)
    this.idToCheckbox.set(id, checkbox)
  }

  updateCheckboxState(id: string, isSelected: boolean): boolean {
    const existing = this.idToCheckbox.get(id)
    if (existing && document.contains(existing)) {
      if (existing.checked === isSelected) return false
      existing.checked = isSelected
      return true
    }

    if (existing && !document.contains(existing)) {
      this.idToCheckbox.delete(id)
    }

    const checkbox = document.querySelector(
      `.${CHECKBOX_CLASS}[data-message-id="${id}"]`
    ) as HTMLInputElement | null
    if (!checkbox) return false

    if (checkbox.checked === isSelected) {
      this.idToCheckbox.set(id, checkbox)
      return false
    }

    checkbox.checked = isSelected
    this.idToCheckbox.set(id, checkbox)
    return true
  }

  removeAllCheckboxes(): void {
    document.querySelectorAll(`.${CHECKBOX_CONTAINER_CLASS}`).forEach((el) => el.remove())
    this.nodeToContainer.clear()
    this.idToCheckbox.clear()
  }
}

export const checkboxOverlay = new CheckboxOverlay()
