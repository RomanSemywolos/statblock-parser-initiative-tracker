# Patch 2.74.40

Test-contract correction after the multilingual mixed-structure changes in 2.74.39.

## What changed

- Updated the active-pipeline regression in `src/pipeline.test.ts` that still expected the removed English-profile `header_field -> feature` override.
- The test now matches the production contract introduced in 2.74.39:
  - deterministically proven header semantics (for example Armor Class) may correct a wrong model role;
  - a source-grounded `header_field` with no known English subtype remains `header_field / other_header`;
  - absence of English deterministic header semantics is not evidence that a localized/homebrew header is a feature;
  - `candidate_header_reclassified_as_feature` is therefore not expected on the active direct-transport path.

## Production behavior

No production parser, candidate, transport, compiler, renderer, or semantic-enrichment behavior changed in this patch.

The product-level save enrichment remains unchanged and intentional: printed saving throws retain their printed bonuses, while unprinted abilities may be shown with their ordinary ability modifiers in the game-ready editable representation.

## Legacy note

`candidateReconciler.ts` and its dedicated tests still contain the older header-to-feature reconciliation policy. That module is historical/test debt and is not the active `analyzeStatblock()` direct-transport path. It is intentionally not refactored in this test-only patch.
