# v2.56.0 — stable library order, compact header controls, richer deterministic UK header translation

## UI

- Library ordering is now deterministic alphabetical ordering by the current English working name (locale-aware, case-insensitive, numeric-aware) with statblock id as the stable tie-breaker.
- Repository refresh/job sync now also applies the same alphabetical order, so creating/replacing the UK version no longer falls back to repository/update-time ordering.
- `Редагувати` and `Налаштувати картку` now live in one explicit vertical `edit-controls` stack.
- Header actions no longer use the previous fixed 350 px block. The controls are capped at 224 px and the roll zone is allowed to shrink, preventing the action buttons from running under the encounter sidebar without increasing the 112 px header height.

## M14.2 deterministic translation

Added context-safe translation where product structure already provides enough evidence:

- `size_type_alignment` now translates canonical D&D sizes, creature types/subtypes and alignments.
- Basic Ukrainian gender agreement is applied for feminine primary creature types such as `Aberration`, `Fey`, `Fiend`, and `Plant`:
  - `Large Fiend (Devil), Lawful Evil` → `Велика нечисть (диявол), законно-зла`
  - `Gargantuan Dragon (Chromatic), Chaotic Evil` → `Колосальний дракон (Chromatic), хаотично-злий`
- Speed/header movement modes: `Burrow`, `Climb`, `Fly`, `Swim`, `Walk`.
- `ft.` in structured Speed/Senses/Languages rows becomes `футів`.
- Known trait-name leads (`***Magic Resistance.***`, `***Amphibious.***`, `***Multiattack.***`, etc.) translate only in the title slot using `TRAIT_NAME`, not as global prose replacement.
- Exact `other_header` fallbacks were added for safe known labels such as `Condition Immunities`, including their condition atoms. This helps when the parser preserved the line but classified the semantic header field imperfectly.
- Damage-list conjunction `and` becomes `та` inside structured damage/condition lists.
- Mechanical `plus <protected numeric payload>` becomes `плюс`.

The broader policy remains unchanged: context-sensitive glossary lemmas are not globally replaced in prose; unresolved prose is reserved for the future MT stage.

## Validation

- Emitted Node runtime tests for `translation.test.ts` + `translationDocument.test.ts`: 18/18 passed.
- Targeted core TypeScript no-emit/no-check validation passed for the changed translation files/tests.
- Frontend `tsc --noEmit --noCheck -p frontend/tsconfig.json` passed.
- Full dependency-backed root npm test/build was not run because local `node_modules`/`tsx` are unavailable in this sandbox.
