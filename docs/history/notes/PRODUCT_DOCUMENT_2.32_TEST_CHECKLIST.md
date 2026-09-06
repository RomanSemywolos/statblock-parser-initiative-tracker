# v2.32 manual test checklist

## Install/build

```bash
npm install
npm run typecheck
npm test
npm run build
npm run build:frontend
npm run dev:product
```

## Fresh import

1. Import a real complex statblock.
2. Confirm the central header is rendered as name/subtitle, header rows, ability table, save row,
   remaining header rows, then body.
3. Confirm AC/HP/Speed/Skills/Resistances/etc. are not shown as parser block boxes.
4. Confirm derived Proficiency Bonus is present when the parser knows it even if it was not printed.

## Authoring

1. Enter Edit mode.
2. Put the caret in an action and press Enter.
3. Confirm a new paragraph appears and survives F5.
4. Put the caret at the start of that paragraph and press Backspace.
5. Confirm it rejoins the previous paragraph and survives F5.
6. Add a paragraph with `+ Абзац`, write new text, save/reload.
7. Toggle it to a heading with H.
8. Use B/I and confirm formatting is visible both in editor and normal renderer.
9. Add a header row and confirm it survives reload.

## Structured header editing

1. Change AC and confirm library/encounter AC updates.
2. Change DEX score/modifier and confirm initiative fallback follows the modifier.
3. Change a printed save independently and confirm it remains independent afterward.
4. Confirm all six ability/check and save modifiers remain clickable.

## Migration

Test with a browser profile that already contains v2.31 SavedStatblocks.

1. Start v2.32 without clearing IndexedDB.
2. Confirm old statblocks open automatically.
3. Confirm features/headings and their text are preserved.
4. Confirm old combatants still reference the same statblock IDs.
5. Confirm custom card feature references still render.
6. If an old card selected the ability-table block, confirm it appears through `builtin-abilities`.
7. Reload again to confirm migrated v2 records were persisted.

## Export/import

1. Export the library and confirm JSON `formatVersion` is 2.
2. Re-import it.
3. Import an old formatVersion 1 library backup and confirm it migrates.

## Parser boundary

Confirm the browser-facing product declarations contain none of:

- `LosslessStatblockDocument`
- `CompiledAnnotation`
- candidates
- parser source spans
- parser block roles
