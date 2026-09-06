# Patch 2.50.0

Final encounter/UI polish before translation work.

## Encounter card editor

- Per-combatant card editing now includes the initiative modifier in addition to name, base HP, AC and six saving-throw modifiers.
- The edit form uses an explicit light input palette (`color-scheme: light`, light background, dark text and visible focus border) so numeric fields remain readable even when the browser/OS prefers dark form controls.
- The compact editor uses three columns for HP / AC / initiative modifier, with saving throws below.

## Transient saving-throw result on encounter cards

- A saving-throw click still records the roll in the shared roll history.
- The result is also displayed inline on the clicked save in the right-hand encounter card.
- Encounter cards now receive the global roll sequence. The inline save result is tagged with the sequence of the roll that produced it and is only rendered while that remains the most recent roll.
- Therefore any subsequent roll (initiative, another save, inline statblock dice, or the general dice roller) clears the previous encounter-card save result, matching the existing one-active-interaction behavior.

## Auto Style feature leads

- Parenthetical usage/recharge notes at the end of a printed rule name no longer count against the title-word limit.
- The accepted feature-lead length was raised conservatively to 120 characters for these cases.
- Compact counter/cost parentheticals retain bold-italic styling, e.g. `***Legendary Resistance (3/Day, or 4/Day in Lair).***`.
- Prose-like parenthetical notes beginning with a word use bold styling, e.g. `**Chromatic Wrath (Recharges after a Short or Long Rest).**`.
- Ordinary prose rejection remains in place.

## Validation performed in the sandbox

- Core production sources: `tsc --noEmit --noCheck` passed.
- Frontend TS/TSX: `tsc --noEmit --noCheck` passed.
- Runtime-compiled targeted tests: 43/43 passed (`editableDocument.test.ts` + `encounterModel.test.ts`).
- Full dependency-backed npm/Vite build was not run because this sandbox copy has no local `node_modules` / Node type package.
