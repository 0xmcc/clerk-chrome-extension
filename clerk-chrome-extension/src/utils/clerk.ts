/**
 * Clerk authentication utilities for Chrome extension.
 */

import { debug } from "./debug"

/**
 * Request a Clerk session token from the background script.
 * Sends a message to the background script which handles Clerk auth.
 *
 * @returns Promise resolving to the Clerk session token
 * @throws Error if Chrome runtime is unavailable, or if token retrieval fails
 */
export const requestClerkToken = async (): Promise<string> => {
  debug.any(["auth", "clerk", "token"], "Requesting Clerk token")
  return new Promise<string>((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      debug.any(["auth", "clerk", "token"], "Chrome runtime unavailable")
      reject(new Error("Chrome runtime unavailable in this context"))
      return
    }

    chrome.runtime.sendMessage({ action: "getClerkToken" }, (response) => {
      if (chrome.runtime.lastError) {
        debug.any(["auth", "clerk", "token"], "Clerk token request failed", chrome.runtime.lastError.message)
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      if (!response?.success || !response?.token) {
        debug.any(["auth", "clerk", "token"], "Clerk token request failed", response?.error)
        reject(new Error(response?.error || "Missing Clerk session. Please sign in from the extension popup."))
        return
      }

      debug.any(["auth", "clerk", "token"], "Clerk token received")
      resolve(response.token as string)
    })
  })
}

/**
 * Request Clerk sign out via the background script.
 *
 * @returns Promise resolving to success/error result
 */
export const requestClerkSignOut = async (): Promise<{ success: boolean; error?: string }> => {
  debug.any(["auth", "clerk"], "Requesting Clerk sign out")
  return new Promise((resolve) => {
    if (!chrome?.runtime?.sendMessage) {
      debug.any(["auth", "clerk"], "Chrome runtime unavailable")
      resolve({ success: false, error: "Chrome runtime unavailable" })
      return
    }

    chrome.runtime.sendMessage({ action: "clerkSignOut" }, (response) => {
      if (chrome.runtime.lastError) {
        debug.any(["auth", "clerk"], "Sign out failed", chrome.runtime.lastError.message)
        resolve({ success: false, error: chrome.runtime.lastError.message })
        return
      }

      const result = {
        success: response?.success ?? false,
        error: response?.error
      }
      debug.any(["auth", "clerk"], "Sign out result", result)
      resolve(result)
    })
  })
}

/**
 * Request a Clerk auth refresh from the background script.
 * Forces Clerk client to reload and returns current session status.
 *
 * @returns Promise resolving to { success, hasSession, error? }
 */
export const requestClerkAuthRefresh = async (): Promise<{ success: boolean; hasSession: boolean; error?: string }> => {
  debug.any(["auth", "clerk"], "Requesting Clerk auth refresh")
  return new Promise((resolve) => {
    if (!chrome?.runtime?.sendMessage) {
      debug.any(["auth", "clerk"], "Chrome runtime unavailable")
      resolve({ success: false, hasSession: false, error: "Chrome runtime unavailable" })
      return
    }

    chrome.runtime.sendMessage({ action: "refreshClerkAuth" }, (response) => {
      if (chrome.runtime.lastError) {
        debug.any(["auth", "clerk"], "Auth refresh failed", chrome.runtime.lastError.message)
        resolve({ success: false, hasSession: false, error: chrome.runtime.lastError.message })
        return
      }

      const result = {
        success: response?.success ?? false,
        hasSession: response?.hasSession ?? false,
        error: response?.error
      }
      debug.any(["auth", "clerk"], "Auth refresh result", result)
      resolve(result)
    })
  })
}
