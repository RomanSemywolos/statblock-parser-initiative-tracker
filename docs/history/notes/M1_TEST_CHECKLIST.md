# M1 test checklist

M1 is deliberately a domain-only milestone. There is no IndexedDB or React UI yet.

## Automated

```bash
npm install
npm run typecheck
npm test
npm run build
```

The build emits `.d.ts` declarations. `dist/productModel.d.ts` should not import parser-internal `domain.ts`.

## Manual/domain smoke test

The expected lifecycle is:

1. Parse/compile an English `EditableStatblockDocument`.
2. Call `createSavedStatblock(document, { parserVersion })`.
3. Verify `working` and `saved` are equal in value but independent snapshots and `backup` is empty.
4. Modify a copy of the editable document and call `updateWorkingDocument`.
   - `working` changes.
   - `saved` does not.
5. Call `saveWorkingDocument`.
   - new `saved` equals `working`;
   - old `saved` becomes the only `backup`.
6. Modify `working` again and call `revertWorkingToSaved`.
   - `working` returns to `saved`;
   - `backup` is unchanged.
7. Call `restoreBackupToWorking`.
   - backup is loaded only into `working`;
   - current explicit `saved` remains untouched until the user explicitly saves again.

## M1 invariants

- parser internals are not present in `SavedStatblock`;
- English version always exists;
- Ukrainian version is optional and independent;
- autosave means updating `working`, not creating a checkpoint;
- explicit save creates exactly one previous checkpoint;
- default card preferences select name, AC and all saves;
- encounter HP and initiative are intentionally not stored in `CardConfig`;
- every persistent aggregate has a stable ID and timestamps ready for IndexedDB/sync later.
