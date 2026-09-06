# M2 storage foundation

M2 adds the first persistence boundary without changing parser behavior.

## Contract

Application code depends on `StatblockRepository`, not IndexedDB directly:

```text
SavedStatblock / VersionedDocument
              ↓
      StatblockRepository
       ↙              ↘
Memory (tests)     IndexedDB (browser)
```

The repository owns complete `SavedStatblock` aggregates. It does not know parser candidates, annotations, reports, or source maps.

## Semantics

- `put()` is an upsert by stable statblock UUID/id.
- `get()` and `list()` return detached copies.
- `list()` is newest-updated first.
- `delete()` removes one statblock.
- `clear()` exists for tests/import-reset flows and should not be surfaced casually in product UI.
- IndexedDB is opened lazily and is browser-only.

## IndexedDB schema v1

- database: `statblock-parser`
- object store: `saved-statblocks`
- key path: `id`
- index: `updatedAt`

Future migrations must increase `databaseVersion` and keep migration logic inside the repository implementation.

## Explicit non-goals

M2 does not add:

- React;
- library UI;
- parse jobs;
- server persistence;
- synchronization;
- encounter persistence.

Those layers will consume this repository later.
