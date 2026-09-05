export interface LinkedInContact {
  name: string
  profileUrl?: string
  headline?: string
  location?: string
  current?: string
  connectionDegree?: string
  imageUrl?: string
}

const RESULT_CARD_SELECTORS = [
  "li.reusable-search__result-container",
  '[data-view-name="search-entity-result-universal-template"]'
]

const textFrom = (
  root: ParentNode,
  selectors: string[]
): string | undefined => {
  for (const selector of selectors) {
    const text = root
      .querySelector(selector)
      ?.textContent?.replace(/\s+/g, " ")
      .trim()
    if (text) return text
  }

  return undefined
}

const canonicalProfileUrl = (href: string | null): string | undefined => {
  if (!href) return undefined

  try {
    const url = new URL(href, "https://www.linkedin.com")
    if (
      url.hostname !== "www.linkedin.com" ||
      !url.pathname.startsWith("/in/")
    ) {
      return undefined
    }

    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return undefined
  }
}

const scrapeCard = (card: Element): LinkedInContact | null => {
  const paragraphs = Array.from(card.querySelectorAll("p"))
    .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
    .filter((text): text is string => Boolean(text))
  const semanticNameLine = paragraphs[0]
  const semanticDegree = semanticNameLine?.match(
    /[·•]\s*((?:1st|2nd|3rd)\+?)\s*$/i
  )?.[1]
  const semanticName = semanticNameLine
    ?.replace(/[·•]\s*(?:1st|2nd|3rd)\+?\s*$/i, "")
    .trim()
  const profileLink = card.matches('a[href*="/in/"]')
    ? (card as HTMLAnchorElement)
    : card.querySelector<HTMLAnchorElement>('a[href*="/in/"]')
  const name =
    textFrom(card, [
      ".entity-result__title-text a span[aria-hidden=true]",
      'a[href*="/in/"] span[aria-hidden=true]',
      ".entity-result__title-text a"
    ]) ?? semanticName

  if (!name) return null

  const contact: LinkedInContact = { name }
  const profileUrl = canonicalProfileUrl(
    profileLink?.getAttribute("href") ?? null
  )
  const headline =
    textFrom(card, [
      ".entity-result__primary-subtitle",
      ".t-14.t-black.t-normal"
    ]) ?? paragraphs[1]
  const location =
    textFrom(card, [
      ".entity-result__secondary-subtitle",
      ".t-14.t-normal.t-black--light"
    ]) ?? paragraphs[2]
  const currentText =
    textFrom(card, [".entity-result__summary"]) ??
    paragraphs.find((text) => /^Current:/i.test(text))
  const current = currentText?.replace(/^Current:\s*/i, "")
  const connectionDegree =
    textFrom(card, [
      ".entity-result__badge-text span[aria-hidden=true]",
      ".entity-result__badge-text"
    ])?.replace(/^[\s·•]+/, "") ?? semanticDegree
  const imageUrl = card.querySelector<HTMLImageElement>(
    "img.entity-result__img, .entity-result__img img, img"
  )?.src

  if (profileUrl) contact.profileUrl = profileUrl
  if (headline) contact.headline = headline
  if (location) contact.location = location
  if (current) contact.current = current
  if (connectionDegree) contact.connectionDegree = connectionDegree
  if (imageUrl) contact.imageUrl = imageUrl

  return contact
}

export const isLinkedInPeopleSearchPage = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname === "www.linkedin.com" &&
      /^\/search\/results\/people\/?$/.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

export const scrapeLinkedInContacts = (
  root: ParentNode = document
): LinkedInContact[] => {
  const legacyCards = Array.from(
    root.querySelectorAll(RESULT_CARD_SELECTORS.join(","))
  )
  const semanticCards = Array.from(
    root.querySelectorAll('main a[href*="/in/"]')
  ).filter(
    (element) =>
      Boolean(element.querySelector("img")) &&
      element.querySelectorAll("p").length >= 3
  )
  const cards = legacyCards.length > 0 ? legacyCards : semanticCards
  const contacts: LinkedInContact[] = []
  const seen = new Set<string>()

  for (const card of cards) {
    const contact = scrapeCard(card)
    if (!contact) continue

    const identity = contact.profileUrl ?? contact.name.toLocaleLowerCase()
    if (seen.has(identity)) continue

    seen.add(identity)
    contacts.push(contact)
  }

  return contacts
}

const timestampForFilename = (date: Date): string =>
  date
    .toISOString()
    .replace(/\.\d{3}Z$/, "")
    .replace(/:/g, "-")

export const downloadLinkedInContacts = (
  contacts: LinkedInContact[],
  now = new Date()
): void => {
  const blob = new Blob([JSON.stringify(contacts, null, 2)], {
    type: "application/json"
  })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = objectUrl
  anchor.download = `linkedin-contacts-${timestampForFilename(now)}.json`
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
