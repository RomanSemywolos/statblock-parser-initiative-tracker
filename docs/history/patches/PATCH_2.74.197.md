# Patch 2.74.197 — active-path audit and dead-code cleanup

Base: 2.74.196 card-reparse baseline.

Purpose: finish the architecture-cleanup pass before further mixed-parser research. This patch is intended to be behavior-neutral for active parsing.

## Removed unreachable production modules

Reachability review confirmed that the following production modules were no longer imported by any active production entry path and belonged to superseded experiments/architectures:

- `src/bodyRunSanitizer.ts`
- `src/englishCandidateEvidence.ts`
- `src/headerCoordinateOverlay.ts`
- `src/headerFunctionalEquivalence.ts`
- `src/legacyCandidateReconciler.ts`
- `src/quoteAnchor.ts`
- `src/sectionStructure.ts`

Their dedicated historical tests were removed with them. The retired singleline semantic-prompt test was also removed; the active singleline starts-only normalization contract remains covered by current prompt/pipeline architecture tests.

## Removed dead contracts from live modules

Live modules were reduced to the currently reachable contracts:

- retired Header coordinate-overlay / shadow-comparison helpers and metadata classes;
- retired semantic BODY / singleline boundary-classification prompt constants and schemas;
- retired language-profile candidate evidence plumbing;
- dead compatibility helpers/imports/comments left by the 2.74.158–2.74.195 reconstruction;
- stale singleline candidate-audit origin channels that were permanently zero after language-profile removal;
- the unused `createMultilineBodyPlan(..., bodyStartCandidate)` suffix API.

`multilineDeterministic.ts` now exposes only the ownership-first physical-row path plus the shared virtual-multiline normalization path used by mixed/singleline.

## Test-harness cleanup

`headerFacts.test.ts` no longer reconstructs the retired bounded Header scan or uses fixture-only `__bodyStartQuote`. Its fixed-Header model fixtures now use the same whole-source `generic` Header candidate coordinate space used by production `pipeline.ts`.

A stale bounded-scan branch was also removed from `webApp.test.ts`.

Architecture regression coverage now additionally asserts that the retired multiline `bodyStartCandidate` planner cannot return.

## Strict unused-code checks

Core and frontend TypeScript configurations now enable:

- `noUnusedLocals: true`
- `noUnusedParameters: true`

This makes ordinary stale imports/locals fail validation instead of accumulating silently.

## Frontend cleanup

Unused React/frontend imports, callbacks and stale helpers found by the strict pass were removed. No intended UI workflow was changed.

## Behavior-isolation checks

The 16 statblocks from `parse-reports(20260905-191411).json` were used as a deterministic parity corpus.

For every source, `multiline`, `generic`, and `singleline` were compared between 2.74.196 and 2.74.197 (48 comparisons):

- candidate lattice / Header candidate coordinates: identical;
- active Header and BODY model requests (system prompt, user prompt, schema, task and generation limits): identical;
- parser document structure, routing, candidate debug and deterministic hints under identical synthetic model responses: identical.

Therefore this cleanup does not intentionally change parser quality. Real-model corpus testing remains the regression authority for later semantic/parser improvements.

## Documentation

Current-contract notes in `README.md`, `CANONICAL_PARSER_ARCHITECTURE.md` and `ARCHITECTURE_HEADER_OWNERSHIP.md` were corrected so historical semantic-BODY / `class=N` / future-singleline descriptions cannot be mistaken for the current production architecture.

Historical patch/audit documents remain in the repository as development evidence and were not rewritten.
