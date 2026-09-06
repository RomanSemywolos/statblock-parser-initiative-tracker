# Patch 2.74.6

Two narrow fixes, both preserving the existing parser architecture.

1. Mixed/generic direct candidate transport now enforces the already-existing source-proven feature-boundary splitter. The full legacy reconciler is **not** enabled. A model-owned `feature` can only be split at candidate boundaries that the existing conservative `isSafeInternalFeatureStart` logic already accepts. Multiline and singleline behavior are unchanged.

2. `DC 23` / `СК 23` rendering now uses a non-breaking space in the DOM only. Editor auto-format serialization maps that NBSP back to a normal space, so product text and source-derived content remain canonical while browser/Word copying no longer creates a visual-line break inside the mechanical atom.

## Verification

- `candidateTransport.test.ts`: 15/16 pass; the single failing explicit-unclassified fixture also fails unchanged in v2.74.5 (12/13 baseline).
- New regressions pass for Lolth `Kiss -> Impaling Legs -> Insidious Embrace`, `Nexus -> By the Dark Mother's Design`, and Erlking wrapped continuations.
- `sourceCandidates.test.ts`: 16/16 pass.
- `boundaryEvidence.test.ts`: 1/1 pass.
- `parserRouting.test.ts`: 11/11 pass.
- `multilineDeterministic.test.ts`: 6/6 pass.
- `candidateReconciler.test.ts` remains at the unchanged v2.74.5 baseline (10/20) in this ts-node environment.
