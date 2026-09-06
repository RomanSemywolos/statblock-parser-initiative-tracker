# v2.46.0 — smart structural proposals

## Why
The structural LLM was being shown an overly fine candidate grid. Physical PDF line wraps, `Failure:`/`Success:` clauses and ordinary sentence boundaries became visually equivalent to real statblock block boundaries. Small local models therefore tended to mirror transport segmentation instead of reconstructing logical source blocks.

## Candidate proposal experiment
`createSourceCandidates()` remains language-neutral and lossless, but candidates are now *preferred structural proposal boundaries* rather than an atomic line/sentence grid.

- Before a credible named-rule shape appears, physical line starts remain available so compact header fields and irregular ability tables keep precise coordinates.
- After a title-like named-rule start, ordinary wrapped lines stop creating candidates.
- Paragraph starts remain available as conservative fallback boundaries.
- Short standalone lines remain candidates so printed section headings can be grounded without a language dictionary.
- A title-like start is shape-only: uppercase initial, compact phrase ending in a real period delimiter, with conservative punctuation/length checks. Parenthetical qualifiers such as `(Recharge 5–6)` or `(Costs 2 Actions)` are allowed.
- Inline sentence boundaries create a proposal only when the following text itself looks like a named title followed by more same-line content.
- Colons inside body resolution (`Hit:`, `Failure:`, `Success:`, spell-frequency sublabels) no longer create top-level proposal boundaries.
- No D&D field names or section-heading vocabulary were added to candidate generation.

The structural prompt now describes these Cxxx entries as deterministic structural proposals produced from surface shape, while explicitly retaining LLM ownership of semantics and permission to merge adjacent proposals.

## Real-corpus transport comparison
Using the exact five raw sources from the latest v2.45 diagnostics, proposal counts changed without touching raw source:

- Aspect of Tiamat: 80 → 44
- Aboleth: 69 → 33
- Nabassu Fledgling: 62 → 22
- Zariel: 113 → 71 (the vertical ability table intentionally remains fine-grained)
- Astral Dreadnought: 83 → 43

For Nabassu, `Magic Resistance`, `Banished From the Abyss`, and `Draining Gaze` each become one proposal containing their wrapped prose; `saving throws against...` and other physical wraps are no longer independent candidates. For Aboleth, `Consume Memories` keeps its Saving Throw / Failure / Success resolution inside one proposal.

## Auto Style
The one-shot feature-lead formatter now requires the first letter of the candidate lead to be uppercase. Lowercase prose such as `saving throws against spells...` is not automatically bold-italicized. Auto Style remains explicit and never fights later human edits.

## Validation run in this environment
- emitted targeted `sourceCandidates` + `editableDocument` tests: 27/27 passed;
- core TypeScript syntax/type-shape transpilation with `--noCheck`: passed;
- frontend TS/TSX syntax/type-shape transpilation with `--noCheck`: passed;
- exact five-source proposal-count comparison run against v2.45 generator: passed.

A full dependency-backed `npm test` / Vite build was not run in this sandbox.
