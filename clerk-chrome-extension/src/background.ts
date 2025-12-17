import { createClerkClient } from "@clerk/chrome-extension/background"

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST

if (!publishableKey) {
  throw new Error("Please add PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file")
}

if (!syncHost) {
  throw new Error("Please add PLASMO_PUBLIC_CLERK_SYNC_HOST to your .env file")
}

let clerkClientPromise: ReturnType<typeof createClerkClient> | null = null
const CLERK_STORAGE_KEY_FRAGMENT = "__clerk_client_jwt"
let refreshPromise: Promise<void> | null = null

const getClerkClient = async () => {
  if (!clerkClientPromise) {
    clerkClientPromise = createClerkClient({
      publishableKey,
      syncHost
    })
  }

  return clerkClientPromise
}

const refreshClerkClient = async (reason: string) => {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const clerkClient = await getClerkClient()
      await clerkClient.load({ standardBrowser: false })
      console.log("[Background] Clerk refreshed", { reason, hasSession: !!clerkClient.session })
    } catch (error) {
      console.error("[Background] Failed to refresh Clerk:", error)
    }
  })()

  try {
    await refreshPromise
  } finally {
    refreshPromise = null
  }
}

async function initializeClerk() {
  try {
    const clerkClient = await getClerkClient()

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

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== "local") return
  const updatedKeys = Object.keys(changes)
  if (!updatedKeys.some((key) => key.includes(CLERK_STORAGE_KEY_FRAGMENT))) {
    return
  }

  void refreshClerkClient("storage-change")
})

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage()
    sendResponse({ success: true })
    return true
  }

  if (message.action === "getClerkToken") {
    getClerkClient()
      .then(async (clerkClient) => {
        if (!clerkClient.session) {
          await refreshClerkClient("token-request")
        }
        const token = await clerkClient.session?.getToken()
        sendResponse({
          success: !!token,
          token: token || null
        })
      })
      .catch((error) => {
        console.error("[Background] Failed to fetch Clerk token:", error)
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown Clerk error"
        })
      })

    return true
  }

  return true
})
