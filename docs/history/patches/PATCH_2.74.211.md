# Patch 2.74.211 — reject 2.74.210 singleline BODY transport experiment

## Live decision

The live qwen3:8b five-case corpus for 2.74.210 shows that the singleline BODY transport change is a regression, not an improvement.

2.74.210 changed two model-facing BODY details together:

1. compressed `class=N` candidate evidence was expanded into repeated local evidence on every candidate;
2. numeric starts (`{"s":17}`) were replaced by direct `Cxxx` string starts (`{"s":"C017"}`).

The candidate lattice, source ownership and downstream deterministic parser were intentionally unchanged, so the observed change is attributable to model-facing transport rather than BODY semantics.

The live behavior became substantially less stable: several cases over-segmented almost every selectable candidate, while Tarrasque moved in the opposite direction and became much coarser. This is worse than the 2.74.208 BODY behavior and provides no evidence that the mixed transport lesson transfers safely to dense singleline geometry.

## Decision

2.74.210 BODY transport is rejected completely.

2.74.211 restores the active singleline BODY transport exactly to the 2.74.208 behavior:

- compressed `class=N` candidate transport is restored;
- the separate structural-class legend is restored;
- BODY starts are again numeric candidate suffixes;
- the bounded numeric BODY JSON schema/parser is restored;
- BODY completion budgeting again uses the numeric-start payload;
- candidate generation, exact BODY complement, virtual multiline reconstruction and the shared deterministic multiline BODY parser remain unchanged.

This is a rollback, not a new heuristic experiment.

## Header status

The singleline Header remains on the accepted practical 2.74.208 behavior. The rejected 2.74.209 Header prompt experiment remains rejected. No Header semantics, verifier rules, ability-anchor behavior, ownership rules or deterministic repairs are changed in 2.74.211.

## Architectural lesson

The accepted mixed BODY transport should not be copied mechanically into singleline. Mixed retains physical row geometry and uses a relatively sparse candidate view. Singleline has a denser synthetic/address space; repeating full local evidence at every candidate materially increases prompt noise and appears to destabilize qwen3:8b.

For the current local-model target, the compact class-deduplicated singleline transport is therefore the safer baseline even though `class=N` was harmful in a different mixed experiment.

## Remaining singleline BODY limitation

The restored 2.74.208 BODY baseline is not perfect. qwen3:8b can still miss or over-insert ambiguous logical starts in fully collapsed text. Those errors remain geometry errors: source text is preserved, BODY semantics are still owned by the shared deterministic multiline parser, and no second semantic BODY model is introduced.

Further tuning is not justified unless a new failure has a clearly source-proven, mode-specific cause. Otherwise the remaining variation should be treated as a model-quality limitation and is expected to improve with a stronger LLM.

## Validation

- `npm run typecheck` — PASS
- `npm run build` — PASS
- `node --test dist/*.test.js` — 526/526 PASS
- exact source reconstruction invariants remain covered by the existing suite
- no `node_modules`, `dist`, `.git` or symlinks are included in the release archive

Frontend strict TypeScript could not be re-run in this Linux extraction because the bundled TypeScript platform package is absent and the archived Vite executable is non-executable. No frontend source was changed in 2.74.211.
