# M11 — local-first library export/import

M11 adds the first transfer layer above local IndexedDB storage without adding accounts, sync, or server ownership of user data.

```ts
type LibraryExportV1 = {
  formatVersion: 1;
  exportedAt: string;
  statblocks: SavedStatblock[];
};
```

`serializeLibraryExport()` creates readable versioned JSON. `parseLibraryExport()` rejects invalid JSON, unsupported format versions, malformed SavedStatblock envelopes, broken version documents, and invalid card configuration before anything reaches the repository.

The React library sidebar exposes `Експорт` and `Імпорт` controls. Export uses the current React library state so a debounced working edit is still included in the backup even if its IndexedDB write has not fired yet.

Import uses repository `put()` semantics. Stable IDs are preserved; an imported statblock with the same ID replaces/upserts that local library entry. Unrelated local entries remain. Encounter state is intentionally not part of the library transfer format.

This gives the MVP three immediate properties:

- manual user backup;
- migration to another browser/device;
- a concrete transfer format that a future SyncProvider can build on.
