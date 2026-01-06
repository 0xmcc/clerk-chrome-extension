/**
 * Navigation utilities for Chrome extension.
 */

/**
 * Open the extension's options/sign-in page.
 * Sends a message to the background script to open the options page.
 */
export const openSignInPage = (): void => {
  chrome.runtime.sendMessage({ action: "openAuthTab" })
}
