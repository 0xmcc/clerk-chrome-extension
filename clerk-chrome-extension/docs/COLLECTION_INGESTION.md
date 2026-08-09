# Conversation Collection Ingestion

The collection must populate independently of when the exporter panel is opened.
ChatGPT request/response events are captured by the main-world interceptor at
`document_start`, queued until the content-script listener is ready, and then
merged into the conversation store.

The proactive ChatGPT index loader may be triggered before an authorization
token is available during page startup. That attempt must remain retryable; it
does not count as the loader's one successful trigger. Any later intercepted
ChatGPT request that exposes an authorization header caches the token and
triggers the index loader, including a conversation-detail request. The
content-script bridge must preserve request headers when converting the queued
window payload into an interceptor event.

This prevents the active conversation from becoming a permanent one-row
collection when the extension is opened before ChatGPT finishes loading.
