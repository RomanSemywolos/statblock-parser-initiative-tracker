# Patch 2.74.105 — source-placement product compiler

## Why this is architectural, not a boundary heuristic

The 2.74.104 corpus exposed a class of failure that the parser-level lossless invariant did not prevent at the product boundary. A semantically wrong header annotation could cause `buildBody()` to omit its source because semantic ownership itself was being used as an omission condition.

`UTTERANCE OF DAMNATION` demonstrated the failure: the source remained perfectly reconstructable in the lossless document, but a large TRAITS region labelled as a header/challenge span did not appear in the editable product.

This patch removes that authority from semantic ownership entirely.

## Product projection contract

The compiler now follows:

`rawSource coverage -> visible default stream -> exact visible relocations`

rather than:

`semantic ownership -> choose which source survives into product`.

Every meaningful source interval defaults to ordinary editable content. It leaves that stream only when the compiler has already created another visible product representation for the same exact source range.

There is no generic "header-owned therefore suppress from BODY" path anymore.

## Exact relocation plan

`buildHeader()` now returns both the editable header and the exact source ranges that it actually materialized elsewhere.

Those ranges include, when applicable:

- exact name/subtitle source;
- exact source-backed fallback header rows;
- exact Evidence ranges;
- exact printed Initiative/PB rows.

Structured AC/HP/CR/abilities/saves relocate through Evidence. Derived synthetic values have no source relocation.

`buildBody()` subtracts only those exact ranges from the source presentation stream. If only part of a semantic span was relocated, its remainder is kept and demoted to unresolved presentation instead of inheriting the larger span's semantic label.

## No second imported-text authority

Product source parts are reconstructed from `rawSource.slice(annotation.source.start, annotation.source.end)`, not from `annotation.text`.

Structured fact presentation likewise re-slices `rawSource` from valid fact coordinates. `source.evidence` remains only a backward-compatible fallback for old malformed fixtures whose coordinates are absent/invalid.

## Missing ownership recovery

The product compiler now fills any uncovered meaningful raw-source interval as unresolved content before placement. Production lossless documents already guarantee complete blocks; this extra layer makes the product boundary robust against legacy/corrupt documents and test harness drift.

## Exact save evidence

`StructuredHeader` gains optional `savingThrowEvidence`. When the fixed-header verifier safely proves a standalone printed Saving Throws region, the exact verified range is retained separately. Product Evidence therefore no longer needs to widen to a broader semantic annotation just to recover the complete printed row.

Saves inside a constraint-proven ability table still share `abilityEvidence`.

## Hard product coverage check

Before returning `EditableStatblockDocument`, the compiler verifies that every non-whitespace source-map unit is covered by either:

- an exact source range rendered in another product surface; or
- BODY.

A future regression therefore fails compilation instead of returning a silently incomplete statblock.

## Regression/audit work

Added regressions proving that:

- an UTTERANCE-style giant false `challenge` annotation cannot hide TRAITS prose;
- unproven ability/save header semantics remain in the default source stream;
- missing parser ownership cannot hide raw source;
- existing Evidence relocation still avoids intended duplication.

Several old compiler tests were corrected because they mutated `annotation.text` without changing `rawSource`. That harness violated the parser's established source-authority contract. The tests now edit the actual source and coordinates instead of relying on copied annotation text.

## Scope deliberately unchanged

This patch does **not**:

- redesign candidate transport;
- change BODY routing modes;
- add a TRAITS keyword rule;
- change the current `size_type_alignment` placement;
- change ability constraint solving;
- change the fixed fact verifier contract;
- reintroduce the rejected 2.74.88 or 2.74.93-94 boundary architectures.

It restores the intended architecture at the parser -> product boundary: LLM semantics supply grounded coordinates/meaning; deterministic code owns source placement; source cannot be silently discarded by semantics.
