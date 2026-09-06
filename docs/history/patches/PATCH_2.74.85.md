# Patch 2.74.85 — language-neutral active section semantics

## Production

- Removes English-profile section recovery from `candidateTransport.ts`.
- Removes the pre-LLM `sectionAnchors` channel from `CandidateStructuralEvidence`; optional English profile evidence is now restricted to HEADER addressability / ability-table geometry.
- Removes `profile_section_anchor` boundary evidence from the active lattice.
- `mixed` / `singleline` canonical section identity now comes only from the BODY LLM classifications (`sh` + semantic subtype) over grounded candidate coordinates. Deterministic transport may validate/route that identity but may not infer it from printed vocabulary.
- An `unknown_section_heading` resets active section ownership. Following rules/features remain unresolved instead of inheriting the previous section or being repaired from English text.
- Initial BODY content before the first printed section heading may still belong to implicit `traits`; this is positional structure rather than language inference.
- Clean `multiline` behavior is unchanged: one non-empty physical BODY row = one immutable logical unit; no structural BODY LLM call; Auto Style may create presentation headings with `headingKind: null`.

## Tests

- Replaces the old English profile-recovery regression with a regression proving that an unknown `Legendary Actions` heading is not repaired from English profile evidence and that following content does not leak into the previous `actions` section.
- Existing no-profile fixtures are updated to the new structural-evidence contract.

## Documentation

- `README.md` and `ROUTING_CONTRACT_2.74.79.md` now describe the active section-semantics contract.
- Historical 2.74.78/2.74.79 proposals are marked superseded.
- `legacyCandidateReconciler.ts` / `sectionStructure.ts` remain historical/quarantined and are not imported by the production parser path.
