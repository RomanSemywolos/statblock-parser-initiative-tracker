import assert from "node:assert/strict";
import test from "node:test";

import type { EditableStatblockDocument, SavedStatblock } from "./productModel.js";
import { createSavedStatblock, updateSavedStatblockEnglishWorking } from "./savedStatblock.js";
import {
  compareSavedStatblocksByName,
  IndexedDbStatblockRepository,
  MemoryStatblockRepository,
  type StatblockRepository,
} from "./statblockRepository.js";

function fixtureDocument(name: string): EditableStatblockDocument {
  const abilities = {
    str: { score: 10, modifier: 0 },
    dex: { score: 16, modifier: 3 },
    con: { score: 14, modifier: 2 },
    int: { score: 10, modifier: 0 },
    wis: { score: 12, modifier: 1 },
    cha: { score: 8, modifier: -1 },
  };
  const savingThrows = { str: 0, dex: 3, con: 2, int: 0, wis: 1, cha: -1 };
  return {
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: { id: "name", field: "name", text: name },
      subtitle: { id: "subtitle", field: "size_type_alignment", text: "Medium Humanoid, Neutral" },
      primaryRows: [
        { id: "ac", field: "armor_class", text: "Armor Class 17" },
        { id: "hp", field: "hit_points", text: "Hit Points 42" },
      ],
      abilities,
      savingThrows,
      secondaryRows: [],
    },
    body: [
      { id: "actions", type: "heading", headingKind: "actions", text: "Actions" },
      { id: "feature-1", type: "paragraph", text: "Bite. Melee Weapon Attack: +5 to hit." },
    ],
    facts: {
      name,
      armorClass: 17,
      hitPointMaximum: 42,
      initiative: { modifier: 3, provenance: "dex_modifier" },
      abilities,
      savingThrows,
      proficiencyBonus: 2,
    },
  };
}

function fixtureSaved(id: string, name: string, now: string): SavedStatblock {
  return createSavedStatblock(fixtureDocument(name), { parserVersion: "test", id, now });
}

async function runRepositoryContract(repository: StatblockRepository): Promise<void> {
  await repository.clear();
  assert.deepEqual(await repository.list(), []);

  const older = fixtureSaved("a", "Zariel", "2026-08-27T10:00:00.000Z");
  const newer = fixtureSaved("b", "Aboleth", "2026-08-27T11:00:00.000Z");
  await repository.put(older);
  await repository.put(newer);
  assert.deepEqual(
    (await repository.list()).map((value) => value.id),
    ["b", "a"],
  );

  const storedCopy = await repository.get("a");
  if (storedCopy === undefined) throw new Error("stored statblock missing");
  storedCopy.versions.en.working.header.name!.text = "mutated outside repository";
  assert.equal((await repository.get("a"))?.versions.en.working.header.name?.text, "Zariel");

  const updated = updateSavedStatblockEnglishWorking(older, fixtureDocument("Edited"), "2026-08-27T12:00:00.000Z");
  await repository.put(updated);
  assert.equal((await repository.get("a"))?.versions.en.working.facts.name, "Edited");
  assert.deepEqual(
    (await repository.list()).map((value) => value.id),
    ["b", "a"],
  );

  await repository.delete("b");
  assert.deepEqual(
    (await repository.list()).map((value) => value.id),
    ["a"],
  );
  await repository.clear();
}

test("MemoryStatblockRepository satisfies repository contract", async () => {
  await runRepositoryContract(new MemoryStatblockRepository());
});

test("IndexedDbStatblockRepository fails clearly when IndexedDB is unavailable", () => {
  assert.throws(() => new IndexedDbStatblockRepository({ indexedDBFactory: undefined }), /IndexedDB is unavailable/);
});

test("library comparator is shared and falls back to saved name when working name is absent", () => {
  const unnamedWorking = fixtureSaved("a", "Zariel", "2026-08-27T10:00:00.000Z");
  unnamedWorking.versions.en.working.facts.name = null;
  const aboleth = fixtureSaved("b", "Aboleth", "2026-08-27T10:00:01.000Z");
  assert.deepEqual(
    [unnamedWorking, aboleth].sort(compareSavedStatblocksByName).map((entry) => entry.id),
    ["b", "a"],
  );
});
