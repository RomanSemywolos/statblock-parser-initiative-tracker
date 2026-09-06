# Patch 2.74.56 — conservative follow-ups from real parse diagnostics

## Scope

This patch applies only fixes whose source/evidence invariants were strong enough after the 2.74.54 diagnostics audit. It is based on the restored 2.74.55 multiline architecture: multiline still sends only its header to the LLM and keeps deterministic body parsing.

## Multiline inline header fields

A clean multiline statblock can print two independent header fields on one physical row, e.g.:

`AC 25    Initiative +18 (28)`

Physical-line-only candidate geometry gave the header model no coordinate for the second field. Multiline enrichment now adds the later optional profile header anchor only when at least two independently printed profile fields occur on the same physical row.

This does not assign ownership or semantics by itself and does not densify ordinary multiline rows. It only makes the second printed field addressable to the header-only model. Regression coverage verifies that `Initiative` gains a coordinate while an ordinary HP value token does not.

## Model-proven section heading without subtype

Previously `sh` without `v` was immediately collapsed to ordinary unclassified ownership. Real collapsed Demogorgon diagnostics showed the model correctly identifying `Legendary Actions` as a heading while omitting only `v=la`; the parser then discarded the useful heading identity.

The candidate model parser now preserves this state as `unknown_section_heading`. Transport treats it as a heading barrier. When the exact start also has an optional profile section anchor, that profile may supply only the exact printed heading extent and semantic subtype. It cannot cross a separately model-owned span. Without such evidence the source remains unresolved and visible.

## Duplicate name used as subtitle

If the uniquely grounded name and a proposed `size_type_alignment` span normalize to exactly the same printed text, subtitle ownership now abstains. The second printed occurrence remains losslessly visible as unresolved source instead of being rendered as the creature type/subtitle.

This addresses the Rak Tulkhesh case where duplicated page/title text was interpreted as the classification line. It does not guess that another nearby row such as `Huge Fiend, Neutral Evil` is the true subtitle.

## Explicit non-fix: weak `other_header` continuation

`from Nonmagical Attacks` remains unresolved in the problematic collapsed case for now. Diagnostics show it as a model-owned `h` on weak coordinates between two profile headers. Although it is probably continuation text, deterministically absorbing an unknown model-owned header could erase a legitimate localized/custom header that lacks a profile anchor. The evidence is not strong enough to override the model safely.

`Chaotic Evil` and publication metadata such as `MPMM` are likewise unchanged.

## Validation available in this environment

A temporary no-check TypeScript emit succeeded.

Focused runnable suites after the final changes:
- `sourceCandidates.test.ts`
- `candidateTransport.test.ts`
- `multilineDeterministic.test.ts`

Result: 63/63 passed.

Dependency-backed suites requiring the unavailable sandbox `zod` package were not claimed as passed. Full `npm run typecheck` / `npm test` should be run in the normal Windows development environment.
