# Patch 2.74.214 — encounter sidebar turn focus

## Scope

This patch changes only the React encounter presentation and styling. Parser behavior, encounter ordering and persisted combat state are unchanged.

## Behavior

- The right sidebar is split into a fixed setup/control stack and an independently scrolling combatant list.
- Its visible order is `Encounter`, the compact add/copy instruction, `Додати учасника`, combat status, and combat actions.
- The status reads `Готові до бою` before combat and `Раунд N` while combat is active.
- `Завершити бій` and `Далі` stay visible beside each other above the card list.
- Whenever the current combatant changes, its card is smoothly positioned at the top of the scrolling list, directly below the combat controls.
- Every card-pinned source row starts in a one-line collapsed state and has its own end control for showing the full text or collapsing it again.
- Collapsing affects layout only: rich authoring markup, dice controls and persisted limited-use controls remain mounted and interactive.

## Validation

- TypeScript strict typecheck.
- Core build and complete compiled Node test suite.
- Frontend TypeScript and Vite production build.
