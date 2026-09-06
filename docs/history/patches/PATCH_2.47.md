# Patch 2.47.0

## Editor
- Auto Style is now a full one-shot normalization pass: it removes stale bold/italic markup, demotes incorrect heading nodes to normal paragraphs, rebuilds recognized section headings, and reapplies named-feature lead styling only when the title-shape rule matches.
- Manual edits remain authoritative after Auto Style; no background formatter was added.
- `+ Рядок хедера` inserts directly after the currently focused header row when possible instead of always appending at the end. With no row-local focus it starts the editable secondary-header area.

## Structural proposals
- Added a degenerate one-line statblock mode for clipboard/OCR sources with no useful line geometry.
- One-line mode exposes conservative identity, known compact-header, ability-table, named-rule and section-boundary coordinates before the LLM runs. These are proposal anchors only; they do not assign structural ownership.
- Tightened title-shape detection so ordinary prose sentences and fragments such as escape `DC 17)` do not become named-rule proposals.
- A short standalone heading now forces a proposal boundary at the following line, keeping heading text separate from section-wide introductory rules.
- Structural prompt now explicitly forbids merging two separately named adjacent rules while still encouraging continuation proposals to merge.

## Evaluation motivation
The v2.46.1 diagnostics showed the smart-proposal experiment was useful (especially Nabassu), but also exposed over-merging of adjacent named traits and failure on a fully one-line Marilith source. v2.47.0 treats those as representation-level errors rather than downstream semantic repairs.
