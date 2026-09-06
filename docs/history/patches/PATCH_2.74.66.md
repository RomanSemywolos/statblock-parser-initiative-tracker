# Patch 2.74.66 — App orchestration decomposition, phase 1

This patch is intended as a behavior-preserving frontend refactor.

## Extracted persistence orchestration

`frontend/src/persistenceOrchestration.ts` now owns the timer/write-queue mechanics for:
- delayed statblock autosaves;
- per-statblock write serialization;
- import coordination with pending/in-flight autosaves;
- delayed encounter autosaves.

`App.tsx` still owns React state updates and error presentation. The persistence policy introduced in 2.74.59/60 is unchanged.

## Extracted opened-entity resolution

`frontend/src/openedEntity.ts` now owns the pure rules for:
- resolving an opened combatant;
- resolving its canonical library statblock;
- choosing the center-view document (canonical library document, snapshot fallback);
- choosing center-view card config;
- deriving combatant display names.

This preserves the 2.74.61 contract: encounter cards use their combatant snapshot, while opening a full statblock through a combatant shows the synchronized canonical library document when available.

## Scope

No parser, compiler, routing, evidence, encounter mechanics, or persistence semantics are intentionally changed.

## Extracted encounter presentation

`frontend/src/EncounterViews.tsx` now owns:
- combat HP controls;
- encounter cards;
- stub combatant full view;
- stub combatant editor.

`frontend/src/statblockUi.ts` owns shared ability labels/order and modifier formatting used by both the main statblock UI and encounter presentation.

## Extracted file transfer mechanics

`frontend/src/fileTransfers.ts` now owns browser download mechanics for library exports and parser diagnostics, plus reading/parsing a selected library import file. `App.tsx` retains user-facing error handling and the persistence/import policy.

`App.tsx` is reduced from roughly 2908 lines at the start of this cleanup to roughly 2465 lines without intentionally changing UI behavior.
