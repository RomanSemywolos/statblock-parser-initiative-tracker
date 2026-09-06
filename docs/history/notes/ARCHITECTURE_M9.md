# M9 — stub combatants

M9 adds encounter-only participants that do not require a `SavedStatblock`.

```ts
type StubCombatant = {
  formatVersion: "stub-combatant-v1";
  id: string;
  kind: "stub";
  displayName: string;
  hp: CombatHpState | null;
  armorClass: number | null;
  initiativeModifier: number;
  initiativeRoll: number | null;
  savingThrows: Record<StubAbilityKey, number | null>;
  createdAt: string;
};
```

`EncounterState.combatants` is now a `Combatant[]` union of statblock and stub instances.

Stubs deliberately do not enter the library. They are persisted only as part of the encounter and can represent heroes, NPCs, summons, guards, or creatures for which a complete statblock would be unnecessary.

All fields except the generated ID and combatant kind are user-facing optional inputs. Missing initiative behaves as modifier `+0`; missing HP disables HP controls; missing saves are shown as unavailable.

The core HP and initiative functions operate on the common combatant fields, so stubs do not create a second combat implementation.
