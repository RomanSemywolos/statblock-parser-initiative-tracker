# v2.52.0 — M14.1 + M14.2 deterministic translation foundation

## Scope
This release starts EN → UK translation **after** product compilation. It does not translate raw source and does not add an MT model yet.

## M14.1 — mechanics protection, glossary, validation
- Added an opaque-token mechanics protector for dice expressions, DC payloads, signed bonuses, frequencies, and remaining numeric payloads.
- Tokens contain no digits, so an MT engine cannot accidentally learn/copy the protected value from the placeholder itself.
- Added deterministic restoration and a semantic validator that rejects missing/added/reordered protected mechanics and unrecovered tokens.
- DC validation recognizes both `DC 18` and Ukrainian `СК 18` as the same protected mechanic.
- Frequency payloads are protected separately from their textual frame, allowing `3/day` → `3/день` without changing the number.
- Imported all 627 rows from `dnd_en_uk_translation_glossary_classified.xlsx` into generated TypeScript data.
- `Базовий варіант` is authoritative. `Твоя правка` is intentionally ignored.
- The safe exact-glossary pass only rewrites entries classified as fixed labels/names. Morphology-sensitive TERM_LEMMA entries are exposed for lookup but are **not** blindly substituted into prose.

## M14.2 — deterministic D&D grammar
- Added rule-based translation for common statblock frames including weapon/spell attack labels, Hit/Miss, Recharge, `/day`, and parameterized `DC <n> <Ability> saving throw`.
- Added the 194 glossary rows classified as `rule-based phrase` as longest-first normalized deterministic rules.
- Rules operate around protected mechanic tokens; numbers/dice/bonuses remain outside the translation decision.
- `prepareEnglishForUkrainianTranslation()` composes the current deterministic stage:
  protect → rules → safe exact glossary → restore → validate.
- Unresolved prose is deliberately left in English for the future M14.3/M14.4 MT provider.

## Public API
New product/core exports:
- `protectTranslationMechanics`
- `restoreTranslationMechanics`
- `validateTranslationMechanics`
- `TRANSLATION_GLOSSARY`
- `findGlossaryMatches`
- `glossaryEntry`
- `applyExactGlossary`
- `applyDndTranslationRules`
- `prepareEnglishForUkrainianTranslation`

## Verification
- Translation targeted runtime tests: 8/8 passed.
- All `src/*.ts` passed `tsc --noEmit --noCheck`.
- Frontend TS/TSX passed `tsc --noEmit --noCheck`.
- Full dependency-backed npm/Vite test/build was not run in the sandbox.
