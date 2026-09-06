# Patch 2.74.213 — product interaction and layout pass

## Scope

This patch changes only the product model, persistence coordination and React presentation. The parser pipeline, source ownership and model-call architecture are unchanged.

## Behavior

- A library statblock cannot be deleted while its replacement parse job is queued, processing, or completed but not yet committed.
- Updating or autosaving a card preserves its current position in the library for the rest of the session. Newly imported cards are appended; a page reload establishes a fresh alphabetical order.
- `VersionedDocument.backup` is now the immutable parse/translation baseline. Manual and automatic edits never replace it. English reparse and Ukrainian retranslation create a new baseline.
- Existing records with a null backup migrate from their saved checkpoint. When an old rotating backup exists, migration retains that oldest available snapshot because an earlier parser result cannot be reconstructed from persisted data alone.
- Source-backed limited-use markers in the exact form `(number/word)`, including localized words, render as bounded controls. Current values live in `StatblockCombatant.limitedUses`, are independent for each encounter copy, and persist in the encounter repository.
- Card-pinned rows use the rich interactive renderer, preserving bold/italic authoring markup and limited-use controls.
- HP and AC are always visible as numeric encounter fields. Their complete source rows can independently be selected as pinned card content.
- The card controls popover closes on an outside pointer action.
- Desktop sidebars stay within the viewport and scroll independently. At narrow widths both become overlay drawers opened from thin left/right rails and dismissed through the backdrop.
- Encounter actions are ordered as add participant, start/end combat, then next turn while combat is active.
- Overlapping parse-job polling is suppressed, and immediate persistence is serialized after already-running autosaves.

## Validation

- TypeScript strict typecheck.
- Core build and complete compiled Node test suite.
- Frontend TypeScript and Vite production build.
