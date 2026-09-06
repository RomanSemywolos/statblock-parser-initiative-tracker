# Patch 2.74.45

## Critical localized ability-region ownership fix

A localized vertical ability table could cause deterministic ability recovery to expand its promoted `ability_scores` region backward through preceding unresolved `other_header` rows. Because `other_header` is intentionally eligible evidence for localized ability recovery, `clusterStart()` previously walked backward through those rows until it found a non-eligible semantic header. On sources whose AC/HP/Speed labels were not yet semantically classified, this could absorb those source rows into the promoted ability region. The editable compiler then omits the raw `ability_scores` block in favor of structured abilities, making the absorbed AC/HP text disappear from the product document and leaving empty required AC/HP slots.

### Fix

`clusterStart()` is now bounded by the annotation that actually contains the first grounded ability label. It cannot walk backward through unrelated unresolved metadata.

This is language-neutral:
- a single annotation containing an entire table still retains any leading column metadata inside that annotation;
- line-oriented localized tables begin exactly at the first grounded ability row;
- preceding unresolved metadata (AC, HP, Speed, custom fields, etc.) remains independently source-owned.

### Regression coverage

Added tests proving that:
- localized ability recovery starts at `Сил 28 (+9)` rather than preceding Russian metadata;
- deterministic ability promotion preserves preceding `Класс Доспеха 20`, `Хиты 297`, and `Скорость ...` annotations;
- the promoted `ability_scores` annotation does not contain those preceding rows.

No D&D/Russian vocabulary was added to production structural logic.
