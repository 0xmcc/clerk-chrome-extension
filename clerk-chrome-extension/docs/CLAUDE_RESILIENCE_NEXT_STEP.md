# Claude Resilience Next Step

## Goal

Reduce future breakage when Claude changes its internal API paths or response shape.

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
