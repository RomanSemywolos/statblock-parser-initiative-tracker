# 2.71.0 — multiline geometry hardening

This patch closes the remaining gap between multiline source geometry, deterministic semantic grouping, Auto Style, and rendered/editable presentation.

## Architectural decision

No new nested product AST or duplicated `PresentationSegment[]` representation was introduced. `EditableStatblockNode.text` already carries source-backed `\n`/`\n\n` geometry losslessly while parser annotations retain semantic ownership. Duplicating the same text into a second presentation structure would create synchronization/migration/editor complexity without adding information.

The invariant is therefore strengthened instead:

- physical source line breaks remain inside body text;
- multiline semantic grouping may group several physical lines into one feature, but cannot flatten them;
- Auto Style operates line-locally and preserves blank lines;
- body rendering/editor explicitly preserve whitespace;
- top-level feature recognition at trusted multiline boundaries uses the feature-title lead, not punctuation at the very end of a potentially long copied row.

## Parser

Added `looksLikeNamedFeatureLineStart()` as a shape-only detector. A trusted physical line such as `Bite. ...` or `Tentacle. ...` can start a new feature even if the copied row does not end with a period. The detector evaluates only the short title before the first period and reuses the existing title-shape rules, so wrapped prose such as `The target ...` does not become a feature merely because it begins a line.

No feature/action names or spellcasting vocabulary were added.

## Auto Style / presentation

Auto Style now processes body paragraphs line by line. A coarse semantic feature containing several source lines degrades safely:

- `Innate Spellcasting. ...` is styled as the feature lead;
- `At will: ...`, `3/day each: ...`, etc. remain separate lines and get line-local colon styling;
- sibling title-shaped rows remain visibly separate even if semantic grouping is imperfect.

`.statblock-body-row` now has an explicit `white-space: pre-wrap` contract instead of relying only on inherited whitespace behavior. The editor already used pre-wrap; paragraph-level editor styling is explicit as well.

## Regression coverage

Added tests for:

1. Kraken-like long action rows that omit terminal punctuation (`Bite`, `Tentacle`) but have valid title leads.
2. Baphomet/Empyrean-like spellcasting continuation rows that stay inside one semantic feature.
3. Auto Style preserving both single and blank physical lines while styling each line locally.

Targeted transpile + Node test run: 29/29 passed. Changed TypeScript files also pass targeted `tsc --noEmit --noCheck`.
