# Patch 2.74.13

## Single-line internal lists

Collapsed body presentation now exposes sequential list items as presentation rows even when the raw source is one physical line. The change reuses the same source-grounded sequence proof (`1 -> 2 -> 3`, `A -> B -> C`) already used by parser boundary evidence. A lone numeric fragment is not enough.

The shared raw/inline list-sequence primitive now lives in `listSequence.ts`, so parser evidence, single-line enrichment, and presentation reuse a neutral structural helper rather than importing one layer from another. Raw source, source-map coordinates, and semantic ownership are unchanged.

## Punctuated feature titles in mixed input

Collapsed title evidence remains conservative. A period is still the ordinary feature-title terminator. `!` and `?` are accepted only when the source immediately follows the title with an emphasized parenthetical qualifier, e.g. `Tally Ho! **(Recharge 5–6)**`. The detector knows only formatting/shape and does not know vocabulary such as `Recharge`.

The surface-title proof is shared by candidate generation and boundary-strength evaluation through `titleBoundaryShape.ts`, so a source-proven candidate can safely split a coarse mixed/generic model-owned feature run. Ordinary exclamation prose without the emphasized qualifier is not promoted by this rule.

## Validation

- presentation/source-candidate compiled regression suite: 24/24 passed
- new targeted regressions: 4/4 passed
- exact mixed runtime smoke: coarse `Singing Longbow ... Tally Ho!` feature run splits at `Tally Ho!`
- dependency-less candidateReconciler run still shows the same 10 pre-existing baseline failures as v2.74.12; no additional failures
- full project typecheck remains unavailable in this environment because `node_modules`/`zod` are absent
