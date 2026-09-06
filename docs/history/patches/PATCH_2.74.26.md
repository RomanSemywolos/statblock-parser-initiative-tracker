# 2.74.26

Direct candidate-transport semantic repair.

- Fixes a real integration gap: the current candidate pipeline uses `candidateResponseToDirectResponse()` and does not run the legacy `reconcileCandidateRuns()` path.
- A model-only `header_field` span with no deterministic header semantics is now reclassified as `feature` only when the exact owned source has strong named-feature shape.
- Emits `candidate_header_reclassified_as_feature` on that repair.
- Updates the integration test's feature->header diagnostic expectation to the current direct single-line contract (`singleline_header_interval_enforced`) rather than the legacy reconciler issue code.
- Removes an unused `reconcileCandidateRuns` import from direct transport.

No vocabulary-specific feature names were added.
