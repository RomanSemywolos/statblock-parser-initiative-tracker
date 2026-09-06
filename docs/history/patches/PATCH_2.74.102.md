# Patch 2.74.102 — constraint-complete ability evidence

## Goal

Make fixed-header ability extraction consistently use the same proof policy that succeeds on Rak Tulkhesh: the model may ground the ability-table region and printed labels, but deterministic constraints are the authority for scores, modifiers, and printed saving throws.

## Production change

`resolveVerifiedAbilityRegionFromSource()` no longer treats the verifier's right edge as an authoritative numeric boundary. Dense candidate lattices can truncate an otherwise correct `ability_scores` claim before the final numeric cell (the collapsed Demogorgon corpus case did exactly this).

The resolver now:

1. keeps the verifier-proven left edge fixed;
2. tries the exact grounded region and progressively wider source-content boundaries;
3. never widens past the next source-proven section heading or beyond a compact local 1024-character window;
4. accepts only regions that the ordinary six-ability constraint solver proves;
5. among valid regions, prefers the one with the most independently proved mechanical atoms (scores + printed modifiers + printed saves), then the shortest equally-rich region.

This matters for Rak-style score/mod/save tables: a six-score solution is not allowed to win merely because it becomes valid one cell before the final printed CHA save. The richest complete table wins.

The left edge is deliberately never widened, so this change cannot pull unrelated preceding metadata into the ability table. Source ownership is unchanged.

When deterministic constraints extend a verifier region, `headerFacts` records the informational issue `verified_ability_region_constraint_extended`.

## Regression coverage

Added tests for:

- Rak-style vertical score/mod/save evidence where the verifier stops before the final CHA save;
- collapsed Demogorgon-style ability evidence where the candidate span ends before `CHA ... (+modifier)` is complete;
- localized ability labels using model-grounded label identities and the same deterministic right-edge recovery.

## Validation

Local Linux validation (compiled JS because the supplied `node_modules` contains Windows esbuild binaries):

- `npm run typecheck` — green;
- `npm run build` — green;
- `node --test dist/*.test.js` — green before version bump, with the new regressions included.

No header/evidence UI redesign is included in this patch. Classification placement and the future collapsible evidence block remain separate next tasks.
