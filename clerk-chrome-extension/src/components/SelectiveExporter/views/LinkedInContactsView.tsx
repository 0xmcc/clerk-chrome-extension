import type { LinkedInContact } from "~lib/linkedin-contacts"

import { DARK_THEME } from "../constants"

interface LinkedInContactsViewProps {
  contacts: LinkedInContact[]
  onDownload: () => void
}

export const LinkedInContactsView = ({
  contacts,
  onDownload
}: LinkedInContactsViewProps) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
    <button
      type="button"
      onClick={onDownload}
      disabled={contacts.length === 0}
      style={{
        alignSelf: "flex-end",
        border: `1px solid ${DARK_THEME.border}`,
        borderRadius: "10px",
        padding: "8px 12px",
        fontSize: "12px",
        fontWeight: 600,
        background:
          contacts.length === 0 ? DARK_THEME.surface : DARK_THEME.panel,
        color: contacts.length === 0 ? DARK_THEME.muted : DARK_THEME.text,
        cursor: contacts.length === 0 ? "not-allowed" : "pointer"
      }}>
      Download JSON
    </button>

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
      contacts.map((contact) => (
        <article
          key={contact.profileUrl ?? contact.name}
          style={{
            display: "flex",
            gap: "12px",
            padding: "14px",
            border: `1px solid ${DARK_THEME.border}`,
            borderRadius: "12px",
            background: DARK_THEME.surface
          }}>
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
              {contact.connectionDegree ? ` · ${contact.connectionDegree}` : ""}
            </div>
            {contact.headline ? (
              <div style={{ marginTop: "3px", color: DARK_THEME.text }}>
                {contact.headline}
              </div>
            ) : null}
            {contact.location ? (
              <div style={{ marginTop: "3px", color: DARK_THEME.muted }}>
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
      ))
    )}
  </div>
)
