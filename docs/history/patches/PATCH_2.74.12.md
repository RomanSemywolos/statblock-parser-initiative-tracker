# Patch 2.74.12 — source-grounded header label styling

## Goal
Remove duplicate English header-label knowledge from normal header presentation while preserving the exact label printed by the source.

## Changes
- Added `findDeterministicHeaderLabel(text, expectedField)` to `headerClassifier.ts`.
  - It reuses the classifier's existing canonical header vocabulary.
  - It returns the exact label spelling/alias printed at the start of the proven field (`AC`, `Armor Class`, `Resistances`, `Damage Resistances`, `Immunities`, etc.).
  - It does not canonicalize the source label.
- Refactored `applyEditableAutoStyle()` so English parser-created header rows ask the semantic classifier for that exact printed label and write authoring markup around it.
  - `Resistances Cold, Fire` -> `**Resistances** Cold, Fire`
  - `Immunities Poison` -> `**Immunities** Poison`
  - `Damage Resistances Acid` -> `**Damage Resistances** Acid`
- Kept only a localized UA/RU Auto Style fallback for labels the English semantic classifier intentionally does not classify. This avoids regressing existing localization behavior.
- Refactored the frontend header splitter to prefer structural authoring markup (`**printed label** value`) instead of rediscovering vocabulary from `row.field`.
- The old canonical UI label map remains only as a compatibility fallback for previously saved unstyled documents.
- Editing a value now preserves the grounded bold source-label markup instead of silently dropping it.

## Architecture
Semantic vocabulary has one normal owner: `headerClassifier`. Presentation consumes the exact label boundary already established by Auto Style. The renderer no longer needs to know that `Resistances` is an alias of `Damage Resistances` for new imports.

No product schema or persistence migration was added.

## Validation
- `headerClassifier.ts` strict isolated typecheck: PASS.
- `editableDocument.ts` + product model + classifier strict isolated typecheck: PASS.
- Runtime smoke: `Resistances` and `Immunities` are returned as exact source labels and Auto Style emits the expected bold markup: PASS.
- Added regressions for exact alias preservation (`Resistances`, `Damage Resistances`, `Immunities`, `AC`) and Auto Style behavior.
- Full repository suite remains unavailable in this environment because dependencies/node_modules are not installed.
