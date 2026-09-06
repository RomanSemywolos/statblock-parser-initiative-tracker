# 2.74.162 — shared-row Initiative presentation repair

Scope: editable/product presentation only. No parser, BODY, ownership, model-prompt, candidate, or language-semantic changes.

## Change

Printed Initiative now renders with the canonical UI label plus the source tail beginning at the first signed numeric token matching the already-proven Initiative modifier.

Example:

- source/evidence: `AC 17 Initiative +7 (17)`
- AC product row: `Armor Class 17 Initiative +7 (17)` (unchanged)
- Initiative product row: `Initiative +7 (17)`

The full original source span remains in Evidence. AC deliberately keeps its existing suffix-preserving behavior so mechanically meaningful qualifiers such as `AC 23 (natural armor; 25 versus ranged attacks)` are not discarded.

An ambiguous repeated matching signed value may produce an over-wide Initiative tail; this is intentionally accepted rather than adding language-specific parsing. The structured modifier remains authoritative.

## Regression coverage

Added tests for the normal shared AC/Initiative row and for the accepted repeated-signed-value ambiguity.
