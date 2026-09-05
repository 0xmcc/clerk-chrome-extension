import { useEffect, useMemo, useState } from "react"

import type { LinkedInContact } from "~lib/linkedin-contacts"

import { DARK_THEME } from "../constants"

interface LinkedInContactsViewProps {
  contacts: LinkedInContact[]
  onDownload: (contacts: LinkedInContact[]) => void
  onCopy?: (contacts: LinkedInContact[]) => void
}

type ContactViewMode = "contacts" | "json"

const contactKey = (contact: LinkedInContact): string =>
  contact.profileUrl ?? contact.name

const canonicalProfileUrl = (href: string): string | null => {
  try {
    const url = new URL(href, window.location.origin)
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return null
  }
}

export const LinkedInContactsView = ({
  contacts,
  onDownload,
  onCopy
}: LinkedInContactsViewProps) => {
  const [viewMode, setViewMode] = useState<ContactViewMode>("contacts")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(contacts.map(contactKey))
  )
  const contactsSignature = contacts.map(contactKey).join("\u0000")

  useEffect(() => {
    setSelectedKeys(new Set(contacts.map(contactKey)))
  }, [contactsSignature])

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedKeys.has(contactKey(contact))),
    [contacts, selectedKeys]
  )

  const toggleContact = (contact: LinkedInContact) => {
    const key = contactKey(contact)
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    const contactsByUrl = new Map(
      contacts.flatMap((contact) => {
        if (!contact.profileUrl) return []
        const profileUrl = canonicalProfileUrl(contact.profileUrl)
        return profileUrl ? [[profileUrl, contact] as const] : []
      })
    )
    const cleanups: Array<() => void> = []

    for (const card of Array.from(
      document.querySelectorAll<HTMLAnchorElement>('main a[href*="/in/"]')
    )) {
      if (!card.querySelector("img") || card.querySelectorAll("p").length < 3) {
        continue
      }

      const profileUrl = canonicalProfileUrl(card.href)
      const contact = profileUrl ? contactsByUrl.get(profileUrl) : undefined
      if (!contact) continue

      const previousPosition = card.style.position
      if (window.getComputedStyle(card).position === "static") {
        card.style.position = "relative"
      }

      const checkbox = document.createElement("input")
      checkbox.type = "checkbox"
      checkbox.checked = selectedKeys.has(contactKey(contact))
      checkbox.setAttribute(
        "aria-label",
        `Include ${contact.name} on LinkedIn page`
      )
      checkbox.dataset.linkedinExportToggle = "true"
      Object.assign(checkbox.style, {
        position: "absolute",
        top: "8px",
        right: "8px",
        width: "18px",
        height: "18px",
        margin: "0",
        zIndex: "10",
        accentColor: DARK_THEME.accent,
        cursor: "pointer"
      })

      const handleClick = (event: MouseEvent) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        toggleContact(contact)
      }

      checkbox.addEventListener("click", handleClick, true)
      card.appendChild(checkbox)
      cleanups.push(() => {
        checkbox.removeEventListener("click", handleClick, true)
        checkbox.remove()
        card.style.position = previousPosition
      })
    }

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [contactsSignature, selectedKeys])

  const copySelectedContacts = () => {
    if (onCopy) {
      onCopy(selectedContacts)
      return
    }

    void navigator.clipboard.writeText(
      JSON.stringify(selectedContacts, null, 2)
    )
  }

  const modeButtonStyle = (mode: ContactViewMode) => ({
    border: 0,
    borderRadius: "7px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 600,
    background: viewMode === mode ? DARK_THEME.surface : "transparent",
    color: viewMode === mode ? DARK_THEME.text : DARK_THEME.muted,
    cursor: "pointer"
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap"
        }}>
        <div
          style={{
            display: "flex",
            border: `1px solid ${DARK_THEME.border}`,
            borderRadius: "9px",
            padding: "2px",
            background: DARK_THEME.panel
          }}>
          <button
            type="button"
            aria-pressed={viewMode === "contacts"}
            onClick={() => setViewMode("contacts")}
            style={modeButtonStyle("contacts")}>
            Contacts
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "json"}
            onClick={() => setViewMode("json")}
            style={modeButtonStyle("json")}>
            JSON
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={copySelectedContacts}
            disabled={selectedContacts.length === 0}
            title="Copy to clipboard"
            style={{
              border: `1px solid ${DARK_THEME.border}`,
              borderRadius: "10px",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 600,
              background:
                selectedContacts.length === 0
                  ? DARK_THEME.surface
                  : DARK_THEME.panel,
              color:
                selectedContacts.length === 0
                  ? DARK_THEME.muted
                  : DARK_THEME.text,
              cursor: selectedContacts.length === 0 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy
          </button>
          <button
            type="button"
            onClick={() => onDownload(selectedContacts)}
            disabled={selectedContacts.length === 0}
            style={{
              border: `1px solid ${DARK_THEME.border}`,
              borderRadius: "10px",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 600,
              background:
                selectedContacts.length === 0
                  ? DARK_THEME.surface
                  : DARK_THEME.panel,
              color:
                selectedContacts.length === 0
                  ? DARK_THEME.muted
                  : DARK_THEME.text,
              cursor: selectedContacts.length === 0 ? "not-allowed" : "pointer"
            }}>
            Download JSON
          </button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            color: DARK_THEME.muted,
            lineHeight: 1.6
          }}>
          No LinkedIn contacts were found. Wait for the search results to load,
          close the drawer, and try again.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              fontSize: "12px",
              color: DARK_THEME.muted
            }}>
            <span>
              {selectedContacts.length} of {contacts.length} selected
            </span>
            <span style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() =>
                  setSelectedKeys(new Set(contacts.map(contactKey)))
                }
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  color: DARK_THEME.accent,
                  cursor: "pointer",
                  fontSize: "12px"
                }}>
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedKeys(new Set())}
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  color: DARK_THEME.accent,
                  cursor: "pointer",
                  fontSize: "12px"
                }}>
                Clear
              </button>
            </span>
          </div>

          {viewMode === "json" ? (
            <pre
              data-testid="linkedin-contacts-json"
              style={{
                margin: 0,
                padding: "14px",
                overflow: "auto",
                border: `1px solid ${DARK_THEME.border}`,
                borderRadius: "12px",
                background: DARK_THEME.code,
                color: DARK_THEME.text,
                fontFamily: "monospace",
                fontSize: "12px",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>
              {JSON.stringify(selectedContacts, null, 2)}
            </pre>
          ) : (
            contacts.map((contact) => {
              const isSelected = selectedKeys.has(contactKey(contact))

              return (
                <article
                  key={contactKey(contact)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "14px",
                    border: `1px solid ${
                      isSelected ? DARK_THEME.borderStrong : DARK_THEME.border
                    }`,
                    borderRadius: "12px",
                    background: DARK_THEME.surface,
                    opacity: isSelected ? 1 : 0.55
                  }}>
                  <input
                    type="checkbox"
                    aria-label={`Include ${contact.name}`}
                    checked={isSelected}
                    onChange={() => toggleContact(contact)}
                    style={{
                      width: "16px",
                      height: "16px",
                      marginTop: "3px",
                      flexShrink: 0,
                      accentColor: DARK_THEME.accent,
                      cursor: "pointer"
                    }}
                  />
                  {contact.imageUrl ? (
                    <img
                      src={contact.imageUrl}
                      alt=""
                      style={{
                        width: "44px",
                        height: "44px",
                        flexShrink: 0,
                        borderRadius: "50%",
                        objectFit: "cover"
                      }}
                    />
                  ) : null}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: DARK_THEME.text }}>
                      {contact.name}
                      {contact.connectionDegree
                        ? ` · ${contact.connectionDegree}`
                        : ""}
                    </div>
                    {contact.headline ? (
                      <div style={{ marginTop: "3px", color: DARK_THEME.text }}>
                        {contact.headline}
                      </div>
                    ) : null}
                    {contact.location ? (
                      <div
                        style={{ marginTop: "3px", color: DARK_THEME.muted }}>
                        {contact.location}
                      </div>
                    ) : null}
                    {contact.current ? (
                      <div
                        style={{
                          marginTop: "7px",
                          fontSize: "12px",
                          color: DARK_THEME.muted
                        }}>
                        Current: {contact.current}
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })
          )}
        </>
      )}
    </div>
  )
}
