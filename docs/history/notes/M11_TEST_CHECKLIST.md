# M11 manual test checklist

1. Create/edit several statblocks and pin at least one custom card field.
2. Press `Експорт`; confirm a `.json` library file is downloaded.
3. Open the JSON and confirm `formatVersion: 1` plus the expected statblock IDs.
4. Delete the local statblocks, then import the file and confirm the library is restored.
5. Press F5 and confirm the imported library remains in IndexedDB.
6. Confirm working/saved/backup and card configuration survive export/import.
7. Export immediately after editing, before the autosave debounce finishes; import elsewhere and confirm the latest working text is present.
8. Import the same file twice; entries must upsert by ID rather than duplicate.
9. Try a random text file or malformed JSON renamed to `.json`; the UI should show an error and leave the library untouched.
10. Confirm encounter combatants are not exported as part of the library backup.
