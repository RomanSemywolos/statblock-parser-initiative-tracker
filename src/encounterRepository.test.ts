import test from "node:test";
import assert from "node:assert/strict";
import { addStatblockCombatant, createEmptyEncounter } from "./encounterModel.js";
import { MemoryEncounterRepository } from "./encounterRepository.js";

test("encounter repository persists and returns isolated copies", async () => {
  const repository = new MemoryEncounterRepository();
  const encounter = addStatblockCombatant(createEmptyEncounter(), "goblin", {
    id: "c1",
    now: "2026-08-27T10:00:00.000Z",
  });
  await repository.put(encounter);

  const first = await repository.get();
  first.combatants.length = 0;

  const second = await repository.get();
  assert.equal(second.combatants.length, 1);
  assert.equal(second.combatants[0]?.id, "c1");
});

test("encounter repository clear returns an empty encounter", async () => {
  const repository = new MemoryEncounterRepository();
  await repository.put(addStatblockCombatant(createEmptyEncounter(), "goblin", { id: "c1" }));
  await repository.clear();
  const encounter = await repository.get();
  assert.equal(encounter.combatants.length, 0);
});
