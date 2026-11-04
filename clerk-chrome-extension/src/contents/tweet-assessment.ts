/**
 * Shows the agent's verdict on a saved tweet, on demand. Deliberately separate
 * from twitter-save-button.ts: it only reads that button's state and never
 * touches the save flow.
 */

import type { PlasmoCSConfig } from "plasmo"

import { ENABLE_TWEET_BOOKMARK } from "~config/features"
import { ASSESSMENT_ACTION, describeAssessment, type Assessment, type AssessmentResponse } from "~lib/bookmark-assessment"

export const config: PlasmoCSConfig = {
  matches: ["https://x.com/*", "https://twitter.com/*"],
  run_at: "document_idle"
}

export type Lookup = { ok: true; assessment: Assessment } | { ok: false }

const BUTTON = "data-tweet-assessment"
const SAVE_BUTTON = "[data-tweet-saver]"
const STYLE_ID = "__tweet-assessment-styles"
const CACHE_MS = 60_000
const COLORS = { pending: "rgb(113,118,123)", quiet: "rgb(113,118,123)", action: "rgb(29,155,240)", warn: "rgb(255,173,31)" }
const ICON = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16v4M17 18h4"/></svg>`

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement("style")
  s.id = STYLE_ID
  s.textContent = `
    .tweet-assessment-btn { display:inline-flex; align-items:center; justify-content:center; width:34.75px; height:34.75px;
      padding:0; border:none; background:none; border-radius:9999px; cursor:pointer; transition:background-color .2s; }
    .tweet-assessment-btn:hover { background-color:rgba(29,155,240,.1); }
    .tweet-assessment-btn.pending { opacity:.55; }
    .tweet-assessment-pop { position:fixed; z-index:9999; width:340px; max-height:60vh; overflow:auto; box-sizing:border-box; padding:14px 16px;
      border-radius:14px; border:1px solid rgb(47,51,54); background:rgb(22,24,28); color:rgb(231,233,234);
      font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; box-shadow:0 8px 28px rgba(0,0,0,.45); }
    .tweet-assessment-pop .badge { font-size:12px; font-weight:700; margin-bottom:6px; }
    .tweet-assessment-pop .head { font-weight:700; font-size:15px; margin-bottom:4px; }
    .tweet-assessment-pop .detail { color:rgb(170,175,180); margin-bottom:10px; }
    .tweet-assessment-pop .label { color:rgb(113,118,123); font-size:12px; margin-top:8px; }
    .tweet-assessment-pop .fresh { margin-bottom:8px; color:rgb(113,118,123); font-size:12px; }
    .tweet-assessment-pop .fresh.old { color:rgb(255,173,31); }`
  document.head.appendChild(s)
}

function el(tag: string, cls: string, text: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = cls
  node.textContent = text
  return node
}

export function tweetIdOf(article: Element): string | null {
  for (const time of Array.from(article.querySelectorAll("time"))) {
    const m = time.closest("a")?.getAttribute("href")?.match(/\/status\/(\d+)/)
    if (m) return m[1]
  }
  // X does not always render a timestamp, so fall back to the tweet's own link.
  const ids = Array.from(article.querySelectorAll("a[href*='/status/']"))
    .map((a) => a.getAttribute("href")?.match(/\/status\/(\d+)/)?.[1])
    .filter((id): id is string => !!id)
  const pageId = window.location.pathname.match(/\/status\/(\d+)/)?.[1]
  return pageId && ids.includes(pageId) ? pageId : ids[0] ?? null
}

export function shouldShowIndicator(lookup: Lookup, saved: boolean): boolean {
  if (saved) return true
  return lookup.ok && lookup.assessment.status !== "not_evaluated"
}

let openPopover: HTMLElement | null = null

export function closePopover(): void {
  openPopover?.remove()
  openPopover = null
}

function showPopover(anchor: HTMLElement, lookup: Lookup): void {
  closePopover()
  injectStyles()
  const pop = document.createElement("div")
  pop.className = "tweet-assessment-pop"
  pop.setAttribute("data-testid", "tweet-assessment-popover")
  pop.setAttribute("role", "dialog")
  pop.addEventListener("click", (e) => e.stopPropagation())
  if (lookup.ok) {
    const v = describeAssessment(lookup.assessment)
    const badge = el("div", "badge", v.badge)
    badge.style.color = COLORS[v.tone]
    pop.append(badge, el("div", v.outOfDate ? "fresh old" : "fresh", v.freshness), el("div", "head", v.headline), el("div", "detail", v.detail))
    for (const r of v.rows) pop.append(el("div", "label", r.label), el("div", "value", r.value))
  } else {
    pop.append(el("div", "head", "Assessment unavailable"),
      el("div", "detail", "The setup-insights service on your Mac could not be reached, so nothing is known about this bookmark right now."))
  }
  document.body.appendChild(pop)
  const r = anchor.getBoundingClientRect()
  pop.style.left = `${Math.max(8, Math.min(r.right - 340, window.innerWidth - 348))}px`
  const below = r.bottom + 6 + pop.offsetHeight < window.innerHeight
  pop.style.top = below ? `${r.bottom + 6}px` : `${Math.max(8, r.top - pop.offsetHeight - 6)}px`
  openPopover = pop
}

function paint(btn: HTMLButtonElement, lookup: Lookup): void {
  const v = lookup.ok ? describeAssessment(lookup.assessment) : null
  btn.className = `tweet-assessment-btn ${v?.tone ?? "pending"}`
  btn.style.color = v ? COLORS[v.tone] : COLORS.pending
  const title = v ? `Agent: ${v.badge}` : "Agent: assessment unavailable"
  btn.title = title
  btn.setAttribute("aria-label", title)
}

export function attachIndicator(article: Element, lookup: Lookup): void {
  const saved = article.querySelector(SAVE_BUTTON)?.getAttribute("data-state") === "saved"
  const bar = article.querySelector('[role="group"]')
  const existing = article.querySelector<HTMLButtonElement>(`[${BUTTON}]`)
  if (!bar || !shouldShowIndicator(lookup, saved)) return
  injectStyles()
  const btn = existing ?? document.createElement("button")
  paint(btn, lookup)
  btn.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    showPopover(btn, lookup)
  }
  if (existing) return
  btn.type = "button"
  btn.setAttribute(BUTTON, "true")
  btn.setAttribute("data-testid", "tweet-assessment-button")
  btn.innerHTML = ICON
  const wrap = document.createElement("div")
  wrap.style.display = "inline-flex"
  wrap.style.alignItems = "center"
  wrap.appendChild(btn)
  bar.appendChild(wrap)
}

const cache = new Map<string, { at: number; lookup: Lookup }>()

function ask(ids: string[]): Promise<AssessmentResponse> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: ASSESSMENT_ACTION, ids }, (res?: AssessmentResponse) => {
        resolve(chrome.runtime.lastError || !res ? { ok: false } : res)
      })
    } catch {
      resolve({ ok: false })
    }
  })
}

async function refresh(): Promise<void> {
  const articles = Array.from(document.querySelectorAll("article"))
  const byId = new Map<string, Element[]>()
  for (const a of articles) {
    const id = tweetIdOf(a)
    if (id) byId.set(id, [...(byId.get(id) ?? []), a])
  }
  const now = Date.now()
  const stale = Array.from(byId.keys()).filter((id) => now - (cache.get(id)?.at ?? 0) > CACHE_MS).slice(0, 100)
  if (stale.length) {
    const res = await ask(stale)
    for (const id of stale) {
      const assessment = res.ok ? res.assessments[id] : undefined
      cache.set(id, { at: now, lookup: assessment ? { ok: true, assessment } : { ok: false } })
    }
  }
  byId.forEach((list, id) => {
    const hit = cache.get(id)
    if (hit) list.forEach((a) => attachIndicator(a, hit.lookup))
  })
}

function start(): void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void refresh(), 400)
  }
  new MutationObserver((records) => {
    if (records.every((r) => openPopover?.contains(r.target) || (r.target as Element).closest?.(`[${BUTTON}]`))) return
    schedule()
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] })
  document.addEventListener("click", closePopover)
  schedule()
}

if (typeof window !== "undefined" && typeof chrome !== "undefined" && ENABLE_TWEET_BOOKMARK) start()

if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopover()
  })
}
