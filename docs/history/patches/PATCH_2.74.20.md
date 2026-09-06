# Patch 2.74.20

## Scope
Compile-only corrective patch on top of 2.74.19.

## Fix
- Restored missing type-only imports in `src/prompt.ts`:
  - `SourceCandidate` from `candidateTypes.ts`
  - `DeterministicHint` from `deterministicHints.ts`
- This also restores the inferred numeric type for the `index` callback inside deterministic-hint formatting.
- No parser, routing, candidate, persistence, translation, or presentation behavior changed.

## Verification
`prompt.ts`, `candidateTypes.ts`, `deterministicHints.ts`, and `headerClassifier.ts` pass strict TypeScript checking with NodeNext module resolution.
