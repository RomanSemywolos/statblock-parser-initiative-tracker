import test from "node:test";
import assert from "node:assert/strict";
import {
  addStatblockCombatant,
  addStubCombatant,
  advanceCombatTurn,
  createEmptyEncounter,
  endCombat,
  orderedEncounterCombatants,
  removeCombatant,
  removeCombatantsForStatblock,
  rollCombatantInitiative,
  setCombatantInitiative,
  setCombatantNameOverride,
  setStatblockCombatantLimitedUse,
  startCombat,
  updateCombatantHp,
  updateStatblockCombatantDocument,
  updateStatblockCombatantCard,
  updateStatblockCombatantCardConfig,
  updateStubCombatant,
} from "./encounterModel.js";

import type { EditableStatblockDocument } from "./productModel.js";

function fixtureDocument(name = "Goblin", armorClass = 15): EditableStatblockDocument {
  const abilities = {
    str: { score: 8, modifier: -1 },
    dex: { score: 14, modifier: 2 },
    con: { score: 10, modifier: 0 },
    int: { score: 10, modifier: 0 },
    wis: { score: 8, modifier: -1 },
    cha: { score: 8, modifier: -1 },
  };
  const savingThrows = { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: -1 };
  return {
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: { id: "name", field: "name", text: name },
      subtitle: null,
      primaryRows: [{ id: "ac", field: "armor_class", text: `Armor Class ${armorClass}` }],
      abilities,
      savingThrows,
      secondaryRows: [],
    },
    body: [{ id: "attack", type: "paragraph", text: "Slash. Melee Weapon Attack: +4 to hit." }],
    facts: {
      name,
      armorClass,
      hitPointMaximum: 12,
      initiative: { modifier: 2, provenance: "dex_modifier" },
      abilities,
      savingThrows,
      proficiencyBonus: 2,
    },
  };
}

test("one saved statblock can create several independent combatant instances", () => {
  let encounter = createEmptyEncounter("2026-08-27T10:00:00.000Z");
  encounter = addStatblockCombatant(encounter, "goblin", {
    id: "c1",
    now: "2026-08-27T10:00:01.000Z",
  });
  encounter = addStatblockCombatant(encounter, "goblin", {
    id: "c2",
    now: "2026-08-27T10:00:02.000Z",
  });

  assert.equal(encounter.combatants.length, 2);

  const [first, second] = encounter.combatants;
  assert.equal(first?.kind, "statblock");
  assert.equal(second?.kind, "statblock");

  if (first?.kind === "statblock" && second?.kind === "statblock") {
    assert.equal(first.statblockId, "goblin");
    assert.equal(second.statblockId, "goblin");
    assert.notEqual(first.id, second.id);
  } else {
    assert.fail("expected statblock combatants");
  }
});

test("removeCombatant removes only the selected instance", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c1", now: "2026-08-27T10:00:01.000Z" });
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c2", now: "2026-08-27T10:00:02.000Z" });

  const updated = removeCombatant(encounter, "c1", "2026-08-27T10:00:03.000Z");
  assert.deepEqual(
    updated.combatants.map((entry) => entry.id),
    ["c2"],
  );
});

test("removing the current combatant advances to the next surviving initiative entry", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "a", { id: "a", initiativeModifier: 0 });
  encounter = addStatblockCombatant(encounter, "b", { id: "b", initiativeModifier: 0 });
  encounter = addStatblockCombatant(encounter, "c", { id: "c", initiativeModifier: 0 });
  encounter = setCombatantInitiative(encounter, "a", 20);
  encounter = setCombatantInitiative(encounter, "b", 15);
  encounter = setCombatantInitiative(encounter, "c", 10);
  encounter = { ...encounter, active: true, round: 4, currentCombatantId: "b" };

  const updated = removeCombatant(encounter, "b");
  assert.equal(updated.currentCombatantId, "c");
  assert.equal(updated.round, 4);
});

test("removing the last current combatant wraps initiative and advances the round", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "a", { id: "a" });
  encounter = addStatblockCombatant(encounter, "b", { id: "b" });
  encounter = addStatblockCombatant(encounter, "c", { id: "c" });
  encounter = setCombatantInitiative(encounter, "a", 20);
  encounter = setCombatantInitiative(encounter, "b", 15);
  encounter = setCombatantInitiative(encounter, "c", 10);
  encounter = { ...encounter, active: true, round: 2, currentCombatantId: "c" };

  const updated = removeCombatant(encounter, "c");
  assert.equal(updated.currentCombatantId, "a");
  assert.equal(updated.round, 3);
});

test("removeCombatantsForStatblock removes orphan-prone encounter instances", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c1", now: "2026-08-27T10:00:01.000Z" });
  encounter = addStatblockCombatant(encounter, "lich", { id: "c2", now: "2026-08-27T10:00:02.000Z" });
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c3", now: "2026-08-27T10:00:03.000Z" });

  const updated = removeCombatantsForStatblock(encounter, "goblin", "2026-08-27T10:00:04.000Z");
  assert.deepEqual(
    updated.combatants.map((entry) => entry.id),
    ["c2"],
  );
});

test("removing a statblock family during combat skips all removed entries without replaying earlier turns", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "a" });
  encounter = addStatblockCombatant(encounter, "goblin", { id: "b" });
  encounter = addStatblockCombatant(encounter, "lich", { id: "c" });
  encounter = setCombatantInitiative(encounter, "a", 20);
  encounter = setCombatantInitiative(encounter, "b", 15);
  encounter = setCombatantInitiative(encounter, "c", 10);
  encounter = { ...encounter, active: true, round: 5, currentCombatantId: "a" };

  const updated = removeCombatantsForStatblock(encounter, "goblin");
  assert.deepEqual(
    updated.combatants.map((entry) => entry.id),
    ["c"],
  );
  assert.equal(updated.currentCombatantId, "c");
  assert.equal(updated.round, 5);
});

test("new combatant captures base HP from the statblock at creation time", () => {
  const encounter = addStatblockCombatant(createEmptyEncounter(), "goblin", {
    id: "c1",
    now: "2026-08-27T10:00:01.000Z",
    hitPointMaximum: 17,
  });
  assert.deepEqual(encounter.combatants[0]?.hp, {
    baseMax: 17,
    current: 17,
    temp: 0,
    maxModifier: 0,
  });
});

test("updateCombatantHp changes only one combatant", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c1", hitPointMaximum: 10 });
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c2", hitPointMaximum: 10 });
  const hp = { baseMax: 10, current: 3, temp: 2, maxModifier: 0 };
  const updated = updateCombatantHp(encounter, "c1", hp, "2026-08-27T10:00:05.000Z");
  assert.deepEqual(updated.combatants[0]?.hp, hp);
  assert.equal(updated.combatants[1]?.hp?.current, 10);
});

test("combatant HP state is initialized independently for each encounter instance", () => {
  let encounter = createEmptyEncounter("2026-08-27T10:00:00.000Z");
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c1", hitPointMaximum: 12 });
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c2", hitPointMaximum: 12 });

  assert.deepEqual(encounter.combatants[0]?.hp, { baseMax: 12, current: 12, temp: 0, maxModifier: 0 });
  assert.deepEqual(encounter.combatants[1]?.hp, { baseMax: 12, current: 12, temp: 0, maxModifier: 0 });
  assert.notEqual(encounter.combatants[0]?.hp, encounter.combatants[1]?.hp);
});

test("damage consumes temporary HP before current HP", async () => {
  const { damageCombatant, grantTemporaryHpToCombatant } = await import("./encounterModel.js");
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c1", hitPointMaximum: 20 });
  encounter = grantTemporaryHpToCombatant(encounter, "c1", 7);
  encounter = damageCombatant(encounter, "c1", 10);
  assert.deepEqual(encounter.combatants[0]?.hp, { baseMax: 20, current: 17, temp: 0, maxModifier: 0 });
});

test("healing caps at effective max and temporary HP does not stack", async () => {
  const { damageCombatant, grantTemporaryHpToCombatant, healCombatant } = await import("./encounterModel.js");
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c1", hitPointMaximum: 20 });
  encounter = damageCombatant(encounter, "c1", 8);
  encounter = healCombatant(encounter, "c1", 100);
  encounter = grantTemporaryHpToCombatant(encounter, "c1", 5);
  encounter = grantTemporaryHpToCombatant(encounter, "c1", 3);
  assert.deepEqual(encounter.combatants[0]?.hp, { baseMax: 20, current: 20, temp: 5, maxModifier: 0 });
});

test("maximum HP modifier clamps current HP and reset restores base state", async () => {
  const { modifyCombatantHpMaximum, resetCombatantHp } = await import("./encounterModel.js");
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "c1", hitPointMaximum: 20 });
  encounter = modifyCombatantHpMaximum(encounter, "c1", -6);
  assert.deepEqual(encounter.combatants[0]?.hp, { baseMax: 20, current: 14, temp: 0, maxModifier: -6 });
  encounter = resetCombatantHp(encounter, "c1");
  assert.deepEqual(encounter.combatants[0]?.hp, { baseMax: 20, current: 20, temp: 0, maxModifier: 0 });
});

test("initiative ordering uses total, modifier, then stable insertion order", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "slow", { id: "c1", initiativeModifier: 2 });
  encounter = addStatblockCombatant(encounter, "fast", { id: "c2", initiativeModifier: 5 });
  encounter = addStatblockCombatant(encounter, "same", { id: "c3", initiativeModifier: 5 });
  encounter = rollCombatantInitiative(encounter, "c1", () => 0.7); // 15 + 2 = 17
  encounter = rollCombatantInitiative(encounter, "c2", () => 0.55); // 12 + 5 = 17
  encounter = rollCombatantInitiative(encounter, "c3", () => 0.55); // 12 + 5 = 17
  assert.deepEqual(
    orderedEncounterCombatants(encounter).map((entry) => entry.id),
    ["c2", "c3", "c1"],
  );
});

test("rolled combatants sort above unrolled combatants before combat starts", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "a", { id: "a", initiativeModifier: 0 });
  encounter = addStatblockCombatant(encounter, "b", { id: "b", initiativeModifier: 0 });
  encounter = rollCombatantInitiative(encounter, "b", () => 0);
  assert.deepEqual(
    orderedEncounterCombatants(encounter).map((entry) => entry.id),
    ["b", "a"],
  );
});

test("startCombat preserves manual initiative, rolls missing values, and selects the highest", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "a", { id: "a", initiativeModifier: 3 });
  encounter = addStatblockCombatant(encounter, "b", { id: "b", initiativeModifier: 1 });
  encounter = rollCombatantInitiative(encounter, "a", () => 0.95); // 20 + 3 = 23
  const started = startCombat(encounter, () => 0); // b = 1 + 1 = 2
  assert.equal(started.active, true);
  assert.equal(started.round, 1);
  assert.equal(started.currentCombatantId, "a");
  assert.equal(started.combatants.find((entry) => entry.id === "a")?.initiativeRoll, 23);
  assert.equal(started.combatants.find((entry) => entry.id === "b")?.initiativeRoll, 2);
});

test("advanceCombatTurn walks initiative order and increments round on wrap", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "a", { id: "a", initiativeModifier: 3 });
  encounter = addStatblockCombatant(encounter, "b", { id: "b", initiativeModifier: 1 });
  encounter = startCombat(
    encounter,
    (() => {
      const values = [0.95, 0.4];
      let i = 0;
      return () => values[i++] ?? 0;
    })(),
  );
  assert.equal(encounter.currentCombatantId, "a");
  encounter = advanceCombatTurn(encounter);
  assert.equal(encounter.currentCombatantId, "b");
  assert.equal(encounter.round, 1);
  encounter = advanceCombatTurn(encounter);
  assert.equal(encounter.currentCombatantId, "a");
  assert.equal(encounter.round, 2);
});

test("endCombat clears initiative and turn state and resets HP while keeping combatants", async () => {
  const { damageCombatant, grantTemporaryHpToCombatant } = await import("./encounterModel.js");
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "a", { id: "a", hitPointMaximum: 20, initiativeModifier: 3 });
  encounter = damageCombatant(encounter, "a", 7);
  encounter = grantTemporaryHpToCombatant(encounter, "a", 4);
  encounter = startCombat(encounter, () => 0.5);
  const ended = endCombat(encounter);
  assert.equal(ended.active, false);
  assert.equal(ended.round, null);
  assert.equal(ended.currentCombatantId, null);
  assert.equal(ended.combatants.length, 1);
  assert.equal(ended.combatants[0]?.initiativeRoll, null);
  assert.deepEqual(ended.combatants[0]?.hp, { baseMax: 20, current: 20, temp: 0, maxModifier: 0 });
});

test("stub combatant uses the same HP and initiative state machine", async () => {
  const { addStubCombatant, damageCombatant } = await import("./encounterModel.js");
  let encounter = createEmptyEncounter();
  encounter = addStubCombatant(encounter, {
    id: "hero",
    displayName: "Alice",
    hitPointMaximum: 30,
    armorClass: 18,
    initiativeModifier: 4,
    savingThrows: { dex: 7, wis: 3 },
  });
  const stub = encounter.combatants[0];
  assert.equal(stub?.kind, "stub");
  if (stub?.kind !== "stub") throw new Error("Expected stub combatant.");
  assert.equal(stub.displayName, "Alice");
  assert.equal(stub.armorClass, 18);
  assert.equal(stub.savingThrows.dex, 7);
  encounter = startCombat(encounter, () => 0.5);
  assert.equal(encounter.currentCombatantId, "hero");
  assert.equal(encounter.combatants[0]?.initiativeRoll, 15);
  encounter = damageCombatant(encounter, "hero", 8);
  assert.equal(encounter.combatants[0]?.hp?.current, 22);
});

test("removeCombatantsForStatblock never removes stubs", async () => {
  const { addStubCombatant } = await import("./encounterModel.js");
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "monster" });
  encounter = addStubCombatant(encounter, { id: "hero", displayName: "Hero" });
  const updated = removeCombatantsForStatblock(encounter, "goblin");
  assert.deepEqual(
    updated.combatants.map((entry) => entry.id),
    ["hero"],
  );
});

test("manual initiative setter updates the selected combatant and supports clearing", () => {
  let encounter = createEmptyEncounter("2026-08-28T00:00:00.000Z");
  encounter = addStubCombatant(encounter, {
    id: "manual-init",
    displayName: "Manual",
    initiativeModifier: 3,
    now: "2026-08-28T00:00:01.000Z",
  });

  encounter = setCombatantInitiative(encounter, "manual-init", 17, "2026-08-28T00:00:02.000Z");
  assert.equal(encounter.combatants[0]?.initiativeRoll, 17);

  encounter = setCombatantInitiative(encounter, "manual-init", null, "2026-08-28T00:00:03.000Z");
  assert.equal(encounter.combatants[0]?.initiativeRoll, null);
});

test("statblock combatant owns a cloned document snapshot", () => {
  const source = fixtureDocument("Snapshot Goblin", 15);
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", {
    id: "snapshot",
    document: source,
  });

  source.header.name!.text = "Library changed";
  source.facts.name = "Library changed";
  source.facts.armorClass = 99;
  source.facts.savingThrows.dex = 42;
  const combatant = encounter.combatants[0];
  assert.equal(combatant?.kind, "statblock");
  if (combatant?.kind !== "statblock") return;
  assert.equal(combatant.document.facts.name, "Snapshot Goblin");
  assert.equal(combatant.document.header.name?.text, "Snapshot Goblin");
  assert.equal(combatant.document.facts.armorClass, 15);
  assert.equal(combatant.document.facts.savingThrows.dex, 2);
});

test("editing one combatant document does not alter sibling snapshots", () => {
  const source = fixtureDocument();
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "a", document: source });
  encounter = addStatblockCombatant(encounter, "goblin", { id: "b", document: source });

  const changed = fixtureDocument("Stronger Goblin", 18);
  encounter = updateStatblockCombatantDocument(encounter, "a", changed);

  const first = encounter.combatants.find((entry) => entry.id === "a");
  const second = encounter.combatants.find((entry) => entry.id === "b");
  assert.equal(first?.kind === "statblock" ? first.document.facts.armorClass : null, 18);
  assert.equal(second?.kind === "statblock" ? second.document.facts.armorClass : null, 15);
});

test("per-copy name override can be set and cleared", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "a", document: fixtureDocument() });
  encounter = setCombatantNameOverride(encounter, "a", "Сильніший");
  assert.equal(
    encounter.combatants[0]?.kind === "statblock" ? encounter.combatants[0].nameOverride : null,
    "Сильніший",
  );
  encounter = setCombatantNameOverride(encounter, "a", "");
  assert.equal(encounter.combatants[0]?.kind === "statblock" ? encounter.combatants[0].nameOverride : "x", null);
});

test("stub editor patch can change stat fields without replacing combatant id", () => {
  let encounter = createEmptyEncounter();
  encounter = addStubCombatant(encounter, {
    id: "stub-edit",
    displayName: "Old",
    hitPointMaximum: 20,
    armorClass: 10,
    initiativeModifier: 1,
  });
  encounter = updateStubCombatant(encounter, "stub-edit", {
    displayName: "New",
    hitPointMaximum: 25,
    armorClass: 14,
    initiativeModifier: 4,
    savingThrows: { dex: 6 },
  });
  const stub = encounter.combatants[0];
  assert.equal(stub?.kind, "stub");
  if (stub?.kind !== "stub") return;
  assert.equal(stub.id, "stub-edit");
  assert.equal(stub.displayName, "New");
  assert.equal(stub.hp?.baseMax, 25);
  assert.equal(stub.armorClass, 14);
  assert.equal(stub.initiativeModifier, 4);
  assert.equal(stub.savingThrows.dex, 6);
});

test("combatant snapshots card configuration independently from source object", () => {
  const cardConfig = {
    showName: true,
    showArmorClass: false,
    showSavingThrows: true,
    customContentIds: ["attack"],
  };
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", {
    id: "card-snapshot",
    document: fixtureDocument(),
    cardConfig,
  });
  cardConfig.showArmorClass = true;
  cardConfig.customContentIds.push("other");

  const combatant = encounter.combatants[0];
  assert.equal(combatant?.kind, "statblock");
  if (combatant?.kind !== "statblock") return;
  assert.equal(combatant.cardConfig.showArmorClass, false);
  assert.deepEqual(combatant.cardConfig.customContentIds, ["attack"]);
});

test("encounter card configuration can diverge from the source and sibling copies", () => {
  const source = fixtureDocument();
  const sourceConfig = {
    showName: true,
    showArmorClass: true,
    showSavingThrows: true,
    customContentIds: [],
  };
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", { id: "a", document: source, cardConfig: sourceConfig });
  encounter = addStatblockCombatant(encounter, "goblin", { id: "b", document: source, cardConfig: sourceConfig });

  encounter = updateStatblockCombatantCardConfig(encounter, "a", {
    showName: false,
    showArmorClass: false,
    showSavingThrows: true,
    customContentIds: ["attack"],
  });

  const first = encounter.combatants.find((entry) => entry.id === "a");
  const second = encounter.combatants.find((entry) => entry.id === "b");
  assert.equal(first?.kind === "statblock" ? first.cardConfig.showName : true, false);
  assert.deepEqual(first?.kind === "statblock" ? first.cardConfig.customContentIds : [], ["attack"]);
  assert.equal(second?.kind === "statblock" ? second.cardConfig.showName : false, true);
  assert.equal(sourceConfig.showName, true);
});

test("statblock card patch stores per-combatant HP, AC, initiative, saves and name overrides", () => {
  let encounter = createEmptyEncounter();
  encounter = addStatblockCombatant(encounter, "goblin", {
    id: "card-edit",
    document: fixtureDocument(),
    hitPointMaximum: 20,
  });
  encounter = updateStatblockCombatantCard(encounter, "card-edit", {
    name: "Guard #A",
    hitPointMaximum: 27,
    armorClass: 19,
    initiativeModifier: 6,
    savingThrows: { dex: 7, wis: 4 },
  });
  const combatant = encounter.combatants[0];
  assert.equal(combatant?.kind, "statblock");
  if (combatant?.kind !== "statblock") return;
  assert.equal(combatant.nameOverride, "Guard #A");
  assert.equal(combatant.hp?.baseMax, 27);
  assert.equal(combatant.armorClassOverride, 19);
  assert.equal(combatant.initiativeModifier, 6);
  assert.equal(combatant.savingThrowOverrides?.dex, 7);
  assert.equal(combatant.savingThrowOverrides?.wis, 4);
});

test("limited-use counters are clamped and remain independent per combatant", () => {
  let encounter = createEmptyEncounter("2026-09-06T10:00:00.000Z");
  encounter = addStatblockCombatant(encounter, "lich", { id: "a", document: fixtureDocument() });
  encounter = addStatblockCombatant(encounter, "lich", { id: "b", document: fixtureDocument() });

  encounter = setStatblockCombatantLimitedUse(encounter, "a", "node:resistance:0", 3, 2);
  const first = encounter.combatants.find((entry) => entry.id === "a");
  const second = encounter.combatants.find((entry) => entry.id === "b");
  assert.equal(first?.kind === "statblock" ? first.limitedUses["node:resistance:0"] : null, 2);
  assert.deepEqual(second?.kind === "statblock" ? second.limitedUses : null, {});

  encounter = setStatblockCombatantLimitedUse(encounter, "a", "node:resistance:0", 3, 99);
  assert.equal(
    encounter.combatants[0]?.kind === "statblock" ? encounter.combatants[0].limitedUses["node:resistance:0"] : null,
    3,
  );
  encounter = setStatblockCombatantLimitedUse(encounter, "a", "node:resistance:0", 3, -2);
  assert.equal(
    encounter.combatants[0]?.kind === "statblock" ? encounter.combatants[0].limitedUses["node:resistance:0"] : null,
    0,
  );

  encounter = endCombat(encounter);
  assert.equal(
    encounter.combatants[0]?.kind === "statblock" ? encounter.combatants[0].limitedUses["node:resistance:0"] : null,
    0,
  );
});
