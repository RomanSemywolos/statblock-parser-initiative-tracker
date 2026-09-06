# Patch 2.74.209 — singleline Header prompt de-anchoring

## Why this is intentionally small

The live 2.74.208 qwen3:8b corpus was good enough to stop changing the deterministic Header architecture. The six semantic ability-label anchors plus deterministic mechanical closure behaved well, including the 2024 Tarrasque layout. The remaining failures were primarily model coordinate-selection errors: truncated `sta`, incomplete or neighboring scalar spans, false `init` selections on some sources without printed Initiative, and unstable CR/PB selections.

The 2.74.208 singleline prompt also contained three few-shot examples with literal `Cxxx` numbers. Those numbers are arbitrary per source and have no transferable semantic meaning. In the live corpus, at least one repeated Aspect of Tiamat error selected CR coordinates numerically close to the hard-coded 2024 example rather than to the source CR location. That does not prove causation, but it is enough to justify one low-risk prompt hygiene experiment before declaring the remaining behavior a small-model limitation.

## Change

Only `SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT` changes.

Removed:

- all three hard-coded numeric-coordinate few-shot examples;
- source-independent sample `Cxxx` ranges that a small model could copy as positional patterns.

Kept as coordinate-free guidance:

- classic/interleaved ability shape;
- separate six-label-row shape;
- 2024 score/modifier/save-cell shape;
- the rule that internal 2024 save cells are not a separate `sv` field.

Added one compact final self-check:

1. copy every coordinate from the current annotated source rather than from a remembered pattern;
2. scalar spans must begin on the first printed label token and include the printed value and attached material;
3. `sta` must include the entire printed classification/alignment phrase and not stop at subtype punctuation/comma;
4. `init` is returned only when a separate Initiative field is explicitly printed;
5. ability anchors should point to printed labels rather than numeric cells;
6. uncertain facts are omitted rather than guessed.

## Explicit non-changes

No change to:

- singleline deterministic coordinate grounding;
- the one-candidate-left ability-anchor repair;
- ability mechanical closure;
- scalar-prefix ownership carve;
- Header ownership or BODY complement;
- CR/PB/STA deterministic authority;
- mixed baseline 2.74.202;
- multiline;
- singleline BODY prompt, candidates, starts schema or shared deterministic BODY parser.

In particular, this patch does **not** add STA neighbor expansion, CR/PB fuzzy recovery, language dictionaries, `bodyStart`, or model-specific deterministic repairs.

## Acceptance rule

Run the same repeated five-case singleline corpus on qwen3:8b.

Promote 2.74.209 as the practical singleline Header baseline if it preserves the 2.74.208 ability/Tarrasque gains and materially reduces the remaining scalar/STA coordinate mistakes without new regressions.

If it does not, stop Header-specific qwen3:8b tuning. Document the remaining misses as a current weak-model limitation and proceed to singleline BODY normalization. A stronger LLM is expected to improve semantic coordinate selection without changing the parser authority split.
