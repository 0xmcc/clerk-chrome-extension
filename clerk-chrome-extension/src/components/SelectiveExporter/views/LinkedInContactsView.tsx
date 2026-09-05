import { useEffect, useMemo, useState } from "react"

import type { LinkedInContact } from "~lib/linkedin-contacts"

import { DARK_THEME } from "../constants"

interface LinkedInContactsViewProps {
  contacts: LinkedInContact[]
  onDownload: (contacts: LinkedInContact[]) => void
}

type ContactViewMode = "contacts" | "json"

const contactKey = (contact: LinkedInContact): string =>
  contact.profileUrl ?? contact.name

export const LinkedInContactsView = ({
  contacts,
  onDownload
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
