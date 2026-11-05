/**
 * The agent's verdict on a saved tweet, read from the local setup-insights
 * service. Fetching happens in the background worker, because a content script
 * on x.com cannot reach 127.0.0.1 itself.
 */

export const ASSESSMENT_ACTION = "getBookmarkAssessments"
const SERVICE = "http://127.0.0.1:7338/v1/assessments"
const OUT_OF_DATE_DAYS = 30

export interface AssessmentRecommendation {
  id: number
  title: string
  change: string
  status: string
  status_label: string
  status_ref: string | null
  impact: number
  effort: number
  liked?: boolean
}

export interface Assessment {
  tweet_id: string
  status: "not_evaluated" | "assessed" | "not_relevant" | "no_text" | "failed"
  evaluated_at: string | null
  recommendation: AssessmentRecommendation | null
  setup_changes_since: number
  topic?: string | null
  takeaway?: string
  why?: string
  still_applies?: string
  staleness?: string
  staleness_reason?: string
  adopted?: string
  adoption_evidence?: string
  needs_verification?: boolean
  verification_note?: string
  no_recommendation_reason?: string | null
}

export type AssessmentResponse = { ok: true; assessments: Record<string, Assessment> } | { ok: false }

export async function fetchAssessments(ids: string[]): Promise<AssessmentResponse> {
  const clean = ids.filter((id) => /^\d+$/.test(id)).slice(0, 100)
  if (!clean.length) return { ok: true, assessments: {} }
  try {
    const res = await fetch(`${SERVICE}?ids=${clean.join(",")}`)
    if (!res.ok) return { ok: false }
    const body = await res.json()
    return { ok: true, assessments: body.assessments }
  } catch {
    return { ok: false }
  }
}

export interface AssessmentView {
  badge: "Not yet evaluated" | "No recommendation" | "Recommendation" | "Could not evaluate"
  tone: "pending" | "quiet" | "action" | "warn"
  headline: string
  detail: string
  rows: { label: string; value: string }[]
  freshness: string
  outOfDate: boolean
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

function age(evaluatedAt: string, now: Date): { days: number; text: string } {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(evaluatedAt).getTime()) / 86400000))
  return { days, text: days === 0 ? "today" : `${plural(days, "day")} ago` }
}

function freshness(a: Assessment, now: Date): { text: string; outOfDate: boolean } {
  if (!a.evaluated_at) return { text: "No evaluation yet.", outOfDate: false }
  const { days, text } = age(a.evaluated_at, now)
  const moved = a.setup_changes_since > 0 ? ` Your setup has changed ${plural(a.setup_changes_since, "time")} since.` : ""
  const outOfDate = days >= OUT_OF_DATE_DAYS
  return { text: `Evaluated ${text}.${moved}${outOfDate ? " This may be out of date." : ""}`, outOfDate }
}

export function describeAssessment(a: Assessment, now: Date = new Date()): AssessmentView {
  const f = freshness(a, now)
  const shared = { freshness: f.text, outOfDate: f.outOfDate, rows: [] as AssessmentView["rows"] }
  switch (a.status) {
    case "not_evaluated":
      return { ...shared, badge: "Not yet evaluated", tone: "pending", headline: "The agent has not finished reading this one.",
        detail: "It will be picked up on a coming daily run." }
    case "not_relevant":
      return { ...shared, badge: "No recommendation", tone: "quiet", headline: "Not relevant to your setup",
        detail: a.topic ? `Sorted as: ${a.topic}.` : "It carries nothing that would change your setup." }
    case "no_text":
      return { ...shared, badge: "No recommendation", tone: "quiet", headline: "No text to evaluate",
        detail: "This saved row has no tweet text, so the agent could not judge it." }
    case "failed":
      return { ...shared, badge: "Could not evaluate", tone: "warn", headline: "The agent could not judge this one.",
        detail: "It failed after several tries." }
  }
  const rec = a.recommendation
  const rows = [
    { label: "Staleness", value: [a.staleness, a.staleness_reason].filter(Boolean).join(". ") },
    { label: "Still applies", value: a.still_applies ?? "unknown" },
    { label: "Adopted", value: [a.adopted, a.adoption_evidence].filter(Boolean).join(". ") }
  ]
  if (rec) {
    rows.push({ label: "Recommendation", value: `${rec.status_label}. Item ${rec.id}. ${rec.change}` })
    if (rec.status === "implemented" && rec.status_ref) rows.push({ label: "Change made", value: rec.status_ref })
    if (rec.liked) rows.push({ label: "Liked", value: "You liked this idea." })
  }
  if (a.needs_verification && a.verification_note) rows.push({ label: "Check first", value: a.verification_note })
  return { ...shared, rows, badge: rec ? "Recommendation" : "No recommendation", tone: rec ? "action" : "quiet",
    headline: a.takeaway ?? "", detail: rec ? (a.why ?? "") : (a.no_recommendation_reason ?? a.why ?? "") }
}
