/**
 * Plasmo content script: injects a "Save" button into Twitter/X tweet action rows.
 *
 * Uses vanilla DOM manipulation (not React/TSX) since we're injecting directly
 * into Twitter's DOM rather than rendering a shadow DOM overlay.
 */

import type { PlasmoCSConfig } from "plasmo"
import { extractTweetData } from "~lib/tweet-extractor"
import { saveTweet, checkSavedTweets } from "~lib/tweet-saver"

// ---------------------------------------------------------------------------
// Plasmo config
// ---------------------------------------------------------------------------

export const config: PlasmoCSConfig = {
  matches: ["https://x.com/*", "https://twitter.com/*"],
  run_at: "document_idle"
}

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------

// Cloud-upload icon (distinct from Twitter's native bookmark icon)
const SAVE_OUTLINE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V8m0 0l-3 3m3-3l3 3"/><path d="M20 16.7A4.5 4.5 0 0 0 17.5 8h-1.13A7 7 0 1 0 4 14.5"/></svg>`

const SAVE_FILLED = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V8m0 0l-3 3m3-3l3 3"/><path d="M20 16.7A4.5 4.5 0 0 0 17.5 8h-1.13A7 7 0 1 0 4 14.5"/></svg>`

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
  `
  document.head.appendChild(style)
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
      btn.innerHTML = SAVE_OUTLINE
      btn.title = "Save to Supabase"
      break
    case "saving":
      btn.classList.add("saving")
      btn.innerHTML = SAVE_OUTLINE
      btn.title = "Saving..."
      break
    case "saved":
      btn.classList.add("saved")
      btn.innerHTML = SAVE_FILLED
      btn.title = "Saved to Supabase"
      break
    case "error":
      btn.classList.add("error")
      btn.innerHTML = SAVE_OUTLINE
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
      const tweetData = extractTweetData(article)
      if (!tweetData) {
        console.error("[TweetSaver] Could not extract tweet data")
        setButtonState(btn, "error")
        return
      }

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
  console.log("[TweetSaver] Initializing tweet save buttons")
  injectStyles()
  processAllArticles()
  startObserver()

  // Initial batch check after a short delay to let buttons render
  setTimeout(batchCheckVisibleTweets, 2000)

  // Periodic check for tweets that may have been loaded via infinite scroll
  setInterval(() => {
    processAllArticles()
    scheduleBatchCheck()
  }, 5000)
}

// ---------------------------------------------------------------------------
// Bulk Save button for Bookmarks pages
// ---------------------------------------------------------------------------

const BULK_BTN_ID = "__tweet-saver-bulk-btn"
const BULK_PROGRESS_ID = "__tweet-saver-bulk-progress"

function injectBulkStyles(): void {
  const id = "__tweet-saver-bulk-styles"
  if (document.getElementById(id)) return

  const style = document.createElement("style")
  style.id = id
  style.textContent = `
    .tweet-saver-bulk-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid rgba(29, 155, 240, 0.4);
      border-radius: 9999px;
      background: transparent;
      color: rgb(29, 155, 240);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 0.2s, border-color 0.2s;
      white-space: nowrap;
    }
    .tweet-saver-bulk-btn:hover {
      background-color: rgba(29, 155, 240, 0.1);
      border-color: rgb(29, 155, 240);
    }
    .tweet-saver-bulk-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .tweet-saver-bulk-btn.running {
      border-color: rgba(29, 155, 240, 0.6);
      background-color: rgba(29, 155, 240, 0.05);
    }
    .tweet-saver-bulk-progress {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: rgb(113, 118, 123);
      margin-left: 8px;
    }
  `
  document.head.appendChild(style)
}

function isBookmarksPage(): boolean {
  return /\/(i\/bookmarks|[A-Za-z0-9_]+\/bookmarks)/.test(window.location.pathname)
}

function getAllVisibleArticles(): Element[] {
  return Array.from(document.querySelectorAll("article"))
}

async function bulkSaveAllVisible(btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true
  btn.classList.add("running")

  let progressEl = document.getElementById(BULK_PROGRESS_ID)
  if (!progressEl) {
    progressEl = document.createElement("span")
    progressEl.id = BULK_PROGRESS_ID
    progressEl.className = "tweet-saver-bulk-progress"
    btn.parentElement?.appendChild(progressEl)
  }

  const articles = getAllVisibleArticles()
  const total = articles.length
  let saved = 0
  let skipped = 0
  let failed = 0

  progressEl.textContent = `0/${total}…`

  for (const article of articles) {
    try {
      const tweetData = extractTweetData(article)
      if (!tweetData) {
        skipped++
        continue
      }

      await saveTweet(tweetData)
      saved++

      // Update per-tweet button state if it exists
      const perBtn = article.querySelector(`[${BUTTON_ATTR}]`) as HTMLButtonElement | null
      if (perBtn) setButtonState(perBtn, "saved")
    } catch (err) {
      failed++
      console.error("[TweetSaver] Bulk save error:", err)
    }

    progressEl.textContent = `${saved + skipped + failed}/${total}…`
  }

  progressEl.textContent = `✓ ${saved} saved` + (skipped ? `, ${skipped} skipped` : "") + (failed ? `, ${failed} failed` : "")
  btn.textContent = "Save All ↑"
  btn.disabled = false
  btn.classList.remove("running")

  // Clear progress after a few seconds
  setTimeout(() => {
    if (progressEl) progressEl.textContent = ""
  }, 5000)
}

function injectBulkSaveButton(): void {
  if (!isBookmarksPage()) return
  if (document.getElementById(BULK_BTN_ID)) return

  injectBulkStyles()

  // Find the bookmarks header area — Twitter uses h2 for page titles
  // We'll inject right after the header or at the top of the timeline
  const header = document.querySelector('[data-testid="primaryColumn"] h2')
    || document.querySelector('[data-testid="primaryColumn"] [role="heading"]')

  if (!header) {
    // Retry — page might still be loading
    setTimeout(injectBulkSaveButton, 1000)
    return
  }

  const headerContainer = header.closest('[data-testid="cellInnerDiv"]')
    || header.parentElement?.parentElement

  if (!headerContainer) return

  const wrapper = document.createElement("div")
  wrapper.style.display = "flex"
  wrapper.style.alignItems = "center"
  wrapper.style.padding = "8px 16px"
  wrapper.style.borderBottom = "1px solid rgb(47, 51, 54)"

  const btn = document.createElement("button")
  btn.id = BULK_BTN_ID
  btn.className = "tweet-saver-bulk-btn"
  btn.textContent = "Save All ↑"
  btn.title = "Save all visible tweets to Supabase"
  btn.addEventListener("click", () => bulkSaveAllVisible(btn))

  wrapper.appendChild(btn)

  // Insert after the header
  if (headerContainer.nextSibling) {
    headerContainer.parentNode?.insertBefore(wrapper, headerContainer.nextSibling)
  } else {
    headerContainer.parentNode?.appendChild(wrapper)
  }
}

function removeBulkSaveButton(): void {
  const btn = document.getElementById(BULK_BTN_ID)
  if (btn) btn.closest("div")?.remove()
  const progress = document.getElementById(BULK_PROGRESS_ID)
  if (progress) progress.remove()
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init(): void {
  console.log("[TweetSaver] Initializing tweet save buttons")
  injectStyles()
  processAllArticles()
  startObserver()

  // Bookmarks bulk save button
  if (isBookmarksPage()) {
    injectBulkSaveButton()
  }

  // Initial batch check after a short delay to let buttons render
  setTimeout(batchCheckVisibleTweets, 2000)

  // Periodic check for tweets that may have been loaded via infinite scroll
  setInterval(() => {
    processAllArticles()
    scheduleBatchCheck()
  }, 5000)

  // Watch for SPA navigation (bookmarks page entry/exit)
  let lastPath = window.location.pathname
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname
      if (isBookmarksPage()) {
        setTimeout(injectBulkSaveButton, 500)
      } else {
        removeBulkSaveButton()
      }
    }
  }, 1000)
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
