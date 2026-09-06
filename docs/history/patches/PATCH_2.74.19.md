# Patch 2.74.19

Third architecture review pass: language-aware singleline evidence and IndexedDB lifecycle.

## Candidate evidence boundary

- Added `englishCandidateEvidence.ts`. English header/section vocabulary is now extracted outside `sourceCandidates.ts`.
- `createSourceCandidates()` remains language-neutral, including collapsed one-line input.
- `enrichSinglelineCandidates()` and `enrichGenericCandidates()` consume neutral `CandidateStructuralEvidence` offsets instead of owning English scans.
- Preserved the exact previous singleline header subset and case sensitivity.
- Shared section labels now expose separate boundary policies so routing keeps its stricter whitespace/end evidence while singleline candidate evidence preserves the former word-boundary behavior.
- Added a candidate-level parity regression that snapshots the v2.74.18 singleline lattice on representative collapsed sources.

## IndexedDB lifecycle

- Added `indexedDbPrimitives.ts` with a narrow `LazyIndexedDbConnection`, `requestToPromise`, and `transactionToPromise`.
- Statblock, encounter, and settings repositories retain separate stores and CRUD/domain behavior. Only connection lifecycle is shared.
- Failed opens and blocked opens no longer leave a rejected cached promise.
- `versionchange` closes the stale database and clears only the matching cached connection.
- A late success after an already-rejected blocked open is immediately closed instead of leaking an orphan connection.
- Settings persistence now receives the same retry/versionchange lifecycle guarantees as the other repositories.
- Added isolated lifecycle tests for error retry, blocked late-success cleanup, versionchange reopen, and stale-handler races.

## Validation

- 54/54 targeted parser/persistence tests passed.
- Strict typecheck passed for all changed independent modules and their new tests.
- Full `src/*.ts` dependency-less emit passed with `tsc --noCheck`.
- Singleline candidate parity against recorded v2.74.18 behavior passed exactly on the regression fixtures.
