# v2.68.0 — single-line deterministic closure + import-local parser mode

## Single-line parser

- Added sequence-confirmed numbered/lettered hierarchy markers. A naked numeric sentence ending such as `reduced to 0. Gaze.` is no longer promoted to list structure merely because it matches `number + period`.
- The dense pre-header identity lattice is now created only when a real deterministic header anchor exists; headerless prose no longer receives identity-token noise across the whole document.
- Added single-line-only deterministic compact-header interval enforcement in direct candidate transport. Source-proven header starts split coarse model spans and receive their proven header field semantics without changing universal mode.
- Added a single-line identity-prefix closure invariant: when exactly one size/type/alignment span is followed only by unclassified source before the first proven header field, that contiguous orphan tail is retained inside the identity span. This is position-based and does not use alignment vocabulary.
- Universal/generic transport behavior remains unchanged.

## Product UI

- Parser mode selection moved out of Settings and into the statblock import/input panel.
- Each submitted import now uses the mode currently selected beside the source text (`Auto`, `Multiline`, `Single-line`, `Universal`).
- The legacy persisted `parserMode` setting remains in the data model for compatibility/migration, but the product import flow no longer reads it.

## Regression coverage

- Added a collapsed-list regression proving that `0. Gaze.` is not a list marker while `1. / 2. / 3.` remains nested hierarchy evidence.
- Added a direct-transport regression proving identity-prefix closure and deterministic AC / HP / Speed interval splitting.
