# Patch 2.74.158 — canonical pipeline cleanup

## Scope

Housekeeping-only architecture cleanup. Parser behavior and the canonical Header/BODY contracts are intentionally unchanged.

## Production changes

- Removed the unreachable legacy parser half from `src/pipeline.ts` after the exhaustive ownership-first mode dispatch.
- Removed legacy-only helpers and imports for the retired global `bodyStart`, bounded header scan, semantic BODY generation, singleline transition/boundary/classification, quote-anchor fallback, and remainder-segment paths.
- Replaced stale comments that still described Header as a contiguous prefix/boundary task with the current fixed-fact ownership contract.
- Added an exhaustive `never` guard after the three resolved parser modes so a future new resolved mode cannot silently fall through.

## Architecture regression coverage

Added `src/pipelineArchitecture.test.ts` with three guards:

1. `pipeline.ts` must not contain the retired active-path markers (`bodyStartOffset`, `headerWindowSizes`, old boundary/classification prompt constants, or old semantic BODY prompts).
2. Each resolved parser mode may invoke only the canonical model task set: fixed Header locator; plus starts-only BODY normalization for mixed/singleline; no BODY model call for multiline.
3. Model-failure paths must terminate inside the canonical mode path and must not fall back to a retired architecture.

## Invariants preserved

- fixed Header fact set and exact source ownership;
- BODY = complement of accepted Header ownership;
- multiline BODY is deterministic;
- mixed/singleline BODY LLM restores line starts only;
- all modes converge on deterministic multiline BODY classification;
- source losslessness and product visibility;
- numeric authority and verifier behavior;
- candidate lattice and routing behavior.
