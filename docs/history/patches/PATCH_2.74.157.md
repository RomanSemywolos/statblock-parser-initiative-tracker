# Patch 2.74.157 — grounded localized ability labels

- Completed the existing `abilityLabels` Header evidence path instead of adding language-specific dictionaries.
- Essential-facts generation schema now always asks for an `abilityLabels` array (empty when unused).
- Universal and collapsed-singleline Header prompts require all six exact printed ability labels whenever `ab` is claimed.
- Numeric scores/modifiers/saves remain deterministic and source-grounded; the model supplies semantic label identity only.
- Existing deterministic localized-label resolver remains authoritative and already rejects incomplete, ambiguous, conflicting, or ungrounded six-label sequences.
- Added regression assertions that localized Russian ability labels recover the six scores and that the same grounded identities recover the separate saving-throw row.
- Added prompt/schema contract regressions.
- Corrected the root package-lock workspace version stamp while bumping the release to 2.74.157.

Validation: core TypeScript typecheck passed. The compiled Node suite passed 558/558. A frontend-only typecheck still reports the pre-existing 2.74.156 `EditableHeaderEvidenceField` / `proficiency_bonus` label-map error in `frontend/src/StatblockViews.tsx`; this patch does not touch frontend code.
