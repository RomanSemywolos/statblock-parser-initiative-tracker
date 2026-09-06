# M8 — initiative and encounter turn state

M8 turns the right sidebar from a persistent combatant list into the first complete encounter state machine.

## Combatant initiative snapshot

A statblock combatant captures the current product fact when it is added:

```ts
initiativeModifier: number;
initiativeRoll: number | null;
```

The modifier comes from `facts.initiative.modifier`; if no structured initiative fact exists, it falls back to `0`. Like `CombatHpState.baseMax`, this is encounter-owned state: later library edits do not silently change an already-created combatant.

## Encounter state

```ts
type EncounterState = {
  formatVersion: "encounter-v2";
  combatants: StatblockCombatant[];
  active: boolean;
  round: number | null;
  currentCombatantId: string | null;
  updatedAt: string;
};
```

Combatants remain stored in insertion order. Initiative order is derived by `orderedEncounterCombatants()` so stable insertion order remains available as the final tie breaker.

## Initiative ordering

1. rolled combatants before unrolled combatants;
2. higher initiative total first;
3. on equal total, higher initiative modifier first;
4. then stable insertion order.

This intentionally leaves initiative groups/manual tie ordering for a later extension.

## Workflow

`rollCombatantInitiative()` rolls `d20 + initiativeModifier` and stores the total.

`startCombat()` preserves initiative values already rolled manually, rolls only missing values, sets `active = true`, `round = 1`, and selects the highest initiative combatant.

`advanceCombatTurn()` moves through derived initiative order and increments the round when wrapping from the last combatant to the first.

`endCombat()` keeps the combatant list but clears all initiative totals, resets every combat HP overlay, and clears round/current-turn state.

Adding a new combatant while combat is active causes the React shell to roll that new combatant immediately.

## Persistence and migration

Encounter v2 is persisted through the existing `EncounterRepository`. The React shell upgrades older M6/M7 records lazily:

- missing HP is initialized from the current statblock maximum;
- missing initiative modifier is initialized from the current product fact (or `0`);
- missing initiative roll becomes `null`;
- missing encounter active/round/current fields become the inactive defaults.

The upgraded state is written back once.
