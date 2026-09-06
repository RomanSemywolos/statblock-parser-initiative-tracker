# Patch 2.74.47

Minimal compile-fix release on top of 2.74.46.

## Fixed

- `src/pipeline.ts`: replaced one stale `structureRawSource` identifier left behind by the 2.74.46 full-source structural pipeline refactor with the canonical `input.rawSource`.
  - This stale identifier caused `npm run typecheck` to fail with `TS2304: Cannot find name 'structureRawSource'` at the essential-facts verification request.
  - No intended parser behavior changed; the verifier now receives the same full immutable source used by the structural candidate pass.
- Synchronized runtime `PACKAGE_VERSION` with package metadata at `2.74.47`.

## Validation

- Sandbox normal `npm run typecheck` still cannot run to project diagnostics because `@types/node` is not installed in the sandbox environment (`TS2688`).
- Emitted/noCheck runnable suite after the final fix:
  - 333 test entries
  - 325 passed
  - 8 test-file startup failures caused by unavailable runtime dependencies such as `zod`
  - 0 assertion failures among runnable tests
- Runtime/package version consistency test passes.
- `structureRawSource` no longer appears anywhere under `src/`.

This release contains no new architectural changes beyond 2.74.46.
