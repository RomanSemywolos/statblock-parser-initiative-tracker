# Product source-placement invariant

The parser and product boundary have two separate losslessness obligations. Both are hard invariants.

## 1. Evidence reconstructability

The lossless parser document must reconstruct the canonical source exactly:

`reconstruct(losslessDocument) === rawSource`

`DocumentBlock[]` is a deterministic partition of `rawSource`; rejected, missing, ambiguous, or conflicting semantic claims therefore reduce annotation quality only. They do not remove source.

## 2. Product-visible source placement

`compileToEditableStatblock()` is not allowed to decide whether imported source exists. It may only decide where already-existing source is presented.

The default placement of every non-whitespace source interval is ordinary editable content. A source interval may leave that default stream only when the compiler has already materialized the same exact grounded interval in another visible product surface:

- name;
- subtitle / current type-alignment slot;
- an exact source-backed header row;
- the collapsible Evidence panel.

There is deliberately no `hidden`, `consumed`, `claimed`, or semantic-ownership-to-omission state.

LLM roles, header/body ownership, section identity, deterministic header labels, and verifier claims may change structure or presentation. None of them has omission authority.

## 3. Relocation is exact and subtractive

Product compilation starts with source coverage and creates a list of exact relocated source ranges. BODY is then the source stream minus only those already-materialized ranges.

If a semantic span is only partly relocated, the remainder stays visible and is demoted to unresolved presentation rather than inheriting a narrower semantic role from the original larger span.

This is important for a failure such as:

- exact CR row is independently verified;
- a bad structural claim labels a later multi-paragraph TRAITS region as `challenge`.

Only the exact verified CR range leaves the ordinary stream. The mislabelled TRAITS region remains visible because no product surface materialized that source range.

## 4. Coordinates, not copied model text, own imported text

Annotations are semantic overlays on coordinates. `annotation.text` is redundant diagnostic data and is not a product text-authority path.

The compiler reconstructs imported text from `rawSource.slice(start, end)`. Header fact evidence follows the same rule whenever valid coordinates are present.

Therefore stale or malformed semantic objects cannot inject replacement text into the product.

## 5. Evidence relocation

Evidence is exact imported source. For modern structured facts:

- AC/HP/CR use the exact verified fact range;
- abilities use the complete constraint-proven `abilityEvidence` region;
- standalone printed saves use the exact verified `savingThrowEvidence` region;
- saves printed inside the ability table share the single ability evidence region;
- printed Proficiency Bonus uses its complete exact proven source field; combined CR/PB rows share one merged Evidence interval.

A broader semantic annotation is not allowed to widen one of these exact Evidence ranges.

## 6. Missing parser ownership is safe

Before presentation, the compiler reconstructs any meaningful raw-source gaps not represented by semantic parts as unresolved source content. This is a defensive product-boundary property on top of the parser's own block-partition invariant.

Consequently missing/corrupt annotation ownership cannot make raw source disappear.

## 7. Final coverage assertion

Before returning the editable document, the compiler verifies that every non-whitespace `sourceMap` unit is covered by at least one visible placement: either a relocated product surface or BODY.

Failure aborts compilation instead of returning a silently incomplete product document.

The assertion is a guard. The primary safety property comes from the construction itself: BODY is the default source placement, and semantics have no deletion path.

## 8. Scope

Whitespace is normalized for product presentation as before; exact source remains available in the lossless parser document, and Evidence preserves exact source for relocated proof rows. This invariant concerns meaningful imported source content, not pixel-identical source layout.

Regression coverage lives primarily in `editableCompiler.test.ts` and includes:

- wrong BODY/header semantic ownership;
- missing parser ownership;
- incomplete structured abilities/saves;
- adjacency to structured ability promotion;
- the UTTERANCE-style catastrophic case where a long TRAITS region is falsely labelled as a header field;
- exact AC/HP/CR/ability/save Evidence relocation.
