# Patch 2.74.60 — autosave coordination integration fix

This patch fixes integration mistakes in 2.74.59 without changing the persistence behavior introduced there.

## Changes

- Moved the generic autosave-coordination helper into the core `src/` tree so the existing root TypeScript/test configuration can compile and execute its regression tests.
- Re-exported the helper through the product/core entry points and updated the frontend to consume it from `statblock-parser-core/product`.
- Kept the existing regression tests under `src/`, now importing the helper inside the configured `rootDir`.
- Synchronized the runtime parser version with package metadata at `2.74.60`.

## Production behavior

No persistence semantics changed relative to 2.74.59. Library import still cancels pending autosaves for imported IDs and waits for already-started autosave writes of those same IDs before writing imported records.
