# Patch 2.74.63

Test/integration follow-up for the candidate-lattice extraction refactor.

- Updated the two remaining `pipeline.test.ts` cases that still constructed model candidate IDs with the removed direct `createSourceCandidates()` path.
- They now use `prepareCandidateLattice(..., "auto").candidates`, matching the production candidate-coordinate pipeline.
- No production parser, compiler, persistence, encounter, or presentation behavior changed in this patch.
- Synchronized package/runtime version metadata to 2.74.63.
