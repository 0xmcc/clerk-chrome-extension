/**
 * Plasmo content script: injects a "Save" button into Twitter/X tweet action rows,
 * and a bulk "Scroll & Save All" button on bookmarks pages.
 *
 * Uses vanilla DOM manipulation (not React/TSX) since we're injecting directly
 * into Twitter's DOM rather than rendering a shadow DOM overlay.
 */

import type { PlasmoCSConfig } from "plasmo"
import { extractTweetData, expandLongPost } from "~lib/tweet-extractor"
import { saveTweet, checkSavedTweets, checkCompletedTweets, backfillMetricsForTweet, tagExistingTweets } from "~lib/tweet-saver"
import { folderTagsFrom } from "~lib/folder-tags"
import { ENABLE_TWEET_BOOKMARK } from "~config/features"

// ---------------------------------------------------------------------------
// Plasmo config
// ---------------------------------------------------------------------------

export const config: PlasmoCSConfig = {
  matches: ["https://x.com/*", "https://twitter.com/*"],
  run_at: "document_idle"
}

// ---------------------------------------------------------------------------
// SVG icons — cloud-upload (outline & filled)
// ---------------------------------------------------------------------------

const CLOUD_UPLOAD_OUTLINE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V8"/><path d="M9 11l3-3 3 3"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>`

const CLOUD_UPLOAD_FILLED = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="none"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-12.74 8.25V16a1 1 0 0 0 1 1h3v-4.59l-1.3 1.3a1 1 0 0 1-1.4-1.42l3-3a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1-1.4 1.42L11 12.41V17h3a1 1 0 0 0 1-1v-.75a5 5 0 0 0 5 1.33z"/></svg>`

// ---------------------------------------------------------------------------
// CSS styles (injected once)
// ---------------------------------------------------------------------------

const STYLE_ID = "__tweet-saver-styles"

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .tweet-saver-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 9999px;
      width: 34.75px;
      height: 34.75px;
      transition: background-color 0.2s, color 0.2s;
      color: rgb(113, 118, 123);
    }
    .tweet-saver-btn:hover {
      background-color: rgba(29, 155, 240, 0.1);
      color: rgb(29, 155, 240);
    }
    .tweet-saver-btn.saved {
      color: rgb(29, 155, 240);
    }
    .tweet-saver-btn.saving {
      animation: tweet-saver-pulse 1s ease-in-out infinite;
    }
    .tweet-saver-btn.error {
      animation: tweet-saver-error-flash 0.6s ease-out;
    }
    @keyframes tweet-saver-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes tweet-saver-error-flash {
      0% { color: rgb(249, 24, 128); }
      100% { color: rgb(113, 118, 123); }
    }

    /* Bulk scroll-and-save button */
    .tweet-saver-bulk-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 20px;
      border: none;
      border-radius: 9999px;
      background-color: rgb(29, 155, 240);
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 15px;
      font-weight: 700;
      line-height: 20px;
      cursor: pointer;
      transition: background-color 0.2s;
      white-space: nowrap;
    }
    .tweet-saver-bulk-btn:hover {
      background-color: rgb(26, 140, 216);
    }
    .tweet-saver-bulk-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .tweet-saver-bulk-btn.done {
      background-color: rgb(0, 186, 124);
    }
    .tweet-saver-bulk-btn.scrolling {
      background-color: rgb(249, 24, 128);
    }
    .tweet-saver-bulk-btn.scrolling:hover {
      background-color: rgb(220, 20, 110);
    }
    .tweet-saver-bulk-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid rgb(47, 51, 54);
      position: sticky;
      z-index: 30;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
    }

    /* Floating Dashboard Overlay */
    .stashy-dashboard {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 10000;
      background: rgba(22, 24, 28, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(56, 68, 77, 0.8);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #e7e9ea;
      min-width: 280px;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    .stashy-dashboard.minimized {
      min-width: auto;
      width: 56px;
    }
    .stashy-dashboard.minimized .stashy-dashboard-body {
      display: none;
    }
    .stashy-dashboard.done {
      border-color: rgba(0, 186, 124, 0.6);
    }
    .stashy-dashboard-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(32, 35, 39, 0.6);
      border-bottom: 1px solid rgba(56, 68, 77, 0.5);
    }
    .stashy-dashboard.minimized .stashy-dashboard-header {
      justify-content: center;
      border-bottom: none;
      padding: 14px;
    }
    .stashy-dashboard-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
    }
    .stashy-mascot {
      font-size: 20px;
      animation: stashy-bounce 1.5s ease-in-out infinite;
    }
    .stashy-dashboard.done .stashy-mascot {
      animation: stashy-celebrate 0.6s ease-out;
    }
    @keyframes stashy-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    @keyframes stashy-celebrate {
      0% { transform: scale(1) rotate(0deg); }
      25% { transform: scale(1.2) rotate(-10deg); }
      50% { transform: scale(1.2) rotate(10deg); }
      75% { transform: scale(1.1) rotate(-5deg); }
      100% { transform: scale(1) rotate(0deg); }
    }
    .stashy-dashboard-controls {
      display: flex;
      gap: 4px;
    }
    .stashy-dashboard.minimized .stashy-dashboard-controls {
      display: none;
    }
    .stashy-dashboard.minimized .stashy-dashboard-title span {
      display: none;
    }
    .stashy-control-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: #8b98a5;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }
    .stashy-control-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #e7e9ea;
    }
    .stashy-dashboard-body {
      padding: 16px;
    }
    .stashy-status {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .stashy-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(29, 155, 240, 0.3);
      border-top-color: rgb(29, 155, 240);
      border-radius: 50%;
      animation: stashy-spin 0.8s linear infinite;
    }
    .stashy-dashboard.done .stashy-spinner {
      display: none;
    }
    @keyframes stashy-spin {
      to { transform: rotate(360deg); }
    }
    .stashy-status-text {
      font-size: 14px;
      color: #8b98a5;
    }
    .stashy-dashboard.done .stashy-status-text {
      color: rgb(0, 186, 124);
    }
    .stashy-counter {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-bottom: 16px;
    }
    .stashy-counter-number {
      font-size: 32px;
      font-weight: 700;
      color: rgb(29, 155, 240);
      line-height: 1;
    }
    .stashy-dashboard.done .stashy-counter-number {
      color: rgb(0, 186, 124);
    }
    .stashy-counter-label {
      font-size: 14px;
      color: #8b98a5;
    }
    .stashy-progress-bar {
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    .stashy-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, rgb(29, 155, 240), rgb(0, 186, 124));
      border-radius: 2px;
      transition: width 0.3s ease;
      animation: stashy-progress-glow 2s ease-in-out infinite;
    }
    @keyframes stashy-progress-glow {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .stashy-dashboard.done .stashy-progress-fill {
      background: rgb(0, 186, 124);
      animation: none;
    }
    .stashy-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
    }
    .stashy-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .stashy-stat-value {
      font-size: 16px;
      font-weight: 600;
      color: #e7e9ea;
    }
    .stashy-stat-label {
      font-size: 11px;
      color: #8b98a5;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stashy-stop-btn {
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-radius: 9999px;
      background: rgb(249, 24, 128);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }
    .stashy-stop-btn:hover {
      background: rgb(220, 20, 110);
    }
    .stashy-dashboard.done .stashy-stop-btn {
      background: rgb(0, 186, 124);
    }
    .stashy-dashboard.done .stashy-stop-btn:hover {
      background: rgb(0, 160, 105);
    }
    .stashy-continue-btn {
      display: none;
      width: 100%;
      padding: 10px 16px;
      margin-bottom: 8px;
      border: none;
      border-radius: 9999px;
      background: rgb(29, 155, 240);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .stashy-dashboard.done .stashy-continue-btn { display: block; }
    .stashy-hint {
      text-align: center;
      font-size: 11px;
      color: #6e7681;
      margin-top: 8px;
    }
  `
  document.head.appendChild(style)
}

// ---------------------------------------------------------------------------
// Floating Dashboard Overlay
// ---------------------------------------------------------------------------

const DASHBOARD_ID = "__stashy-dashboard"

interface DashboardState {
  saved: number
  skipped: number
  failed: number
  queued: number
  isComplete: boolean
  reason?: "stopped" | "idle" | "reset"
}

let dashboardElement: HTMLDivElement | null = null
let dashboardMinimized = false

function createDashboard(onStop: () => void, onContinue: () => void): HTMLDivElement {
  // Remove existing dashboard if any
  document.getElementById(DASHBOARD_ID)?.remove()

  const dashboard = document.createElement("div")
  dashboard.id = DASHBOARD_ID
  dashboard.className = "stashy-dashboard"

  dashboard.innerHTML = `
    <div class="stashy-dashboard-header">
      <div class="stashy-dashboard-title">
        <span class="stashy-mascot">🐿️</span>
        <span>Stashy</span>
      </div>
      <div class="stashy-dashboard-controls">
        <button class="stashy-control-btn" data-action="minimize" title="Minimize">─</button>
        <button class="stashy-control-btn" data-action="close" title="Close">✕</button>
      </div>
    </div>
    <div class="stashy-dashboard-body">
      <div class="stashy-status">
        <div class="stashy-spinner"></div>
        <span class="stashy-status-text">Saving bookmarks...</span>
      </div>
      <div class="stashy-counter">
        <span class="stashy-counter-number" data-counter="saved">0</span>
        <span class="stashy-counter-label">tweets saved</span>
      </div>
      <div class="stashy-progress-bar">
        <div class="stashy-progress-fill" style="width: 0%"></div>
      </div>
      <div class="stashy-stats">
        <div class="stashy-stat">
          <span class="stashy-stat-value" data-stat="queued">0</span>
          <span class="stashy-stat-label">Queued</span>
        </div>
        <div class="stashy-stat">
          <span class="stashy-stat-value" data-stat="skipped">0</span>
          <span class="stashy-stat-label">Skipped</span>
        </div>
        <div class="stashy-stat">
          <span class="stashy-stat-value" data-stat="failed">0</span>
          <span class="stashy-stat-label">Failed</span>
        </div>
      </div>
      <button class="stashy-continue-btn" data-action="continue">▶ Continue where it left off</button>
      <button class="stashy-stop-btn" data-action="stop">⏹ Stop Saving</button>
      <div class="stashy-hint">Press Esc to stop</div>
    </div>
  `

  // Event handlers
  dashboard.querySelector('[data-action="minimize"]')?.addEventListener("click", () => {
    dashboardMinimized = !dashboardMinimized
    dashboard.classList.toggle("minimized", dashboardMinimized)
    const btn = dashboard.querySelector('[data-action="minimize"]') as HTMLButtonElement
    btn.textContent = dashboardMinimized ? "□" : "─"
    btn.title = dashboardMinimized ? "Expand" : "Minimize"
  })

  dashboard.querySelector('[data-action="close"]')?.addEventListener("click", () => {
    onStop()
    hideDashboard()
  })

  dashboard.querySelector('[data-action="stop"]')?.addEventListener("click", () => {
    if (dashboard.classList.contains("done")) {
      hideDashboard()
    } else {
      onStop()
    }
  })

  dashboard.querySelector('[data-action="continue"]')?.addEventListener("click", onContinue)

  document.body.appendChild(dashboard)
  dashboardElement = dashboard
  dashboardMinimized = false

  return dashboard
}

function updateDashboard(state: DashboardState): void {
  if (!dashboardElement) return

  const savedEl = dashboardElement.querySelector('[data-counter="saved"]')
  const queuedEl = dashboardElement.querySelector('[data-stat="queued"]')
  const skippedEl = dashboardElement.querySelector('[data-stat="skipped"]')
  const failedEl = dashboardElement.querySelector('[data-stat="failed"]')
  const progressEl = dashboardElement.querySelector('.stashy-progress-fill') as HTMLElement
  const statusText = dashboardElement.querySelector('.stashy-status-text')
  const stopBtn = dashboardElement.querySelector('.stashy-stop-btn')
  const hintEl = dashboardElement.querySelector('.stashy-hint')

  if (savedEl) savedEl.textContent = String(state.saved)
  if (queuedEl) queuedEl.textContent = String(state.queued)
  if (skippedEl) skippedEl.textContent = String(state.skipped)
  if (failedEl) failedEl.textContent = String(state.failed)

  // Calculate progress (approximate based on activity)
  const total = state.saved + state.skipped + state.failed + state.queued
  const completed = state.saved + state.skipped + state.failed
  const progressPct = total > 0 ? Math.min((completed / total) * 100, 100) : 0
  if (progressEl) progressEl.style.width = `${progressPct}%`

  if (state.isComplete) {
    dashboardElement.classList.add("done")
    if (statusText) statusText.textContent = state.reason === "stopped"
      ? "Stopped — saved items are safe"
      : "Scroll paused — see results below"
    if (stopBtn) stopBtn.textContent = "✓ Close"
    if (hintEl) hintEl.textContent = "Continue from this position or close"
  }
}

function showDashboard(onStop: () => void, onContinue: () => void): void {
  createDashboard(onStop, onContinue)
}

function hideDashboard(): void {
  dashboardElement?.remove()
  dashboardElement = null
}

// ---------------------------------------------------------------------------
// Button creation & state management
// ---------------------------------------------------------------------------

const BUTTON_ATTR = "data-tweet-saver"
const PROCESSED_ATTR = "data-tweet-saver-processed"

type ButtonState = "default" | "saving" | "saved" | "error"

function setButtonState(btn: HTMLButtonElement, state: ButtonState): void {
  btn.className = "tweet-saver-btn"
  btn.setAttribute("data-state", state)

  switch (state) {
    case "default":
      btn.innerHTML = CLOUD_UPLOAD_OUTLINE
      btn.title = "Save to Supabase"
      break
    case "saving":
      btn.classList.add("saving")
      btn.innerHTML = CLOUD_UPLOAD_OUTLINE
      btn.title = "Saving..."
      break
    case "saved":
      btn.classList.add("saved")
      btn.innerHTML = CLOUD_UPLOAD_FILLED
      btn.title = "Saved to Supabase"
      break
    case "error":
      btn.classList.add("error")
      btn.innerHTML = CLOUD_UPLOAD_OUTLINE
      btn.title = "Save failed — click to retry"
      // Revert to default after animation
      setTimeout(() => {
        if (btn.getAttribute("data-state") === "error") {
          setButtonState(btn, "default")
        }
      }, 1500)
      break
  }
}

function createSaveButton(article: Element): HTMLButtonElement | null {
  const btn = document.createElement("button")
  btn.setAttribute(BUTTON_ATTR, "true")
  setButtonState(btn, "default")

  btn.addEventListener("click", async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (btn.getAttribute("data-state") === "saving") return

    setButtonState(btn, "saving")

    try {
      await expandLongPost(article)
      const tweetData = extractTweetData(article)
      if (!tweetData) {
        console.error("[TweetSaver] Could not extract tweet data")
        setButtonState(btn, "error")
        return
      }

      // Debug quote extraction: X frequently changes the quote DOM.
      const legacyQuote = article.querySelector('[data-testid="quoteTweet"]')
      const quoteLabelSpans = Array.from(article.querySelectorAll("span"))
        .filter((span) => span.textContent?.trim() === "Quote")

      const labelContainer = quoteLabelSpans[0]?.closest("div") ?? null
      const siblings = labelContainer?.parentElement ? Array.from(labelContainer.parentElement.children) : []
      const labelIndex = labelContainer && siblings.length > 0 ? siblings.indexOf(labelContainer) : -1
      const siblingAfterLabel = labelIndex >= 0 ? (siblings[labelIndex + 1] ?? null) : null

      const candidateQuoteContainers: Array<Element | null> = [
        legacyQuote,
        siblingAfterLabel,
        labelContainer?.nextElementSibling ?? null,
        // Fallback: sometimes the quote preview is nested within the same container as the label.
        labelContainer?.parentElement?.querySelector('div[role="link"]') ?? null
      ]

      const quoteContainer = candidateQuoteContainers.find((el) => el?.getAttribute("role") === "link") ?? legacyQuote
      const quoteStatusLinks = quoteContainer
        ? Array.from(quoteContainer.querySelectorAll('a[href*="/status/"]'))
            .map((a) => (a as HTMLAnchorElement).href)
            .filter(Boolean)
        : []

      const timeAnchorHrefs = Array.from(article.querySelectorAll("time"))
        .map((t) => t.closest("a")?.href)
        .filter((href): href is string => Boolean(href))

      const allStatusLinksInArticle = Array.from(article.querySelectorAll('a[href*="/status/"]'))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter(Boolean)

      const quoteDebug = {
        has_legacy_quote_testid: Boolean(legacyQuote),
        quote_label_count: quoteLabelSpans.length,
        quote_label_texts: Array.from(
          new Set(
            (labelContainer?.parentElement ?? labelContainer ?? article)
              ? Array.from((labelContainer?.parentElement ?? labelContainer ?? article).querySelectorAll("span"))
                  .map((s) => s.textContent?.trim() || "")
                  .filter((t) => t.length > 0 && t.length <= 40)
                  .slice(0, 10)
              : []
          )
        ).slice(0, 3),
        quote_container_found: Boolean(quoteContainer),
        quote_container_role: quoteContainer?.getAttribute("role") ?? null,
        quote_status_links: Array.from(new Set(quoteStatusLinks)).slice(0, 5),
        quote_html_snippet: quoteContainer ? quoteContainer.outerHTML.slice(0, 3000) : null
      }

      const articleSummary = {
        tweet_text_length: tweetData.tweet_text?.length ?? 0,
        media_count: tweetData.media?.length ?? 0,
        link_card_count: tweetData.link_cards?.length ?? 0,
        urls_count: tweetData.urls?.length ?? 0,
        time_anchor_hrefs: Array.from(new Set(timeAnchorHrefs)).slice(0, 5),
        status_links_in_article: Array.from(new Set(allStatusLinksInArticle)).slice(0, 5)
      }

      console.log("[TweetSaver] Extracted tweet data:", {
        tweet_id: tweetData.tweet_id,
        quoted_tweet_id: tweetData.quoted_tweet_id,
        has_quote: tweetData.quoted_tweet_id !== null,
        quoted_tweet: tweetData.quoted_tweet,
        in_reply_to_tweet_id: tweetData.in_reply_to_tweet_id,
        conversation_id: tweetData.conversation_id,
        source_url: tweetData.source_url,
        article_summary: articleSummary,
        quote_debug: quoteDebug
      })

      await saveTweet(tweetData)
      setButtonState(btn, "saved")
    } catch (err) {
      console.error("[TweetSaver] Save failed:", err)
      setButtonState(btn, "error")
    }
  })

  return btn
}

// ---------------------------------------------------------------------------
// Tweet ID extraction (lightweight, for batch checks)
// ---------------------------------------------------------------------------

function getTweetIdFromArticle(article: Element): string | null {
  const timeLinks = article.querySelectorAll("time")
  for (const time of timeLinks) {
    const anchor = time.closest("a")
    if (anchor) {
      const match = anchor.href.match(/\/status\/(\d+)/)
      if (match) return match[1]
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Injection logic
// ---------------------------------------------------------------------------

function processArticle(article: Element): void {
  if (article.hasAttribute(PROCESSED_ATTR)) return
  article.setAttribute(PROCESSED_ATTR, "true")

  // Find the action bar — the row with like/retweet/reply/share/views buttons
  // Twitter uses role="group" for the action bar
  const actionBar = article.querySelector('[role="group"]')
  if (!actionBar) return

  // Don't inject if already has our button
  if (actionBar.querySelector(`[${BUTTON_ATTR}]`)) return

  const btn = createSaveButton(article)
  if (!btn) return

  // Wrap in a container div matching Twitter's action button wrapper style
  const wrapper = document.createElement("div")
  wrapper.style.display = "inline-flex"
  wrapper.style.alignItems = "center"
  wrapper.appendChild(btn)

  actionBar.appendChild(wrapper)
}

function processAllArticles(): void {
  const articles = document.querySelectorAll("article")
  articles.forEach(processArticle)
}

// ---------------------------------------------------------------------------
// Batch check for already-saved tweets
// ---------------------------------------------------------------------------

async function batchCheckVisibleTweets(): Promise<void> {
  const articles = document.querySelectorAll("article")
  const idMap = new Map<string, Element>()

  articles.forEach((article) => {
    const tweetId = getTweetIdFromArticle(article)
    if (tweetId) idMap.set(tweetId, article)
  })

  if (idMap.size === 0) return

  try {
    const savedIds = await checkSavedTweets(Array.from(idMap.keys()))
    savedIds.forEach((id) => {
      const article = idMap.get(id)
      if (!article) return
      const btn = article.querySelector(`[${BUTTON_ATTR}]`) as HTMLButtonElement | null
      if (btn && btn.getAttribute("data-state") !== "saved") {
        setButtonState(btn, "saved")
      }
    })
  } catch (err) {
    console.error("[TweetSaver] Batch check failed:", err)
  }
}

// ---------------------------------------------------------------------------
// Bulk scroll-and-save — bookmarks page
// ---------------------------------------------------------------------------

const BULK_BTN_ID = "__tweet-saver-bulk"

/**
 * Whether the current page lists saved posts, which is where the bulk
 * scroll-and-save controls belong.
 *
 * X moved bookmarks from /i/bookmarks to /i/history (a combined page with
 * Bookmarks and Likes tabs) without keeping the old path, so a check for
 * /i/bookmarks alone silently stops matching and the bulk button disappears.
 * Both are accepted: the old path still redirects for some sessions.
 *
 * Takes pathname as a parameter so it is testable without stubbing location.
 */
export function isBookmarksPage(
  pathname: string = window.location.pathname
): boolean {
  return /\/i\/(bookmarks|history)/.test(pathname)
}

function removeBulkButton(): void {
  document.getElementById(BULK_BTN_ID)?.remove()
}

// ---------------------------------------------------------------------------
// Auto-scroll logic
// ---------------------------------------------------------------------------

let scrollAbortController: AbortController | null = null

/**
 * Auto-scrolls the page, saving tweets AS THEY APPEAR in the viewport.
 *
 * Twitter's virtual DOM only keeps ~20-30 tweets rendered at a time,
 * recycling older ones as you scroll. So we must extract and save each
 * tweet while it's still in the DOM, not after scrolling finishes.
 *
 * Returns stats about what was saved during the scroll.
 */
interface ScrollSaveStats {
  saved: number
  skipped: number
  failed: number
  reason: "stopped" | "idle" | "reset"
}

interface ScrollSaveCallbacks {
  onUpdate?: (stats: ScrollSaveStats & { queued: number }) => void
  onComplete?: (stats: ScrollSaveStats) => void
}

export async function autoScrollAndSave(
  btn: HTMLButtonElement,
  signal: AbortSignal,
  callbacks: ScrollSaveCallbacks = {},
  mode: "save" | "backfill" = "save",
  idleMs = 20000,
  scrollStep = 1200,
  scrollInterval = 600
): Promise<ScrollSaveStats> {
  const stats: ScrollSaveStats = { saved: 0, skipped: 0, failed: 0, reason: "idle" }
  const seenIds = new Set<string>()
  const saveQueue: { tweetData: NonNullable<ReturnType<typeof extractTweetData>>, article: Element }[] = []
  const requiredTags = folderTagsFrom(window.location.pathname)
  let worker: Promise<void> | null = null
  let idleStart = Date.now()
  let lastScrollY = window.scrollY
  let resetCount = 0
  let consecutiveSkips = 0

  function notifyUpdate() {
    callbacks.onUpdate?.({ ...stats, queued: saveQueue.length })
  }

  async function extractVisibleArticles() {
    const candidates = Array.from(document.querySelectorAll("article"))
      .map((article) => ({ article, id: getTweetIdFromArticle(article) }))
      .filter((item): item is { article: HTMLElement; id: string } => Boolean(item.id) && !seenIds.has(item.id!))
    if (candidates.length === 0) return

    // Query once per viewport. This makes repeat runs skip saved rows without
    // discarding missing metrics or a folder tag that still needs writing.
    let completed = new Set<string>()
    if (mode === "save") {
      try {
        completed = await checkCompletedTweets(candidates.map((item) => item.id), requiredTags)
      } catch (err) {
        console.warn("[TweetSaver] Could not check existing saves; retrying them", err)
      }
    }

    for (const { article, id } of candidates) {
      if (signal.aborted) break
      if (seenIds.has(id)) continue
      seenIds.add(id)
      idleStart = Date.now()
      if (completed.has(id)) {
        stats.skipped++
        consecutiveSkips++
        notifyUpdate()
        continue
      }

      if (mode === "save") await expandLongPost(article)
      const tweetData = extractTweetData(article)
      if (!tweetData) {
        stats.skipped++
        notifyUpdate()
        continue
      }
      saveQueue.push({ tweetData, article })
      notifyUpdate()
    }
  }

  function processSaveQueue(): Promise<void> {
    if (worker) return worker
    worker = (async () => {
      while (saveQueue.length && !signal.aborted) {
        const item = saveQueue.shift()!
        try {
          if (mode === "backfill") {
            const result = await backfillMetricsForTweet(item.tweetData.tweet_id, item.tweetData.public_metrics)
            if (result === "updated") {
              stats.saved++
              consecutiveSkips = 0
            } else {
              stats.skipped++
              consecutiveSkips++
            }
          } else {
            await saveTweet(item.tweetData)
            stats.saved++
            consecutiveSkips = 0
            const perBtn = item.article.querySelector?.(`[${BUTTON_ATTR}]`) as HTMLButtonElement | null
            if (perBtn) setButtonState(perBtn, "saved")
          }
        } catch (err) {
          stats.failed++
          consecutiveSkips = 0
          console.error("[TweetSaver] Scroll-save error:", err)
        }
        notifyUpdate()
      }
    })().finally(() => { worker = null })
    return worker
  }

  function waitForNextScroll(): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer)
        signal.removeEventListener("abort", done)
        resolve()
      }
      const timer = setTimeout(done, consecutiveSkips >= 15 ? 250 : scrollInterval)
      signal.addEventListener("abort", done, { once: true })
    })
  }

  while (!signal.aborted) {
    await extractVisibleArticles()
    void processSaveQueue()
    if (signal.aborted) break

    btn.textContent = `${consecutiveSkips >= 15 ? "⏩ Skipping saved" : "⏹ Stop"} (${stats.saved} saved, ${saveQueue.length} queued)`
    // Keep the same step size during fast-forward. Jumping five viewports can
    // miss tweets because X recycles offscreen articles.
    window.scrollBy({ top: scrollStep, behavior: "auto" })
    await waitForNextScroll()
    if (signal.aborted) break

    const currentScrollY = window.scrollY
    if (currentScrollY < lastScrollY && currentScrollY < 500) {
      resetCount++
      if (resetCount >= 3) {
        stats.reason = "reset"
        break
      }
      window.scrollTo({ top: lastScrollY + scrollStep, behavior: "auto" })
    } else {
      resetCount = 0
      lastScrollY = Math.max(lastScrollY, currentScrollY)
    }

    if (Date.now() - idleStart >= idleMs) {
      stats.reason = "idle"
      break
    }
  }

  if (!signal.aborted) {
    await extractVisibleArticles()
    while (!signal.aborted && (saveQueue.length || worker)) await processSaveQueue()
  }
  if (signal.aborted) {
    stats.reason = "stopped"
    if (worker) await worker
    saveQueue.length = 0
  }
  callbacks.onComplete?.(stats)
  return stats
}

// ---------------------------------------------------------------------------
// Inject the bulk Scroll & Save All button
// ---------------------------------------------------------------------------

function injectBulkButton(): void {
  if (document.getElementById(BULK_BTN_ID)) return
  if (!isBookmarksPage()) return

  const container = document.createElement("div")
  container.id = BULK_BTN_ID
  container.className = "tweet-saver-bulk-container"

  const saveVisibleBtn = document.createElement("button")
  saveVisibleBtn.className = "tweet-saver-bulk-btn"
  saveVisibleBtn.textContent = "Save Visible"
  saveVisibleBtn.title = "Save the bookmarks currently loaded on this page"

  saveVisibleBtn.addEventListener("click", async () => {
    if (scrollAbortController || saveVisibleBtn.disabled) return
    saveVisibleBtn.disabled = true
    const articles = Array.from(document.querySelectorAll("article"))
    const ids = articles.map(getTweetIdFromArticle).filter((id): id is string => Boolean(id))
    let completed = new Set<string>()
    try {
      completed = await checkCompletedTweets(ids, folderTagsFrom(window.location.pathname))
    } catch (err) {
      console.warn("[TweetSaver] Could not check existing saves; retrying them", err)
    }
    let saved = 0
    let failed = 0
    for (const article of articles) {
      const id = getTweetIdFromArticle(article)
      if (!id || completed.has(id)) continue
      try {
        await expandLongPost(article)
        const tweetData = extractTweetData(article)
        if (!tweetData) continue
        await saveTweet(tweetData)
        saved++
      } catch (err) {
        failed++
        console.error("[TweetSaver] Save visible error:", err)
      }
      saveVisibleBtn.textContent = `${saved} saved, ${failed} failed`
    }
    saveVisibleBtn.textContent = `✓ ${saved} saved, ${failed} failed`
    setTimeout(() => {
      saveVisibleBtn.disabled = false
      saveVisibleBtn.textContent = "Save Visible"
    }, 5000)
  })

  // --- "Scroll & Save All" button ---
  const scrollSaveBtn = document.createElement("button")
  scrollSaveBtn.className = "tweet-saver-bulk-btn"
  scrollSaveBtn.textContent = "Scroll & Save All"
  scrollSaveBtn.title = "Auto-scroll to load all tweets, then save everything"

  const backfillBtn = document.createElement("button")
  backfillBtn.className = "tweet-saver-bulk-btn"
  backfillBtn.textContent = "Scroll & Backfill Metrics"
  backfillBtn.title = "Fill engagement counts on already saved tweets without adding new tweets"

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && scrollAbortController) {
      scrollAbortController.abort()
      // Dashboard will show completion state, don't hide immediately
    }
  }

  async function runScrollPass(mode: "save" | "backfill", fromTop: boolean) {
    if (scrollAbortController) return
    if (fromTop) window.scrollTo({ top: 0, behavior: "auto" })
    scrollAbortController = new AbortController()
    const { signal } = scrollAbortController
    const activeBtn = mode === "save" ? scrollSaveBtn : backfillBtn
    saveVisibleBtn.disabled = true
    if (mode === "save") backfillBtn.disabled = true
    else scrollSaveBtn.disabled = true

    showDashboard(
      () => scrollAbortController?.abort(),
      () => { void runScrollPass(mode, false) }
    )

    activeBtn.classList.add("scrolling")
    const articleCount = document.querySelectorAll("article").length
    activeBtn.textContent = `⏹ Stop (${articleCount} tweets)`

    // Listen for Escape key
    document.addEventListener("keydown", handleEscape)

    // Auto-scroll AND save as we go (Twitter recycles DOM elements)
    const stats = await autoScrollAndSave(activeBtn, signal, {
      onUpdate: (state) => {
        updateDashboard({
          saved: state.saved,
          skipped: state.skipped,
          failed: state.failed,
          queued: state.queued,
          isComplete: false
        })
      },
      onComplete: (finalStats) => {
        updateDashboard({
          saved: finalStats.saved,
          skipped: finalStats.skipped,
          failed: finalStats.failed,
          queued: 0,
          isComplete: true,
          reason: finalStats.reason
        })
      }
    }, mode)

    // Cleanup scroll state
    document.removeEventListener("keydown", handleEscape)
    scrollAbortController = null
    activeBtn.classList.remove("scrolling")
    saveVisibleBtn.disabled = false
    scrollSaveBtn.disabled = false
    backfillBtn.disabled = false

    // Show results
    const parts = [`✓ ${stats.saved} ${mode === "save" ? "saved" : "backfilled"}`]
    if (stats.skipped) parts.push(`${stats.skipped} skipped`)
    if (stats.failed) parts.push(`${stats.failed} failed`)
    activeBtn.textContent = parts.join(", ")

    console.log(`[TweetSaver] Scroll & Save complete:`, stats)

    // Reset button text after a few seconds
    setTimeout(() => {
      activeBtn.textContent = mode === "save" ? "Scroll & Save All" : "Scroll & Backfill Metrics"
    }, 5000)
  }

  scrollSaveBtn.addEventListener("click", () => {
    if (scrollAbortController) scrollAbortController.abort()
    else void runScrollPass("save", false)
  })

  backfillBtn.addEventListener("click", () => {
    if (scrollAbortController) scrollAbortController.abort()
    else void runScrollPass("backfill", true)
  })

  container.appendChild(saveVisibleBtn)
  container.appendChild(scrollSaveBtn)
  container.appendChild(backfillBtn)

  const currentFolderTags = folderTagsFrom(window.location.pathname)
  if (currentFolderTags.length) {
    const tagBtn = document.createElement("button")
    tagBtn.className = "tweet-saver-bulk-btn"
    tagBtn.textContent = "Tag Existing Saves"
    tagBtn.title = "Add this folder to already saved bookmarks currently visible"
    tagBtn.addEventListener("click", async () => {
      if (tagBtn.disabled || scrollAbortController) return
      tagBtn.disabled = true
      try {
        const ids = Array.from(document.querySelectorAll("article"))
          .map(getTweetIdFromArticle)
          .filter((id): id is string => Boolean(id))
        const tagged = await tagExistingTweets(ids, currentFolderTags)
        tagBtn.textContent = `✓ Tagged ${tagged}`
      } catch (err) {
        console.error("[TweetSaver] Folder tagging error:", err)
        tagBtn.textContent = "Tagging failed"
      }
      setTimeout(() => {
        tagBtn.disabled = false
        tagBtn.textContent = "Tag Existing Saves"
      }, 5000)
    })
    container.appendChild(tagBtn)
  }

  // Insert after the primary column header (h2 area)
  const header = document.querySelector(
    '[data-testid="primaryColumn"] > div > div:first-child'
  )
  if (header && header.parentElement) {
    header.parentElement.insertBefore(container, header.nextSibling)
  } else {
    const primary = document.querySelector('[data-testid="primaryColumn"]')
    if (primary) {
      primary.insertBefore(container, primary.firstChild)
    }
  }
  container.style.top = `${header instanceof HTMLElement ? header.getBoundingClientRect().height : 53}px`
}

// ---------------------------------------------------------------------------
// SPA-aware URL watcher for bookmarks page
// ---------------------------------------------------------------------------

let lastUrl = ""

function onUrlChange(): void {
  const currentUrl = window.location.href
  if (currentUrl === lastUrl) return
  lastUrl = currentUrl

  scrollAbortController?.abort()
  removeBulkButton()
  if (isBookmarksPage()) {
    // Slight delay to let Twitter render the header
    setTimeout(injectBulkButton, 800)
  }
}

function startUrlWatcher(): void {
  lastUrl = window.location.href

  // Intercept History API for SPA navigation
  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  history.pushState = function (...args) {
    originalPushState(...args)
    onUrlChange()
  }
  history.replaceState = function (...args) {
    originalReplaceState(...args)
    onUrlChange()
  }

  window.addEventListener("popstate", onUrlChange)

  // Also poll as a safety net (Twitter sometimes navigates without pushState)
  setInterval(onUrlChange, 1500)
}

// ---------------------------------------------------------------------------
// MutationObserver for new tweets
// ---------------------------------------------------------------------------

let batchCheckTimer: ReturnType<typeof setTimeout> | null = null

function scheduleBatchCheck(): void {
  if (batchCheckTimer) clearTimeout(batchCheckTimer)
  batchCheckTimer = setTimeout(() => {
    batchCheckVisibleTweets()
  }, 1000)
}

function startObserver(): void {
  const observer = new MutationObserver((mutations) => {
    let hasNewArticles = false

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue

        // Check if the added node is an article or contains articles
        if (node.tagName === "ARTICLE") {
          processArticle(node)
          hasNewArticles = true
        } else {
          const articles = node.querySelectorAll?.("article")
          if (articles?.length) {
            articles.forEach(processArticle)
            hasNewArticles = true
          }
        }
      }
    }

    if (hasNewArticles) {
      scheduleBatchCheck()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init(): void {
  if (!ENABLE_TWEET_BOOKMARK) {
    console.log("[TweetSaver] Disabled in production build")
    return
  }

  console.log("[TweetSaver] Initializing tweet save buttons")
  injectStyles()
  processAllArticles()
  startObserver()
  startUrlWatcher()

  // Initial bookmarks check
  if (isBookmarksPage()) {
    setTimeout(injectBulkButton, 1000)
  }

  // Initial batch check after a short delay to let buttons render
  setTimeout(batchCheckVisibleTweets, 2000)

  // Periodic check for tweets that may have been loaded via infinite scroll
  setInterval(() => {
    processAllArticles()
    scheduleBatchCheck()
  }, 5000)
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
