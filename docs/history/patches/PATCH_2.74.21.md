# Patch 2.74.21

Regression-test repair after the v2.74.19 language-evidence extraction.

- `candidateReconciler.test.ts` now gives collapsed fixtures the same enriched candidate contract used by production.
- The universal `createSourceCandidates()` remains language-neutral; no English vocabulary was moved back into it.
- No runtime parser behavior changed from v2.74.20.
- This addresses the 11 candidateReconciler failures introduced when the test harness continued to use the pre-v2.74.19 base-lattice contract.
- The supplied full-suite log also contains 15 pre-existing/stale failures outside this regression (prompt naming, editor-product expectations, translation assertions, legacy quote/pipeline/web assertions). They are not hidden or rewritten in this patch.
