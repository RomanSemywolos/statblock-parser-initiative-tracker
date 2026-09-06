# Patch 2.74.218 — persistence validation and diagnostic boundary cleanup

This release resolves the seven smaller issues recorded after the 2.74.217 audit.

## Parser diagnostics

- Corrected the router comment: routing receives the full raw source, not BODY alone.
- Replaced misleading `multiline card-fact locator` failures with the mode-neutral `Header card-fact locator` wording.

## Persistence

- Added runtime validation for current editable documents, saved cards, encounters, settings, parse jobs, and diagnostic report envelopes.
- Preserved explicit legacy migration paths instead of accepting arbitrary modern records through type assertions.
- Extracted encounter hydration into a tested pure module; `subtitle: null` no longer schedules a redundant startup write.
- Replaced fixed JSON-store `.tmp` names with per-process, per-operation names and failure cleanup.

## HTTP and identity boundaries

- Sanitized model, translation, synchronous parse, and failed-job error responses while retaining technical detail in local diagnostics/logs.
- Sanitized unsuccessful provider health details returned to the browser.
- Clarified in code and current documentation that `clientId` is only a routing namespace, not authentication or authorization.

## Regression coverage

- Added tests for invalid modern product/job/diagnostic records, collision-safe file writes, safe provider errors, client routing isolation, and null-subtitle encounter hydration.
