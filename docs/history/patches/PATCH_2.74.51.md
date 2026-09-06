# Patch 2.74.51

## Scope

Test-contract synchronization only. No parser, transport, compiler, product, editor, or rendering behavior is intentionally changed from 2.74.50.

## Fix

`description` became a first-class section in 2.74.50 and its compact candidate section code `desc` was correctly added to `CANDIDATE_SECTION_CODE_MAP` / `CANDIDATE_SECTION_CODES` and exposed by `createCandidateRunGenerationJsonSchema()`.

One exact-array assertion in `src/modelSchema.test.ts` still expected the pre-description section-code list:

`t, a, ba, r, la, ma, lair, reg`

The test now expects the actual supported schema contract:

`t, a, ba, r, la, ma, lair, reg, desc`

This is a stale-test correction. `desc` is intentional production behavior and is already wired through the prompt, model schema, candidate transport, product section kinds, editable document, translation, and UI handling.

## Validation

Temporary no-check TypeScript emit succeeded.

Broad emitted test run:
- 347 test entries
- 339 passed
- 8 startup failures
- 0 assertion failures among runnable tests

The 8 startup failures are the same sandbox dependency limitation (`zod` / `undici` unavailable). `modelSchema.test.ts` itself cannot execute in this sandbox because importing `modelSchema.js` requires `zod`; the Windows dependency-backed test run remains authoritative for this exact test.

Temporary `.tmpemit` and `tsconfig.emit.tmp.json` are removed before packaging.
