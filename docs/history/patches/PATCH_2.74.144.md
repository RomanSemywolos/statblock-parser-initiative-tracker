# Patch 2.74.144 — canonical singleline multiline normalization

## Goal

Move active singleline parsing onto the canonical Header-ownership / BODY-normalization architecture without adding BODY semantics to the LLM.

## Changes

- Active `singleline` routing now enters the ownership-first Header verifier used by multiline/mixed.
- Accepted Header evidence deterministically protects the corresponding source-owned candidate coordinates; everything else remains available as BODY.
- Added a dedicated model-independent `SINGLELINE_OWNERSHIP_BODY_SYSTEM_PROMPT`.
- The singleline BODY model returns only `{"starts":[{"s":"Cxxx"}, ...]}`.
- Added singleline-specific few-shot examples for collapsed peer entries, compact rows, internal labels, explanatory prose, internal lists, and non-English geometry.
- Candidate audit and synthetic reconstruction roles are exposed only as advisory shape evidence.
- Added a neutral shared BODY line-start JSON schema/parser and retained mixed compatibility wrappers.
- Generalized virtual multiline reconstruction so mixed and singleline both feed the same deterministic multiline classifier.
- Removed the active singleline second-pass block-classification call. Legacy helpers remain present but are unreachable from the active ownership-first parser path.
- Updated tests that encoded the retired singleline boundary/classification architecture.

## Invariants preserved

- source text is immutable and reconstructs exactly;
- LLM does not author printed values;
- Header validation remains deterministic;
- BODY LLM does not classify features/headings/actions/metadata;
- no active singleline `bodyStart`;
- one shared deterministic multiline BODY parser after normalization;
- ambiguous model misses may coarsen geometry but cannot delete source.

## Validation

- `tsc --noEmit -p tsconfig.json`: pass.
- compiled Node test suite: 535/535 pass.

Real qwen3:8b quality has not yet been claimed by this patch; this build is intended for the user's representative singleline report set.
