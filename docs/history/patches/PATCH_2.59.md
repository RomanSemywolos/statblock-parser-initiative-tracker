# Patch 2.59 — close standardized statblock vocabularies

## Goal
Finish the safe closed-vocabulary part of M14.2 before introducing MT. Standardized statblock labels and enumerated payloads should be translated deterministically; open prose remains unresolved for M14.3.

## Research basis
- SRD 5.2 language tables: current Standard and Rare languages, including Primordial dialects.
- SRD 5.2 monster/rules glossary: the four standard special senses used in statblocks.
- 2025 Monster Manual habitat index: the twelve natural habitat categories.
- SRD 5.2 equipment table: standard armor names that can appear as AC descriptors.
- Existing classified EN→UK glossary remains authoritative wherever it already defines a Ukrainian term.

## Changes
- Header labels now use `UI_EXACT` glossary values instead of drifting hardcoded alternatives. In particular:
  - `Armor Class` → `Клас броні`
  - `Damage Vulnerabilities` → `Вразливості`
  - `Damage Resistances` → `Опори до шкоди`
  - `Challenge Rating` → `Небезпека`
- Semantic section headings now also resolve through `UI_EXACT` glossary entries, with explicit fallbacks only as a safety net.
- Senses now cover `Blindsight`, `Darkvision`, `Tremorsense`, `Truesight`, and `Passive Perception`, taking the Ukrainian forms from `TERM_LEMMA` when available.
- Speed payloads now translate `hover` using the glossary term `зависання`.
- Languages now cover the SRD 5.2 Standard/Rare sets plus the four Primordial dialects and `None`:
  `Common Sign Language`, `Druidic`, `Thieves’ Cant`, `Aquan`, `Auran`, `Ignan`, `Terran` were added to the previously supported set.
- Habitat now translates the complete twelve-category 2025 Monster Manual natural-habitat list plus `Any`.
- AC descriptors now translate `Natural Armor` and the complete SRD 5.2 mundane armor/shield list.
- Added regression coverage for all of the above.

## Deliberate boundary
Creature tags/subtypes are not a closed universal vocabulary across all 5e books and third-party material. Existing known tags continue to translate deterministically; unknown tags remain untouched for later MT/manual handling rather than being guessed.

`Habitat` itself is not present in the classified glossary, so the existing product term `Середовище` remains the explicit fallback. Newly researched closed-list values that are absent from the generated glossary are kept in the structured document adapter rather than hand-editing `translationGlossaryData.ts` (which is generated and marked do-not-edit).
