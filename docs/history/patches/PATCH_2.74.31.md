# Patch 2.74.31

Small structural/presentation corrections from broad statblock testing.

- Auto Style now treats a compact `Label:` immediately after a section heading as section-wide rules metadata and renders that lead bold. The same compact labels inside an already-started feature remain italic. This fixes modern `Legendary Action Uses:` presentation without naming that label in the formatter.
- Generic/mixed candidate enrichment now exposes compact source-visible `Label:` rows at physical line starts as candidate coordinates even when the universal body lattice treated the row as a likely wrap. This is proposal-only and assigns no semantics.
- Generic/mixed candidate transport now keeps high-confidence mechanical continuation rows (`Hit:`, saving-throw resolution labels, etc.) inside an adjacent preceding named feature. The transport repair is intentionally narrower than the hint channel and does not absorb ordinary effect prose.
- The deterministic mechanical-continuation hint now recognizes a complete named attack row as a valid preceding feature, not only a standalone title or a row ending directly at `Attack:`.
- Trusted multiline structural classification tolerates a copied missing space between a title terminator and immediately-following prose (`Fling.The ...`) when the row begins with independently title-shaped text. Only the structural view is repaired; source text is unchanged.
- Added regression coverage for section-rules colon styling, mixed `Hit:` ownership, and multiline sibling actions with missing post-title spaces.
