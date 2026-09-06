# Patch 2.70.0 — multiline physical-line lattice + parser provenance badge

## Multiline parser

- Added `enrichMultilineCandidates()`, used only after routing has selected `multiline`.
- The multiline lattice now exposes every non-empty physical line start and deliberately drops inline colon/sentence candidates that can truncate a complete physical line.
- Deterministic body splitting therefore sees a whole source line when deciding whether it starts a sibling feature.
- Structural recognition strips presentation-only Markdown markers for classification only; source spans remain byte-exact.
- No feature-name vocabulary was added. Feature boundaries still use title/geometry shape, while continuation lines remain inside their owning feature.
- This fixes the general failure mode where punctuation inside `Bite`/`Tentacle` hid the next line boundary, and preserves multiline continuations such as `At will:` / `1/day each:` inside one semantic feature.

## Temporary parser diagnostics

- `SavedStatblock` now records optional import structure provenance: `multiline`, `singleline`, or `mixed`.
- Parse-job results propagate the actual selected parser strategy into saved library entries (`generic` is surfaced as `mixed`).
- Library cards show a small temporary Ukrainian diagnostic badge: `БАГАТОРЯДКОВИЙ`, `ОДНОРЯДКОВИЙ`, or `ЗМІШАНИЙ`.
- Old saved entries migrate with `importedParserStructure: null`.

## Verification

- 4/4 multiline deterministic regression tests passed, including Kraken-style Markdown/bullet features and multiline spell-list continuation geometry.
- 5/5 saved-statblock tests passed.
- 3/3 library-transfer tests passed.
- Targeted production TypeScript emit/no-check completed for changed core files and App.tsx.
