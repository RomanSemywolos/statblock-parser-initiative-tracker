# Patch 2.74.23

Stabilization follow-up for 2.74.22. No product/parser behavior change.

- Fixes `candidateReconciler.test.ts` to pass the routed parser mode into `attachBoundaryEvidence`, matching its production signature.
- Fixes the pipeline cooperation fixture so semantic model spans may cover multiple candidate coordinates. The `Medium fiend, neutral evil` identity is now addressed by its exact source range rather than assuming it must be represented by one monolithic candidate.
- Keeps the language-neutral base lattice and all 2.74.19-2.74.22 production behavior unchanged.

Validation available in the dependency-limited build environment:
- dependency-free full TypeScript emit succeeded;
- `candidateReconciler.test`: 22/22 pass;
- exact identity fixture resolves to the complete source span across the routed singleline candidate range.

A normal project `npm run typecheck && npm test` remains the final validation because the container does not have the project's installed runtime dependencies (notably zod / Node type packages).
