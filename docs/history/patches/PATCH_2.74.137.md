# Patch 2.74.137 — mixed BODY prompt surface cleanup

This is a narrow quality repair on top of the ownership-first mixed architecture from 2.74.135–136.

## Problem

2.74.136 restored the mature mixed BODY semantic contract, but the BODY request still exposed every whole-source candidate in the proposal grid and tagged each row as either `BODY_ELIGIBLE` or `HEADER_OWNED_FORBIDDEN`. The JSON schema also still allowed every whole-source candidate ID. For qwen3:8b this created unnecessary prompt noise and left Header-owned IDs as syntactically legal output choices even though the prose prompt forbade them. Reports showed the model spending output on Header rows, overproducing section-heading classifications, and generating more rejected spans than the pre-migration mixed parser.

## Change

The architecture is unchanged:

`whole source -> fixed Header locator -> deterministic validation -> accepted Header ownership -> exact complement -> one mixed BODY LLM`

Only the BODY request surface changed:

- the full source remains visible as context;
- the structural proposal list now contains only BODY-eligible candidates, retaining their original `Cxxx` coordinates;
- Header-owned candidates are listed once in a compact exclusion list instead of repeated inline tags;
- the BODY JSON schema allows only BODY-eligible candidate IDs for `s` and `e`;
- deterministic hints still contain only BODY-eligible coordinates;
- the prompt now states explicitly that title/top-level shape alone cannot establish a section heading.

This removes impossible choices from constrained generation without changing ownership, source geometry, candidate coordinates, or the semantic BODY contract.

## Safety

- Header ownership remains exact and deterministic after grounded verification.
- BODY cannot return a Header-owned coordinate through the JSON schema.
- Full original source remains available to the model for context.
- No source is dropped if BODY classification fails.
- No `bodyStart` authority is reintroduced.

## Verification

- TypeScript typecheck passes.
- Compiled Node test suite: 527/527 passing.
