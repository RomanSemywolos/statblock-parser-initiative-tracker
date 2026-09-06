# Patch 2.74.9 — source-aware ability recovery without transport ownership duplication

## Why
v2.74.8 proved the Aspect of Tiamat vertical ability block early in `candidateTransport`. That fixed the symptom but duplicated an older architectural mechanism: `abilityTableResolver` + `promoteRecoveredAbilityRegion` already own constraint-based ability recovery.

The real gap was narrower. Direct candidate transport intentionally omits `unclassified` runs from semantic annotations. The existing resolver only inspected eligible header annotations, so a mechanically complete ability block could become invisible to recovery if some of its label/value candidates were left unclassified by the model.

## Change
- Removed the v2.74.8 vertical-ability detector from `headerClassifier`.
- Removed the v2.74.8 ability-interval ownership override from `candidateTransport`.
- Added a source-only region probe inside `abilityTableResolver`.
  - It is bounded to the header envelope (before the first body annotation).
  - It recognizes only a complete canonical interleaved STR→DEX→CON→INT→WIS→CHA block.
  - Every printed modifier must equal the modifier derived from its score.
  - Multiple matching regions => abstain.
  - The probe returns only an exact source region; it does not create ability facts.
- `headerFacts` promotes that proven region to one `ability_scores` annotation only when the ordinary annotation-based resolver cannot already prove a complete table.
- After promotion, the existing layout-independent `resolveAbilityTableFromHeader` runs again and remains the sole authority for ability facts and provenance.

## Architectural effect
Evidence may inspect raw lossless source without semantic ownership. Semantic ownership is created only after deterministic proof. This preserves direct-parser flexibility and safe degradation while eliminating a duplicate ownership path.

## Regression coverage
- Aspect-of-Tiamat-style canonical vertical block is recovered even when model ownership omits the whole ability region.
- Inconsistent printed modifier causes source-only recovery to abstain.
- Existing horizontal/localized/fragmented ability resolver paths are unchanged.
