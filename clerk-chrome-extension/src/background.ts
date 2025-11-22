import { createClerkClient } from "@clerk/chrome-extension/background"

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST

if (!publishableKey) {
  throw new Error("Please add PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file")
}

if (!syncHost) {
  throw new Error("Please add PLASMO_PUBLIC_CLERK_SYNC_HOST to your .env file")
}

async function initializeClerk() {
  try {
    const clerkClient = await createClerkClient({
      publishableKey,
      syncHost
    })

    console.log("[Background] Clerk initialized", {
      isSignedIn: !!clerkClient.session,
      sessionId: clerkClient.session?.id,
      timestamp: new Date().toISOString()
    })

    // Session will automatically refresh every 60 seconds
    // while this background worker is running
  } catch (error) {
    console.error("[Background] Failed to initialize Clerk:", error)
  }
}

initializeClerk()

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage()
    sendResponse({ success: true })
  }
  return true
})
