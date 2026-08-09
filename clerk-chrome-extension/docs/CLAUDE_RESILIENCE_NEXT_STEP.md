# Claude Resilience Next Step

## Goal

Reduce future breakage when Claude changes its internal API paths or response shape.

## Implemented: Conversation Collection Loading

The conversation collection now loads proactively on Claude, matching the
existing ChatGPT behavior. Once intercepted Claude traffic reveals an
organization id, the extension requests the paginated `chat_conversations`
index, adds lightweight conversation metadata to the shared collection, and
falls back to the legacy `conversations` endpoint if needed.

The loader requests up to 100 conversations per page, respects an API-provided
`total` or `total_count`, and stops safely if the API returns duplicate or empty
pages. Selecting a row still uses the existing detail-rescan path to retrieve
its transcript only when needed.

## Next Implementation

Implement runtime learning for Claude conversation detail requests.

- Observe real Claude detail requests that successfully produce conversation messages.
- Cache the last known good detail URL pattern and org metadata from intercepted traffic.
- Make `rescan.ts` prefer that learned detail URL over hardcoded templates.
- Fall back to the current hardcoded Claude URL builder only when no learned pattern exists.

## Why This Is Next

Claude has already changed:

- detail endpoints
- org discovery behavior
- message payload structure

The extension is more stable now, but rescan still depends partly on known endpoint templates. Learning from live traffic is the best next step to make future Claude changes less disruptive.

## Follow-Up After This

Add a real Claude smoke test that:

- opens a seeded Claude conversation
- opens the extension drawer
- asserts that detected message count is greater than zero

## Acceptance Criteria

- Claude rescan succeeds when the app uses a previously unseen but structurally similar detail URL.
- A successful intercepted Claude detail response updates the learned rescan target automatically.
- Existing Claude tests still pass.
- The new behavior is covered by unit tests, and the smoke test plan is documented or implemented.
