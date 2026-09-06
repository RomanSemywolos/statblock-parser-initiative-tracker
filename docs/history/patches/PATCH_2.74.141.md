# 2.74.141 — Mixed BODY restored to canonical multiline-normalization architecture

## Self-audit of 2.74.140

v2.74.140 still violated the intended architecture in one important way. Although it removed the large `m/sh/f/r/sc/...` taxonomy, the mixed BODY LLM was still asked to decide whether each reconstructed block was a section heading (`h=true/false`), and mixed output was then materialized directly as BODY paragraphs/headings. That meant mixed still had a separate semantic path instead of producing the same input state consumed by multiline deterministic parsing.

The canonical requirement is stricter: mixed/singleline LLM work exists only to restore BODY into multiline-equivalent geometry. All BODY semantics after that point must be the same deterministic multiline parser used for already-multiline input.

## What changed

Mixed BODY model output is now exactly:

`{"starts":[{"s":"Cxxx"}, ...]}`

There is no `h`, `k`, `v`, or `e`. The model returns only virtual logical-line starts.

Deterministic code:

1. keeps accepted Header ownership as hard gaps;
2. inserts the first start of each contiguous BODY-owned segment;
3. turns model starts into virtual multiline logical rows without rewriting source;
4. sends those rows through the same deterministic BODY classifier used by physical multiline input.

The shared classifier now lives in one implementation path (`classifyMultilineLikeRuns`) used by both physical multiline rows and mixed reconstructed rows.

## Canonical invariant

`source -> fixed Header locator -> deterministic Header validation/evidence -> exact BODY complement -> mixed LLM restores multiline geometry -> shared deterministic multiline BODY parser -> product`

Mixed-specific intelligence is limited to deterministic mixed hints and the mixed normalization prompt. Singleline will later use the same target architecture with its own hint set/prompt.

See `CANONICAL_PARSER_ARCHITECTURE.md`.

## Verification

- TypeScript 5.8.3 `tsc --noEmit`: clean.
- Compiled Node test suite: **530/530 passed**.
- The archived Windows `node_modules` remains unsuitable for running `tsx` directly in this Linux container; tests were compiled with `tsc` and then executed with Node, as in prior audits.
