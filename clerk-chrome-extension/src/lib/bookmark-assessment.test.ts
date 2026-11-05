import { afterEach, describe, expect, it, vi } from "vitest"

import { describeAssessment, fetchAssessments, type Assessment } from "./bookmark-assessment"

const NOW = new Date("2026-11-04T12:00:00Z")
const base: Assessment = {
  tweet_id: "1",
  status: "not_evaluated",
  evaluated_at: null,
  recommendation: null,
  setup_changes_since: 0
}
const assessed: Assessment = {
  ...base,
  status: "assessed",
  evaluated_at: "2026-11-02T12:00:00Z",
  takeaway: "Use hooks for checks",
  why: "Catches mistakes early",
  staleness: "current",
  staleness_reason: "Feature still exists",
  still_applies: "yes",
  adopted: "no",
  adoption_evidence: "No such hook",
  no_recommendation_reason: "Already in your setup"
}

describe("describeAssessment", () => {
  it("separates not yet evaluated from no recommendation", () => {
    const pending = describeAssessment(base, NOW)
    const none = describeAssessment({ ...assessed, adopted: "yes" }, NOW)
    expect(pending.badge).toBe("Not yet evaluated")
    expect(none.badge).toBe("No recommendation")
    expect(none.detail).toContain("Already in your setup")
    expect(pending.tone).not.toBe(none.tone)
  })

  it("never says a proposal was applied", () => {
    const v = describeAssessment({
      ...assessed,
      recommendation: { id: 7, title: "Add hook", change: "Add a hook", status: "proposed",
        status_label: "Proposed, not applied", status_ref: null, impact: 4, effort: 2 }
    }, NOW)
    expect(v.badge).toBe("Recommendation")
    expect(v.rows.find((r) => r.label === "Recommendation")?.value).toContain("Proposed, not applied")
  })

  it("reports how old the evaluation is and whether the setup moved since", () => {
    const v = describeAssessment({ ...assessed, setup_changes_since: 3 }, NOW)
    expect(v.freshness).toBe("Evaluated 2 days ago. Your setup has changed 3 times since.")
    expect(v.outOfDate).toBe(false)
  })

  it("flags an old evaluation as possibly out of date", () => {
    const v = describeAssessment({ ...assessed, evaluated_at: "2026-09-01T00:00:00Z" }, NOW)
    expect(v.outOfDate).toBe(true)
  })

  it("does not invent a date for something never evaluated", () => {
    expect(describeAssessment(base, NOW).freshness).toBe("No evaluation yet.")
  })

  it("explains bookmarks judged not relevant", () => {
    const v = describeAssessment({ ...base, status: "not_relevant", topic: "Fashion promo", evaluated_at: "2026-11-04T00:00:00Z" }, NOW)
    expect(v.badge).toBe("No recommendation")
    expect(v.detail).toContain("Fashion promo")
  })
})

describe("fetchAssessments", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("reports the service being down as unavailable, not as unevaluated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("refused")))
    expect(await fetchAssessments(["1"])).toEqual({ ok: false })
  })

  it("reports a bad status as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect(await fetchAssessments(["1"])).toEqual({ ok: false })
  })

  it("reads only numeric ids, from the local service", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ assessments: { "1": base } }) })
    vi.stubGlobal("fetch", fetchMock)
    const r = await fetchAssessments(["1", "abc"])
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:7338/v1/assessments?ids=1")
    expect(r).toEqual({ ok: true, assessments: { "1": base } })
  })

  it("shows a like on the recommendation and stays quiet without one", () => {
    const rec = { id: 7, title: "Add hook", change: "Add a hook", status: "rejected",
      status_label: "Rejected", status_ref: null, impact: 3, effort: 1 }
    const base = { tweet_id: "1", status: "assessed" as const, evaluated_at: null, setup_changes_since: 0 }
    const liked = describeAssessment({ ...base, recommendation: { ...rec, liked: true } })
    expect(liked.rows.find((r) => r.label === "Liked")?.value).toBe("You liked this idea.")
    const plain = describeAssessment({ ...base, recommendation: rec })
    expect(plain.rows.find((r) => r.label === "Liked")).toBeUndefined()
  })
})
