# v2.57.0

## UI/settings
- Added a persistent `defaultStatblockLanguage` app setting (`en` / `uk`).
- Settings UI now exposes “Мова статблоків за замовчуванням”.
- Opening a library statblock uses the preferred language when that version exists, otherwise safely falls back to EN.
- Existing v1 settings without the field are normalized to EN and persisted without changing the settings format version.
- Added vertical breathing room above the `Редагувати` / `Налаштувати картку` control stack without increasing the workspace header height.

## Deterministic translation
- Expanded type-line alignment handling for `Unaligned`, `Any Alignment`, `Any Non-Good Alignment`, `Any Non-Evil Alignment`, and common `Any <axis> Alignment` forms.
- Added safe subtype localization for common parenthetical creature tags including `Chromatic`.
- Added structured language-field localization for common D&D language names and `All`.
- Challenge rows now safely localize simple `or ... in lair` fragments.

## Validation
- Added settings regression coverage for default language persistence.
- Added translation regression coverage for subtype/language/challenge localization and non-nine-grid alignment forms.
