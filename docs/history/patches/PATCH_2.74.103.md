# Patch 2.74.103 — collapsible header evidence

## Scope

Adds the first product-level Evidence surface without changing the current placement of `size_type_alignment` and without broadening deterministic extraction beyond abilities and saving throws.

## Product model

`EditableStatblockHeader` may now carry `evidence` entries. Each entry stores the exact imported source text plus the structured fields it supported (`ability_scores`, `saving_throws`). Older editable-v2 documents migrate with an empty evidence list.

Evidence is an import provenance snapshot. Manual edits to the structured header do not rewrite the original evidence.

## Compiler

For a complete six-ability result, the compiler records the exact grounded ability-table source span. When printed saves are structurally extracted, their exact grounded source is recorded as well. A shared ability/save table is represented once and marked as supporting both fields.

Evidence-owned ability/save source is omitted from ordinary body rendering even if an incorrect header/body boundary left that source BODY-owned. This changes presentation ownership only; the lossless parser document and raw source are untouched.

No other header fields are moved into Evidence in this patch. AC/HP/Initiative/Challenge/PB continue using their current full-row presentation. `size_type_alignment` remains in its current subtitle slot pending the separate design decision.

## UI

A separator is rendered under the current header. When evidence exists, a right-aligned `Evidence` / `Докази` toggle opens a read-only panel with a slightly different background. The panel is collapsed by default and shows the exact imported source text with physical line breaks preserved.

The same evidence surface is available in both the normal statblock view and the editor.

## Regression coverage

Added compiler regressions asserting that:

- exact ability and saving-throw source is preserved in Evidence;
- those source rows are not duplicated in ordinary body content;
- evidence remains de-duplicated from BODY even when structural ownership is wrong.
