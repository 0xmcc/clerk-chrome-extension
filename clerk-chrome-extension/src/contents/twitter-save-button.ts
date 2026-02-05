/**
 * Plasmo content script: injects a "Save" button into Twitter/X tweet action rows,
 * and a bulk "Save All ↑" button on bookmarks pages.
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

    /* Bulk Save All button */
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
    .tweet-saver-bulk-container {
      display: flex;
      justify-content: center;
      padding: 12px 16px;
      border-bottom: 1px solid rgb(47, 51, 54);
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
// Bulk Save All — bookmarks page
// ---------------------------------------------------------------------------

const BULK_BTN_ID = "__tweet-saver-bulk"

function isBookmarksPage(): boolean {
  return /\/i\/bookmarks/.test(window.location.pathname)
}

function removeBulkButton(): void {
  document.getElementById(BULK_BTN_ID)?.remove()
}

function injectBulkButton(): void {
  if (document.getElementById(BULK_BTN_ID)) return
  if (!isBookmarksPage()) return

  const container = document.createElement("div")
  container.id = BULK_BTN_ID
  container.className = "tweet-saver-bulk-container"

  const btn = document.createElement("button")
  btn.className = "tweet-saver-bulk-btn"
  btn.textContent = "Save All ↑"
  btn.title = "Save all visible tweets to Supabase"

  btn.addEventListener("click", async () => {
    if (btn.disabled) return
    btn.disabled = true

    const articles = Array.from(document.querySelectorAll("article"))
    const total = articles.length
    let saved = 0
    let skipped = 0
    let failed = 0

    btn.textContent = `0/${total}…`

    for (const article of articles) {
      // Skip already-saved tweets
      const existingBtn = article.querySelector(`[${BUTTON_ATTR}]`) as HTMLButtonElement | null
      if (existingBtn?.getAttribute("data-state") === "saved") {
        skipped++
        btn.textContent = `${saved + skipped + failed}/${total}…`
        continue
      }

      try {
        const tweetData = extractTweetData(article)
        if (!tweetData) {
          skipped++
          btn.textContent = `${saved + skipped + failed}/${total}…`
          continue
        }

        // Mark per-tweet button as saving
        if (existingBtn) setButtonState(existingBtn, "saving")

        await saveTweet(tweetData)
        saved++

        // Mark per-tweet button as saved
        if (existingBtn) setButtonState(existingBtn, "saved")
      } catch (err) {
        console.error("[TweetSaver] Bulk save error for article:", err)
        failed++
        if (existingBtn) setButtonState(existingBtn, "error")
      }

      btn.textContent = `${saved + skipped + failed}/${total}…`
    }

    // Show summary
    btn.textContent = `✓ ${saved} saved, ${skipped} skipped, ${failed} failed`
    btn.classList.add("done")

    // Re-enable after a delay so user can trigger again if they scrolled
    setTimeout(() => {
      btn.disabled = false
      btn.classList.remove("done")
      btn.textContent = "Save All ↑"
    }, 5000)
  })

  container.appendChild(btn)

  // Insert after the primary column header (h2 area)
  const header = document.querySelector(
    '[data-testid="primaryColumn"] > div > div:first-child'
  )
  if (header && header.parentElement) {
    header.parentElement.insertBefore(container, header.nextSibling)
  } else {
    // Fallback: prepend to primary column
    const primary = document.querySelector('[data-testid="primaryColumn"]')
    if (primary) {
      primary.insertBefore(container, primary.firstChild)
    }
  }
}

// ---------------------------------------------------------------------------
// SPA-aware URL watcher for bookmarks page
// ---------------------------------------------------------------------------

let lastUrl = ""

function onUrlChange(): void {
  const currentUrl = window.location.href
  if (currentUrl === lastUrl) return
  lastUrl = currentUrl

  if (isBookmarksPage()) {
    // Slight delay to let Twitter render the header
    setTimeout(injectBulkButton, 800)
  } else {
    removeBulkButton()
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
