# M4 architecture — Library to Encounter

M4 introduces the first persistent encounter slice without adding combat mechanics yet.

## Product relationship

A `SavedStatblock` is a reusable library document. A `StatblockCombatant` is a lightweight encounter instance that references it by `statblockId`.

One saved statblock can therefore create any number of independent combatant IDs without copying the statblock document.

```text
SavedStatblock (Goblin)
   ├─ Combatant c1
   ├─ Combatant c2
   └─ Combatant c3
```

Future HP, initiative and other mutable combat state belong to the combatant, not the saved statblock.

## Persistence

The library remains in `statblock-parser` IndexedDB.
The encounter is persisted independently in `statblock-parser-encounter` IndexedDB.

The separate database keeps M4 migration-free and preserves the M2 repository boundary. A later storage migration may consolidate stores if there is a concrete benefit.

## Browser interaction

- click a library row: open the reusable statblock;
- drag a library row to the right sidebar: create a combatant copy;
- `+` next to a library row: same operation without drag-and-drop;
- click a combatant card: open that instance in the center;
- `×` on a combatant: remove only that instance;
- deleting a saved statblock also removes combatants that reference it, preventing orphan instances.

M4 intentionally does not implement initiative rolling, HP mutations, rounds, stubs or card customization.
