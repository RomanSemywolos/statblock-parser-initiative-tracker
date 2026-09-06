# 2.74.64 — compiler localization cleanup

- Synthetic compiler-owned labels (AC, HP, derived Initiative, derived Proficiency Bonus) now honor `CompileEditableOptions.language` for Ukrainian output using the deterministic UI glossary.
- Compiler Save-column detection no longer reads the English word `save`. It relies on grounded printed-save structure (`>= 4` printed cells), preserving the conservative fallback contract.
- The incomplete Save-column regression fixture now uses localized column labels to prove the compiler does not depend on English vocabulary.
- No parser ownership, candidate routing, evidence authority, or source preservation behavior changed.

## Product visibility and routing evaluation

- Added `PRODUCT_VISIBILITY_INVARIANT.md`, separating exact evidence reconstruction from product-visible preservation.
- Added a compiler regression proving structured ability promotion does not hide an adjacent unresolved source fragment.
- Added a table-driven routing corpus covering clean multiline, soft-wrapped mixed, collapsed singleline, tiny lowercase table cells, and localized multiline geometry.
