# Patch 2.74.62 — candidate pipeline cleanup

Scope: architecture/test-contract cleanup. No intended parser semantic behavior change.

## Shared production candidate lattice

Added `prepareCandidateLattice()` in `src/candidateLattice.ts` as the single production composition for:

1. parser routing;
2. neutral/base source candidates;
3. optional English structural profile evidence;
4. mode-specific candidate enrichment;
5. boundary evidence attachment.

`pipeline.ts` now consumes this helper instead of rebuilding the stages inline.

Integration-oriented helpers in `pipeline.test.ts`, `headerFacts.test.ts`, `webApp.test.ts`, and the quarantined legacy reconciler tests now use the same production candidate address space. Low-level tests of individual candidate/evidence stages remain direct by design.

This also removes a previous test drift where some multiline helpers omitted the profile-evidence argument that production supplied.

## Legacy reconciler quarantine

The unused `candidateReconciler.ts` production-looking module had no production callers. It is now explicitly quarantined as `legacyCandidateReconciler.ts`, with its test file renamed accordingly and a warning documenting that production parsing uses `candidateResponseToDirectResponse()` from `candidateTransport.ts`.

An active source-proven-boundary test no longer imports a text helper from the legacy reconciler.

No legacy policies were migrated or deleted in this patch; that should happen only when an invariant is proven relevant to the active transport.

## Evidence authority contract

Added `EVIDENCE_AUTHORITY_2.74.62.md` and type-level documentation clarifying the authority boundaries between source geometry, structural/profile evidence, boundary evidence, model semantic claims, critical verification, product compilation, and presentation.

The core rule remains: evidence can constrain or refine only within its layer; usefulness does not automatically grant semantic ownership authority.
