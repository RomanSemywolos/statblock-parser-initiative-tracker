# 2.74.140 — Mixed BODY minimal boundary contract

> Superseded note: v2.74.141 removes the remaining `h` semantic bit and routes normalized mixed BODY through the shared deterministic multiline parser. See `CANONICAL_PARSER_ARCHITECTURE.md`.

## Why

The ownership-first migration accidentally changed the mixed BODY task from the original structural question (“where does one logical block end and the next begin?”) into a richer semantic classification task (`m/sh/f/r/sc/sup/u`) with independent start/end spans. That extra task was not required by the product and degraded qwen3:8b quality. Independent spans also allowed contradictory model output such as `sh C037` together with `f C037-C044`, which then produced deterministic overlap rejection and large unclassified gaps.

## What changed

Mixed BODY now has one model contract only:

- return `starts`;
- each item is `{s: "Cxxx", h: boolean}`;
- `s` is the start of a new logical BODY block;
- `h=true` only for an actually printed section heading; all other logical blocks use `h=false`;
- there is no `e` end coordinate;
- there is no `k` semantic subtype and no section code.

Deterministic code constructs end coordinates from the next start inside the same contiguous BODY-owned segment. Header gaps terminate segments. The first coordinate of each BODY segment is inserted deterministically if the model does not return it. Therefore overlaps are impossible by representation, and a missed boundary merely creates a coarser paragraph instead of deleting source or creating an unclassified hole.

Ordinary mixed BODY blocks are transported as neutral `section_content` with `section:null`. Printed headings are transported as `section_heading` with `section:null`. The product already renders the former as paragraphs and the latter as headings, so no user-visible capability depends on `feature`, `section_rules`, `metadata`, or similar mixed LLM classifications.

## What did not change

- fixed Header contract and verifier;
- exact Header source ownership;
- BODY-only source view with hard Header gaps;
- original `Cxxx` coordinates;
- source reconstruction/losslessness;
- multiline mode;
- singleline mode (deferred; it will later receive the same simplification);
- no global `bodyStart` was restored.

## Tests

Added direct tests that the mixed schema exposes only `s+h`, contains no end/type/section fields, and that starts deterministically produce a complete non-overlapping partition across multiple BODY ownership segments. Duplicate starts collapse to one boundary instead of becoming competing spans.

Full compiled suite: **531/531 passed**. Global TypeScript 5.8.3 typecheck: clean.
