# Patch 2.74.58 — safe routing and nested-bullet presentation fixes

## Scope

This release contains only two conservative production fixes identified from real parse diagnostics after restoring the specialized multiline parser path. It does not add clipboard rich-text evidence and does not change the lossless ownership model.

## 1. Rak-style short table-cell rows no longer force mixed routing

The automatic router previously treated every lowercase-starting cased-script row as strong visual-wrap evidence, regardless of row length. Repeated tiny table-cell labels such as `mod` / `save` could therefore accumulate enough soft-wrap evidence to route an otherwise clean multiline statblock through the generic parser.

The router now requires a lowercase cased-script continuation row to contain at least 8 non-whitespace characters before it contributes soft-wrap evidence. Uncased-script continuation keeps its stricter existing requirements.

This is surface-geometry only: there is no vocabulary for `mod`, `save`, or any D&D field name. Existing regressions for genuinely column-wrapped prose remain mixed/generic.

## 2. Auto Style continues a proven nested bullet sequence across adjacent paragraphs

A nested option sequence could be structurally preserved but compiled into two adjacent editable paragraphs. Auto Style styled the first bullet as a nested subeffect because it followed prose inside its paragraph, while the next paragraph began with a bullet and was therefore styled as a peer feature.

Auto Style now carries a narrow presentation context across adjacent body nodes. When a paragraph visibly establishes a nested bullet sequence after its own substantive content, immediately following bullet-start paragraphs continue to receive nested subeffect styling. The context stops at headings or non-bullet paragraphs.

Separate bullet-start paragraphs with no prior nested-list introducer retain peer-feature styling.

This changes presentation markup only. It does not change parser ownership, semantic fields, source spans, facts, or source text.

## Validation

- Focused emitted tests (`parserRouting.test`, `editableDocument.test`): 65/65 passed.
- Broad emitted suite: 364 entries, 356 passed, 8 startup failures caused by unavailable sandbox `zod`/`undici`, and 0 assertion failures among runnable tests.
- Temporary emit files are excluded from the release archive.
- Full dependency-backed `npm test` / `npm run typecheck` is not claimed in this sandbox.
