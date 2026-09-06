# Comprehensive source-placement audit — 2.74.105

## Question

Can any active semantic/parser mechanism make imported source content disappear from the editable product document?

The intended architecture is not "recognize source correctly enough that loss does not happen". It is:

`immutable raw source -> exact deterministic partition -> grounded semantic coordinates -> deterministic visible placement`

Semantic interpretation may be wrong. Wrong semantics may damage structure or presentation, but they must not decide whether source survives.

## Audit result

The parser-side lossless architecture was already present and should not be replaced. The active violation was at the parser -> editable-product compiler boundary.

2.74.105 restores that boundary to the existing lossless design instead of introducing another header/body heuristic.

## 1. Immutable source authority — retained

`rawSource` remains the imported source of truth.

`sourceMap` partitions the source into exact source units. Model output never rewrites the source. Candidate IDs and annotation source ranges are coordinates over that source.

This layer did not cause the UTTERANCE failure and was not redesigned.

## 2. Lossless annotation/block compiler — retained

`annotationCompiler.ts` already constructs an exact block partition. Semantic annotations occupy grounded ranges; uncovered ranges are represented explicitly as separator/unclassified blocks.

The existing invariant remains:

`reconstructBlocks(blocks) === rawSource`

A model failure therefore reduces semantic knowledge; it does not remove parser source.

This layer did not cause the UTTERANCE failure and was not redesigned.

## 3. Header enrichment / verifier / ability resolver — retained

The fixed-fact verifier, deterministic ability-table resolver, header enrichment, candidate transport and BODY routing remain separate semantic/extraction layers.

They may prove facts from coordinates outside the structural header boundary. They may replace or refine semantic annotations while rebuilding a lossless block partition. They do not receive authority to delete source.

No TRAITS keyword exception or new body-boundary heuristic was introduced.

## 4. Product compiler — active defect found

Before 2.74.105, `editableCompiler.ts` did not derive BODY from complete source placement. It first found a semantic body boundary and then omitted parts considered product-header-owned.

That made semantic ownership an omission authority.

The UTTERANCE corpus exposed the exact failure mode:

- the real CR row was separately verified and rendered;
- `TRAITS` was incorrectly annotated as `other_header`;
- the following trait prose was incorrectly annotated as a large `challenge` header span;
- the compiler treated that large span as already header-owned;
- but the header displayed the independently verified real CR instead;
- therefore the false header span had no visible placement and disappeared from the editable product.

The lossless parser document was still complete. The product projection was not.

## 5. Product source authority — restored

2.74.105 makes `rawSource` coordinates authoritative at the product boundary too.

`SourcePart.text` is reconstructed with:

`rawSource.slice(annotation.source.start, annotation.source.end)`

rather than trusting the copied `annotation.text` as a second imported-text authority.

`annotation.text` remains useful for semantic analysis/diagnostics after grounding, but cannot rewrite product source text.

## 6. Default visible placement — restored

All meaningful imported source defaults to the ordinary visible source stream.

There is no longer a generic operation equivalent to:

`semantic role says header -> omit from BODY`

or:

`claimed/owned -> do not render`

`buildBody()` begins from source coverage and subtracts only exact ranges that the compiler has actually materialized in another visible surface.

Wrong semantic roles can therefore leave material in an ugly or incorrectly structured place, but cannot make it absent.

## 7. Relocation is exact and visible

A source interval may leave the default stream only when another visible product representation exists for that exact range.

Current examples include:

- exact source shown in Evidence for AC / HP / abilities / printed saves / printed CR;
- exact printed name/type source shown in their header slots;
- exact printed Initiative/PB source shown in their header rows;
- legacy/fallback source rows only when that source row itself is visibly rendered elsewhere.

Synthetic/derived values such as derived Initiative/PB have no source range and therefore relocate nothing.

If an exact relocation cuts only part of a broader bad semantic span, the unrelocated remainder stays visible and is demoted to unresolved presentation rather than inheriting the false narrow role.

## 8. Evidence is a relocation surface, not deletion

Evidence continues the same placement contract.

The exact source region used to create a standardized structured representation is displayed in Evidence; the same exact region is then omitted from the ordinary stream solely to avoid duplicate display.

Standalone verified Saving Throws now retain a dedicated exact `savingThrowEvidence` range, preventing Evidence construction from having to widen to an unreliable broader semantic annotation.

Rak-style saves inside the ability table continue to share the complete constraint-proven ability evidence region.

## 9. Missing/incorrect ownership is safe

`sourceParts()` defensively recovers any meaningful raw-source gap as unresolved product source.

Production parser documents should already have complete block coverage, so this is not a replacement for the parser invariant. It protects the product boundary against corrupt/legacy documents and test harnesses.

Therefore even missing annotations cannot create invisible source.

## 10. Final product coverage invariant

Before returning an `EditableStatblockDocument`, 2.74.105 verifies that every non-whitespace source-map unit has at least one visible source placement:

- relocated to another visible surface; or
- retained in BODY.

If this invariant is violated, compilation fails instead of returning a silently incomplete statblock.

This assertion is a final proof/check, not the primary prevention mechanism. The construction itself is source-default and subtractive, so semantic omission authority has already been removed.

## 11. Tests/audit cases added

The compiler regressions now cover:

1. UTTERANCE-style false giant `challenge` ownership across TRAITS prose — all trait text remains visible.
2. Unproven ability/save header semantics — source stays in the default stream.
3. Missing parser ownership/block presentation — raw source gap is recovered visibly.
4. Corrupted/copied `annotation.text` — product uses the original `rawSource` slice, not the copied rewrite.
5. Existing exact Evidence relocation — intended source is shown once rather than duplicated.

The latest 17-report user corpus was also recompiled through the new product compiler without a source-coverage failure.

## 12. Explicit non-changes

This audit deliberately does not redo working architecture around the defect. 2.74.105 does not change:

- candidate generation/transport;
- multiline/mixed/singleline routing;
- universal header scan;
- body semantic parser contracts;
- fixed-fact verifier contract;
- deterministic ability constraint solver;
- annotationCompiler lossless partition;
- Auto Style semantics;
- current `size_type_alignment` product placement;
- the rejected 2.74.88 / 2.74.93-94 boundary designs.

## Resulting hard rule

For imported source, semantics can answer **what a coordinate means** and deterministic code can decide **which visible surface owns that coordinate**.

No semantic classification has authority to answer **whether that source survives**.
