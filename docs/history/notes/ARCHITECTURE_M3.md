# Architecture M3 — React shell and browser persistence

M3 is the first real product UI slice.

## Scope

- `frontend/`: Vite + React + TypeScript shell.
- Three-column desktop layout: Library / Center / Encounter placeholder.
- Browser-safe package entry: `statblock-parser-core/product`.
- `IndexedDbStatblockRepository` is instantiated in the React app.
- Library rows can be created from a deterministic development fixture, opened, and deleted.
- The center renders `EditableStatblockDocument`, not parser internals.
- The right column is intentionally only a placeholder; combatants belong to a later milestone.

## Boundary

The frontend imports only:

```ts
from "statblock-parser-core/product"
```

It does not import `parseForProduct`, Ollama, candidates, annotations, reports, or source maps.

## Manual proof for this milestone

1. Install/build the root package.
2. Install frontend dependencies.
3. Start the frontend.
4. Click `+ Тестовий`.
5. Reload the page.
6. The fixture must still be present and openable.
7. Delete it, reload again, and verify it stays deleted.

This proves the first actual browser IndexedDB round trip.
