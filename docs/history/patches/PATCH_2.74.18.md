# Patch 2.74.18 — conservative architecture cleanup (review round 2)

## Scope

This patch implements only review items 4 and 6. It is intended to change ownership of knowledge, not parser behavior.

### 4. Central English header lexicon, decentralized evidence policy

- Added `src/headerLexicon.ts` as the single owner of printed English header aliases.
- `headerClassifier.ts` now combines a lexicon match with its existing field-specific value evidence.
- `annotationCompiler.ts` uses the lexicon only to confirm the expected printed label; its previous safe-wrapped-field allowlist remains explicit and unchanged.
- `parserRouting.ts` keeps its deliberately conservative vocabulary policy. It uses canonical aliases only, except for the pre-existing `Saves` alias and both long `Challenge` forms. Compact aliases such as `AC`, `HP`, `CR`, `PB`, `Resistances`, etc. are not newly promoted to routing evidence.

### 6. Neutral candidate type ownership

- Added `src/candidateTypes.ts` for `SourceCandidate`, candidate reasons, and boundary evidence types.
- Removed the type-only `sourceCandidates.ts` <-> `boundaryEvidence.ts` cycle.
- Compatibility re-exports remain in both old modules so downstream imports do not require a broad mechanical rewrite.
- No separate `EvidencedSourceCandidate` pipeline was introduced; `boundary` remains optional as before.

## Regression intent

- Alias recognition remains source-grounded and exact.
- Router strength policy remains narrower than semantic classification.
- Lossless coordinates and source reconstruction are unchanged.
- This patch does not address review items 5, 8, or 9.

## Validation

- New header/annotation/router regression set: 42/42 pass.
- Editable-document + translation compatibility coverage also passes in the dependency-less emitted runtime.
- Candidate/boundary/body suite has exactly the same 11 pre-existing dependency-less baseline failures as 2.74.17: 53/64 pass in both versions, so this patch adds no failures there.
- Old 2.74.17 vs new 2.74.18 deterministic header classifier comparison: 0 differences across 40 representative/adversarial canonical, compact, prose, and inline-header samples.
- Strict TypeScript check passes for the changed production modules that do not transitively require the unavailable `zod` package.
- Full local `npm test` remains unavailable because this worktree has no `node_modules`/`tsx`. `quoteAnchor.test` cannot run from the dependency-less emitted tree because `modelSchema.js` requires `zod`; the only quoteAnchor production change is removal of an unused constant.
