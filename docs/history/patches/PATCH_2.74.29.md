# Patch 2.74.29

Focused audit fixes while parser stabilization continues.

## Fixed

- Active encounter deletion now advances from the removed current combatant to the next surviving combatant in the old initiative order. Wrapping from the end advances the round.
- Removing a statblock from the Library also removes all of its statblock combatants from the encounter; stubs remain untouched.
- Editable Initiative is row-owned after document creation. A DEX-derived Initiative row is created initially, but later DEX edits no longer silently change Initiative. Older editable-v2 documents with only an Initiative fact are migrated to an explicit row.
- Editable proficiency bonus is row-owned after document creation. Removing/clearing the row now yields `null` instead of resurrecting a stale fact. Older editable-v2 documents with only a PB fact are migrated to an explicit row.
- Successful parse jobs no longer fail merely because diagnostics persistence fails; diagnostics are best-effort on success as well as failure.
- Library sorting now uses one shared comparator in repository and React UI.
- Removed unreachable `frontend/src/fixture.ts` demo fixture.
- Updated stale multiline regression: sentence-shaped same-line pseudo titles are now rejected by candidate generation itself, so the test asserts the semantic invariant instead of requiring the obsolete candidate to exist.
- Synchronized package/runtime/lockfile version to 2.74.29.

## Deferred

See `AUDIT_FOLLOWUPS_2.74.29.md` for intentionally deferred audit items.
