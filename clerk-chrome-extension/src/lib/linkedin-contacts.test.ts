import { describe, expect, it, vi } from "vitest"

import {
  downloadLinkedInContacts,
  isLinkedInPeopleSearchPage,
  scrapeLinkedInContacts
} from "./linkedin-contacts"

describe("LinkedIn people search contact export", () => {
  it("recognizes LinkedIn people search pages only", () => {
    expect(
      isLinkedInPeopleSearchPage(
        "https://www.linkedin.com/search/results/people/?keywords=Barcelino"
      )
    ).toBe(true)
    expect(
      isLinkedInPeopleSearchPage("https://www.linkedin.com/in/example-person/")
    ).toBe(false)
    expect(
      isLinkedInPeopleSearchPage(
        "https://example.com/search/results/people/?keywords=Barcelino"
      )
    ).toBe(false)
  })

  it("scrapes rich contact data from result cards and excludes the sidebar", () => {
    document.body.innerHTML = `
      <main>
        <ul role="list" class="reusable-search__entity-result-list">
          <li class="reusable-search__result-container" data-chameleon-result-urn="urn:li:member:123">
            <div class="entity-result">
              <img class="entity-result__img" src="https://media.licdn.com/dms/image/person-one.jpg" />
              <div class="entity-result__title-text">
                <a href="https://www.linkedin.com/in/navama-railich/?miniProfileUrn=123">
                  <span aria-hidden="true"> Navama Railich </span>
                </a>
              </div>
              <div class="entity-result__badge-text"><span aria-hidden="true">• 3rd+</span></div>
              <div class="entity-result__primary-subtitle">
                Product Designer | UX + Visual Design | Creating clear and intuitive digital experiences
              </div>
              <div class="entity-result__secondary-subtitle"> San Francisco Bay Area </div>
              <p class="entity-result__summary">Current: Product Designer at Barcelino</p>
            </div>
          </li>
          <li class="reusable-search__result-container">
            <div class="entity-result">
              <div class="entity-result__title-text">
                <a href="/in/mitra-martin/"><span aria-hidden="true">Mitra Martin</span></a>
              </div>
              <div class="entity-result__primary-subtitle">Director of Womenswear – Barcelino</div>
              <div class="entity-result__secondary-subtitle">San Rafael, California, United States</div>
            </div>
          </li>
        </ul>
      </main>
      <aside>
        <a href="/in/sidebar-person/"><span aria-hidden="true">Sidebar Person</span></a>
      </aside>
    `

    expect(scrapeLinkedInContacts(document)).toEqual([
      {
        name: "Navama Railich",
        profileUrl: "https://www.linkedin.com/in/navama-railich/",
        headline:
          "Product Designer | UX + Visual Design | Creating clear and intuitive digital experiences",
        location: "San Francisco Bay Area",
        current: "Product Designer at Barcelino",
        connectionDegree: "3rd+",
        imageUrl: "https://media.licdn.com/dms/image/person-one.jpg"
      },
      {
        name: "Mitra Martin",
        profileUrl: "https://www.linkedin.com/in/mitra-martin/",
        headline: "Director of Womenswear – Barcelino",
        location: "San Rafael, California, United States"
      }
    ])
  })

  it("deduplicates repeated profile cards and supports LinkedIn's newer data-view-name markup", () => {
    document.body.innerHTML = `
      <div data-view-name="search-entity-result-universal-template">
        <a href="/in/sharam-sharei/"><span aria-hidden="true">Sharam Sharei</span></a>
        <div class="t-14 t-black t-normal">President at Barcelino Cont'l Corp</div>
        <div class="t-14 t-normal t-black--light">Corte Madera, California, United States</div>
      </div>
      <div data-view-name="search-entity-result-universal-template">
        <a href="/in/sharam-sharei/?trk=duplicate"><span aria-hidden="true">Sharam Sharei</span></a>
      </div>
    `

    expect(scrapeLinkedInContacts(document)).toEqual([
      {
        name: "Sharam Sharei",
        profileUrl: "https://www.linkedin.com/in/sharam-sharei/",
        headline: "President at Barcelino Cont'l Corp",
        location: "Corte Madera, California, United States"
      }
    ])
  })

  it("downloads a timestamped, formatted JSON file", () => {
    const createObjectURL = vi.fn(() => "blob:linkedin-contacts")
    const revokeObjectURL = vi.fn()
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL }
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    downloadLinkedInContacts(
      [{ name: "Navama Railich", location: "San Francisco Bay Area" }],
      new Date("2026-09-04T12:34:56.000Z")
    )

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    const anchor = click.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe("linkedin-contacts-2026-09-04T12-34-56.json")
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:linkedin-contacts")
  })
})
