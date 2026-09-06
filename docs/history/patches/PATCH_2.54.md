# v2.54.0 — translation test UI polish + conservative deterministic translation

## UI
- Reorganized language controls into a compact first row inside the existing workspace action area; EN/UK and translate/retranslate no longer compete horizontally with editor/card buttons.
- Translation action labels are compact (`→ UK`, `↻ UK`).
- Library names can wrap to two lines; UK/dirty state is rendered as a separate metadata row so long names cannot hide the UK marker.

## M14.1–14.2 corrections from first real partial-translation pass
- Global exact glossary replacement is now deliberately limited to truly UI-safe exact entries. Context-sensitive `ACTION_LABEL`, `TRAIT_NAME`, `SKILL_LABEL`, and structural atoms are not blindly substituted inside prose.
- Generic imported `RULE_PATTERN` entries must contain at least three words. This prevents one/two-word atoms such as `wall`, `ground`, `attack hits` from creating mixed-language grammatical corruption (`стіна of fire`, `this атака влучає`, etc.).
- Added parameterized deterministic support for 2024 `Ability Saving Throw: DC N`, `Melee/Ranged Attack Roll:`, `Failure:`, `Success:`, `reach N ft.`, and `within N feet`.
- Known header labels are localized from already-established `ProductHeaderField` ownership rather than guessed from prose: AC/HP/Initiative/Speed/saves/skills/resistances/immunities/senses/languages/CR/PB etc.
- This remains intentionally partial translation. Context-sensitive terminology and ordinary prose stay English until the MT/morphology stage instead of being replaced unsafely.

## Checks
- `translation.test` + `translationDocument.test`: 12/12 runtime tests passed from emitted JS.
- Changed production translation TS files and `frontend/src/App.tsx` passed targeted `tsc --noEmit --noCheck`.
- Test emit reports missing sandbox Node type declarations, but emitted JS executed successfully.
- Full dependency-backed npm/Vite build was not run.
