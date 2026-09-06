# Patch 2.74.59 — library import/autosave coordination

## Scope

Persistence-only correctness patch. Parser semantics, candidate generation, semantic ownership, compiler behavior, and presentation styling are unchanged.

## Problem

Working-statblock edits are persisted with a delayed autosave. A library import could write a statblock with the same id while an older autosave for that id was still pending. The delayed callback could then run after the import and overwrite the explicitly imported record with stale working state.

There was also a narrower timing window where the autosave timer had already fired and its IndexedDB write was in flight. Cancelling the timer alone cannot stop such a write.

## Fix

- Added a small frontend autosave-coordination helper.
- Before writing imported statblocks, the app cancels delayed autosave timers for exactly the imported ids.
- Autosave writes are tracked per statblock id and serialized per id.
- Library import waits for any already-started autosave write for an imported id before writing the imported record.
- Autosaves for unrelated statblocks are neither cancelled nor awaited.

The resulting ordering for a colliding id is:

`older autosave (if already started) -> imported record`

so the explicit import is the final persisted write among operations that were already pending when import began.

## Tests

Added focused regression coverage for:

- cancelling only autosaves whose ids are present in the import;
- waiting for an already-started autosave of the same id;
- not waiting for unrelated autosave writes.

## Validation note

The archive does not contain installed dependencies, so full `npm test`, root typecheck, and frontend build were not executed in this environment. Run the normal dependency-backed checks locally.
