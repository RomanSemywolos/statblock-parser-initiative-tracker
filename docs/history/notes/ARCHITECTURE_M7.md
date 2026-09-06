# M7 — persistent combat HP

M7 adds the first mutable combat overlay to encounter instances. HP belongs to `StatblockCombatant`, not to `SavedStatblock`.

## Model

```ts
type CombatHpState = {
  baseMax: number;
  current: number;
  temp: number;
  maxModifier: number;
};
```

A new combatant captures the statblock's current `hitPointMaximum` as `baseMax`. Later library edits do not silently rewrite an encounter instance's combat state.

Combatants whose source has no structured maximum HP use `hp: null`.

## Deterministic rules

- damage consumes temporary HP first, then current HP;
- current HP never falls below 0;
- healing cannot exceed `baseMax + maxModifier`;
- temporary HP does not stack: granting temp HP keeps the higher value;
- changing maximum HP adds a signed delta to `maxModifier` and clamps current HP if the effective maximum falls below it;
- effective maximum never falls below 0;
- reset restores `current = baseMax`, `temp = 0`, `maxModifier = 0`.

All HP operations are pure functions in `encounterModel.ts`; they do not touch the saved statblock or parser layer.

## Persistence

HP is stored inside `EncounterState`, so the existing `EncounterRepository` persists it automatically. M6 browser records are lazily upgraded on load: missing `hp` is initialized from the current saved statblock facts and then written back.

## UI

The encounter card shows live current/effective HP and temp HP. It also exposes compact HP controls. Opening a combatant shows the same HP state in a larger combat overlay above the statblock.

Library view remains read-only with respect to combat HP.
