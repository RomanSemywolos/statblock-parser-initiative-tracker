# Patch 2.74.131 — single-line boundary/classification split

## Purpose

Test the architecture suggested by the 2.74.130 corpus: keep whole-source transition segmentation, but remove taxonomy from the boundary-finding task.

## Production path

For `singleline` only:

1. The existing universal header/card extraction runs independently.
2. One whole-source structural LLM call sees the complete collapsed source plus sparse deterministic shape/address hints.
3. That call returns only `{"starts":["Cxxx", ...]}`: starts of new non-metadata top-level logical blocks. It does not return `f/sh/r/...`, section identity, or end coordinates.
4. Starts inside already accepted Header ownership are rejected deterministically.
5. Deterministic code freezes each accepted start to the source immediately before the next accepted start (or EOF). No gap/overlap can be introduced by the classifier.
6. A second LLM call receives the fixed `Bxxx` blocks and classifies each as `sh/r/f/sc/sup/u`; `sh` may carry the existing section code. This call cannot move or alter boundaries.
7. Missing or invalid block classifications become `u` for that already-fixed block; source is preserved.

Mixed and multiline paths are unchanged. The legacy single-line transition schema remains in code for compatibility/tests but is no longer the production single-line structural call.

## Diagnostics

`bodyStructure` now records the boundary-only request/result in the existing fields and, when run, adds `classificationRequest`, `classificationRawModelContent`, `classificationElapsedSeconds`, and `classificationPerformance`. Routing emits `singleline_whole_source_boundaries_then_classification`.

## Validation

- `npm run typecheck`
- `npm run build`
- `node --test dist/*.test.js`

Expected regression count for this patch: 521 tests.
