# Patch 2.74.22 — stabilization pass

This patch resolves the accumulated failing-test baseline exposed by a full dependency-backed test run after 2.74.20/2.74.21. It intentionally separates stale assertions/test harness drift from real runtime defects.

## Production fixes

- `quoteAnchor.ts`: legacy fixed-bucket section headings no longer depend on the order in which the model returns heading buckets. Uniquely grounded printed headings are anchored independently and sorted by source position; genuinely ambiguous repeated headings retain the conservative sequential fallback.
- `translationRules.ts`: `Success: Half damage.` is translated before the generic `Success:` rule can consume its prefix.
- `candidateReconciler.ts`: a narrow surface-shape guard keeps a wrapped standalone reference tail such as `... use of its / Bite or Claw. / Bite. ...` attached to the preceding feature. It requires an unfinished previous piece plus the same leading word in the following strong feature; arbitrary neighboring feature names are unaffected.

## Test-contract repairs

- Candidate reconciler fixtures now use the same routed/enriched + boundary-evidence contract as production, rather than assuming that the language-neutral base lattice contains every historical coordinate.
- Reconciler fixtures that specifically exercise reconciliation now place intended test boundaries explicitly instead of depending on obsolete candidate-generator behavior.
- Pipeline/web integration fixtures use routed candidates and explicitly distinguish the structural model request from the independent card-fact verification request.
- Prompt assertions now use the current `STRUCTURAL PROPOSALS` terminology and current wording.
- Product/compiler assertions now match current v2 product invariants: permanent empty name slot, DEX-derived initiative provenance, source-proven styling only, and current Auto Style output.
- Fragmented ability-table test now checks the conservative proven mechanics region without requiring generic `mod/save` labels to be swallowed into ability ownership.
- Translation measurement assertion now matches the already-established `сфера радіусом N футів` closed-vocabulary output.

## Validation in dependency-limited container

- Full `src/*.ts` dependency-less TypeScript emit succeeds.
- `candidateReconciler.test`: 22/22 pass.
- `prompt.test` + `translation.test` + `editableCompiler.test`: 32/32 pass.
- Per-file emitted-JS sweep: 37 test files pass; 8 test files are blocked only by unavailable `zod` runtime dependency. No runnable test file has an assertion failure.
- Reordered legacy-heading scenario checked directly against `anchorQuotedResponse`: 9 grounded candidates, 0 warnings, correct source order.
- Translation regression checked directly: `Success: Half damage.` -> `Успіх: Половина шкоди.` with mechanic validation still `ok=true`.
- Package metadata and `PACKAGE_VERSION` are synchronized at 2.74.22.

A normal dependency-backed `npm test` is still required as the final end-to-end verification because this container cannot install npm dependencies.
