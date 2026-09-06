# Patch 2.55.0

## Library/UI
- Library ordering is now alphabetical by current English statblock name instead of `updatedAt`, so autosaves/translations no longer reshuffle cards.
- Header actions keep language controls beside a vertical Edit / Card settings stack; `Налаштувати картку` is directly below `Редагувати` without widening the header.
- Ukrainian statblock rendering/editor localizes structured ability abbreviations (`СИЛ СПР СТА ІНТ МДР ХАР`) and the dedicated `Ряткидки` label.

## M14.1–M14.2 deterministic translation
- Structured saving throws use Ukrainian ability abbreviations in the Ukrainian renderer/editor.
- Structured Skills rows translate the canonical 18 skill labels from the glossary.
- Damage vulnerability/resistance/immunity rows translate canonical damage atoms.
- Compact 2024 `Immunities` rows also translate condition atoms when damage and condition immunities share one source row.
- Condition Immunities rows translate canonical condition atoms.
- Senses translate Darkvision, Blindsight-ready vocabulary path (currently explicit Darkvision/Truesight/Passive Perception) and Languages translates Telepathy in structured context.
- Armor Class payload translates `Natural Armor` in structured context.
- Added safe mechanical phrase rules for `to hit`, `one target`, `one creature`, `escape DC`, `Failure or Success`, `Half damage`, `At will`, `Legendary Action Uses`, and all 13 canonical `X damage` phrases.
- Mechanics validation remains authoritative; `escape DC 17` becomes `СК 17 для втечі` so the DC remains recognizable as the same protected mechanic.

## Validation actually run
- Emitted JS runtime tests: translation + document translation + repository = 16/16 passed.
- Targeted core TypeScript `tsc --noEmit --noCheck` passed.
- Targeted frontend `App.tsx` TypeScript check passed.
- Full dependency-backed npm/Vite build was not run.
