# 2.74.24

Test stabilization follow-up.

- `pipeline.test.ts` `routedCandidates()` now mirrors the production candidate pipeline through `attachBoundaryEvidence(..., routing.selectedMode)`.
- This fixes the remaining integration fixture mismatch where the mock model used candidate IDs from the pre-boundary lattice while `analyzeStatblock()` consumed the post-boundary lattice.
- No production parser behavior changed.
