/**
 * Clerk authentication utilities for Chrome extension.
 */

/**
 * Request a Clerk session token from the background script.
 * Sends a message to the background script which handles Clerk auth.
 *
 * @returns Promise resolving to the Clerk session token
 * @throws Error if Chrome runtime is unavailable, or if token retrieval fails
 */
export const requestClerkToken = async (): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error("Chrome runtime unavailable in this context"))
      return
    }

    chrome.runtime.sendMessage({ action: "getClerkToken" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      if (!response?.success || !response?.token) {
        reject(new Error(response?.error || "Missing Clerk session. Please sign in from the extension popup."))
        return
      }

      resolve(response.token as string)
    })
  })
}
