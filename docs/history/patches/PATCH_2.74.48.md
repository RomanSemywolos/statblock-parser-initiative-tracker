# Patch 2.74.48

## Scope

Test-contract correction only. No parser production behavior changed relative to 2.74.47, apart from the package/runtime version bump.

## Why the Windows suite exposed two failures

### 1. Fragmented ability promotion test still assumed the old sparse candidate lattice

`headerFacts.test.ts` constructed model blocks by hard-coding `C002`, `C003`, ... as if every next candidate were the next physical source row. Since 2.74.46, the multilingual candidate lattice is intentionally over-complete: additional weak coordinates may exist inside a physical row. Candidate index therefore is not a physical-line number.

The production invariant remains correct: the recovered ability region starts at the first proven ability label and must not widen backward into generic `mod` / `save` column labels.

The test now derives exact model spans from current routed candidate source offsets for every physical line. It tests source ownership rather than candidate density.

### 2. Pipeline test required the English deterministic classifier to repair an intentionally wrong model role

The old test deliberately returned `Armor Class 18` as a feature and expected deterministic English knowledge to reclassify it as an `armor_class` header.

That is precisely the structural English dependency removed in 2.74.46. The new contract is:

- multilingual structural model owns the grounded span;
- optional `h.f` supplies the semantic header subtype (`ac`, `hp`, `sk`, etc.);
- independent critical-fact verification may refine an already-owned header span;
- English profile knowledge is optional additive semantic evidence/fallback and must not move or rescue structural ownership.

The regression now returns `Armor Class 18` as `h + f:"ac"` and still verifies that a grounded semantically unknown header remains `other_header` rather than receiving invented semantics.

## Validation

- Source was emitted with TypeScript `noCheck` successfully.
- Widest runnable emitted suite: 333 entries; 325 passed; 8 test files could not start because the sandbox lacks runtime `zod` / `undici`; 0 assertion failures among runnable tests.
- An attempted `npm ci --ignore-scripts` in the sandbox timed out before dependencies were installed, so the two dependency-backed tests themselves could not be executed here.
- Diff against the released 2.74.47 ZIP confirms no production source changes other than `src/version.ts`; functional changes are limited to `src/headerFacts.test.ts` and `src/pipeline.test.ts`.

The user's normal Windows `npm run typecheck` and `npm test` remain authoritative for the dependency-backed suite.
