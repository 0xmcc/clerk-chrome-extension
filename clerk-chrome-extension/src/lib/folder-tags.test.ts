import { describe, expect, it } from "vitest"

import { folderTagsFrom, mergeTags } from "./folder-tags"

/**
 * Saving from a bookmarks folder has to record WHICH folder, or everything
 * downstream sees one undifferentiated pile. The reels publisher selects rows
 * by exactly this tag, so a folder that stops tagging is a pipeline that
 * silently posts nothing.
 */
describe("folderTagsFrom", () => {
  it("tags a save made inside a folder with the folder id", () => {
    expect(folderTagsFrom("/i/bookmarks/1889012345678901234")).toContain(
      "folder:1889012345678901234"
    )
  })

  it("works under the /i/history path X moved bookmarks to", () => {
    expect(folderTagsFrom("/i/history/1889012345678901234")).toContain(
      "folder:1889012345678901234"
    )
  })

  it("does not tag the plain bookmarks page", () => {
    expect(folderTagsFrom("/i/bookmarks")).toEqual([])
    expect(folderTagsFrom("/i/history")).toEqual([])
  })

  it("does not treat the 'all' tab as a folder", () => {
    // /i/bookmarks/all is a tab, not a folder, and tagging it would sweep
    // every bookmark into whatever the publisher is pointed at.
    expect(folderTagsFrom("/i/bookmarks/all")).toEqual([])
  })

  it("ignores unrelated pages entirely", () => {
    expect(folderTagsFrom("/home")).toEqual([])
    expect(folderTagsFrom("/jack/status/123")).toEqual([])
  })

  it("adds a readable slug when the folder name is known", () => {
    const tags = folderTagsFrom("/i/bookmarks/1889012345678901234", "Reels To Post")
    expect(tags).toContain("folder:1889012345678901234")
    expect(tags).toContain("reels-to-post")
  })

  it("slugifies punctuation and collapses whitespace", () => {
    const tags = folderTagsFrom("/i/bookmarks/123", "  Funny // Clips!!  ")
    expect(tags).toContain("funny-clips")
  })

  it("skips a folder name that slugifies to nothing", () => {
    expect(folderTagsFrom("/i/bookmarks/123", "!!!")).toEqual(["folder:123"])
  })
})

/**
 * The tweets upsert matches on tweet_id, so writing tags naively would drop
 * the tag a previous folder put there. Re-saving a tweet from one folder must
 * not erase the fact that it is also in another.
 */
describe("mergeTags", () => {
  it("keeps tags the row already had", () => {
    expect(mergeTags(["folder:111"], ["folder:222"]).sort()).toEqual([
      "folder:111",
      "folder:222"
    ])
  })

  it("does not duplicate a tag that is already there", () => {
    expect(mergeTags(["folder:111"], ["folder:111"])).toEqual(["folder:111"])
  })

  it("survives a row with no tags at all", () => {
    expect(mergeTags(null, ["folder:111"])).toEqual(["folder:111"])
    expect(mergeTags(undefined, ["folder:111"])).toEqual(["folder:111"])
  })

  it("returns the existing tags unchanged when there is nothing to add", () => {
    expect(mergeTags(["keep-me"], [])).toEqual(["keep-me"])
  })

  it("drops empty strings rather than writing blank tags", () => {
    expect(mergeTags(["", "real"], ["  "])).toEqual(["real"])
  })
})
