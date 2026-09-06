# Patch 2.74.11 — grounded inline header ownership

## Problem
Direct structural ownership could preserve a model-owned header span such as `AC 17 Initiative +7 (17)` as one `armor_class` annotation outside generic mode. The printed initiative then remained embedded in AC, so the editable compiler materialized a second DEX-derived initiative.

## Change
The existing deterministic multi-field header splitter now supports a narrow `requireInlineEvidence` mode. Under strict direct ownership, splitting is allowed only when the candidate contains at least two independently proven canonical header starts on the same physical source line. Generic/legacy paths retain the broader grounded splitter behavior.

No field-specific `AC -> Initiative` rule was added. Header identity still comes exclusively from `findDeterministicHeaderStarts`, exact source-unit boundaries are preserved, bracket-contained labels remain protected, and multi-line strict ownership is unchanged unless the existing explicit opt-in is enabled.

## Regression coverage
- `AC 17 Initiative +7 (17)` splits under strict structural ownership.
- Printed `Initiative +7 (17)` suppresses DEX-derived `-1` in the editable product.
- `AC 17\nHP 150` remains one model-owned span under strict ownership without broad opt-in.
- Existing annotationCompiler suite: 16/16 pass.
- parserRouting suite: 11/11 pass.
- Candidate transport retains its pre-existing unclassified-run baseline failure.
- Editable compiler retains its pre-existing source-formatting and derived-initiative provenance expectation failures.
- headerFacts test remains blocked in this container by the same pre-existing ts-node environment failure as 2.74.10.
