# v2.35 — independent encounter copies

## Core rule

Adding a library statblock to the encounter now creates an encounter-owned snapshot.

A `statblock-combatant-v3` stores:

```ts
{
  statblockId,       // provenance only
  document,          // cloned EditableStatblockDocument
  cardConfig,        // cloned mini-card configuration
  nameOverride,      // optional per-copy display name
  hp,
  initiativeModifier,
  initiativeRoll
}
```

`statblockId` no longer means "read the current library document". It records where the combatant
came from.

Consequences:

- editing the library does not change combatants already in the encounter;
- editing combatant A does not change combatant B;
- editing a combatant does not change the library;
- a newly-added combatant snapshots the library's *current* working document and card config;
- deleting a library statblock does not delete v3 combatants that already own snapshots.

Legacy encounter-v2 / statblock-combatant-v2 entries are upgraded on application load by snapshotting
the current library source once.

## Per-copy names

A statblock combatant has `nameOverride: string | null`.

The tracker card has a rename control. For duplicate Goblins the automatic names can still be:

```text
Goblin #1
Goblin #2
```

but either copy may be renamed independently, e.g.:

```text
Сильніший
Слабший
```

Clearing the override returns to the automatic name.

## Editing encounter statblocks

The same `Редагувати` button now edits either:

- the library working document, when a library statblock is open;
- the encounter snapshot, when a statblock combatant is open;
- the stub fields, when a stub combatant is open.

Encounter document edits use a debounced encounter autosave. There is no library
saved/backup/checkpoint lifecycle for a combat copy.

Editing an encounter statblock updates its initiative modifier from that snapshot's deterministic
facts. Live HP remains encounter state and is deliberately not rewritten from edited statblock HP.

## Stub combatants

Stub combatants are `stub-combatant-v2`.

After creation the new stub:
- opens in the center;
- starts in Edit mode;
- uses the same centered `statblock-sheet` width as normal statblocks.

Its editor can change name, base HP, AC, initiative modifier and all six saves. If base HP is corrected
while the stub is still at full HP, it remains full at the new maximum; an already-damaged stub keeps
its current HP (clamped if necessary).

## Encounter/card independence

Card configuration is snapshotted together with the document. Therefore changing library card
configuration later does not silently alter existing encounter cards.
