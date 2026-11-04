import { ASSESSMENT_ACTION, fetchAssessments } from "./bookmark-assessment"

export function registerAssessmentListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action !== ASSESSMENT_ACTION) return undefined
    fetchAssessments(Array.isArray(message.ids) ? message.ids : []).then(sendResponse)
    return true
  })
}
