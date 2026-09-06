import assert from "node:assert/strict";
import test from "node:test";

import type { EditableStatblockDocument } from "./productModel.js";
import {
  createOrReplaceSavedStatblockUkrainian,
  createSavedStatblock,
  createVersionedDocument,
  replaceSavedStatblockFromParse,
  restoreBackupToWorking,
  revertWorkingToSaved,
  saveWorkingDocument,
  updateSavedStatblockCardConfig,
  updateWorkingDocument,
} from "./savedStatblock.js";

function document(name = "Test Creature"): EditableStatblockDocument {
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

test("createVersionedDocument starts with independent working, saved and parser-baseline snapshots", () => {
  const source = document();
  const version = createVersionedDocument(source, "2026-08-27T10:00:00.000Z");
  assert.notEqual(version.working, version.saved);
  assert.notEqual(version.backup, version.saved);
  version.working.header.name!.text = "Changed";
  assert.equal(version.saved.header.name!.text, "Test Creature");
  assert.equal(version.backup?.header.name?.text, "Test Creature");
});

test("explicit save updates the checkpoint without rotating the parser baseline", () => {
  let version = createVersionedDocument(document("Version A"), "2026-08-27T10:00:00.000Z");
  version = updateWorkingDocument(version, document("Version B"), "2026-08-27T10:01:00.000Z");
  version = saveWorkingDocument(version, "2026-08-27T10:02:00.000Z");
  assert.equal(version.saved.facts.name, "Version B");
  assert.equal(version.backup?.facts.name, "Version A");
  version = updateWorkingDocument(version, document("Version C"), "2026-08-27T10:03:00.000Z");
  version = saveWorkingDocument(version, "2026-08-27T10:04:00.000Z");
  assert.equal(version.saved.facts.name, "Version C");
  assert.equal(version.backup?.facts.name, "Version A");
});

test("revert uses explicit save while restore uses the immutable parser baseline", () => {
  let version = createVersionedDocument(document("A"));
  version = updateWorkingDocument(version, document("B"));
  version = saveWorkingDocument(version);
  version = updateWorkingDocument(version, document("C"));
  version = revertWorkingToSaved(version);
  assert.equal(version.working.facts.name, "B");
  version = restoreBackupToWorking(version);
  assert.equal(version.working.facts.name, "A");
  assert.equal(version.saved.facts.name, "B");
});

test("createSavedStatblock uses v2 product defaults", () => {
  const saved = createSavedStatblock(document(), {
    parserVersion: "2.32.0",
    parserStructure: "mixed",
    parserMode: "auto",
    rawSource: "Exact source\nline 2",
    id: "statblock-test",
    now: "2026-08-27T10:00:00.000Z",
  });
  assert.equal(saved.formatVersion, "saved-statblock-v2");
  assert.equal(saved.importedParserStructure, "mixed");
  assert.equal(saved.importedParserMode, "auto");
  assert.equal(saved.rawSource, "Exact source\nline 2");
  assert.equal(saved.versions.en.backup?.facts.name, "Test Creature");
  assert.deepEqual(saved.cardConfig, {
    showName: true,
    showArmorClass: true,
    showSavingThrows: true,
    customContentIds: [],
  });
});

test("reparse replacement preserves card identity and builtin config while replacing parser-owned content", () => {
  const source = createSavedStatblock(document("Old"), {
    parserVersion: "old-parser",
    parserStructure: "mixed",
    parserMode: "auto",
    rawSource: "Old raw source",
    id: "same-card",
    now: "2026-08-27T10:00:00.000Z",
  });
  const configured = updateSavedStatblockCardConfig(
    source,
    {
      showName: false,
      showArmorClass: true,
      showSavingThrows: false,
      customContentIds: ["feature-1"],
    },
    "2026-08-27T10:01:00.000Z",
  );

  const replaced = replaceSavedStatblockFromParse(configured, document("New"), {
    parserVersion: "new-parser",
    parserStructure: "multiline",
    parserMode: "multiline",
    rawSource: "Exact original source",
    now: "2026-08-27T10:02:00.000Z",
  });

  assert.equal(replaced.id, "same-card");
  assert.equal(replaced.createdAt, "2026-08-27T10:00:00.000Z");
  assert.equal(replaced.versions.en.working.facts.name, "New");
  assert.equal(replaced.versions.en.backup?.facts.name, "New");
  assert.equal(replaced.versions.uk, undefined);
  assert.deepEqual(replaced.cardConfig, {
    showName: false,
    showArmorClass: true,
    showSavingThrows: false,
    customContentIds: [],
  });
  assert.equal(replaced.importedWithParserVersion, "new-parser");
  assert.equal(replaced.importedParserStructure, "multiline");
  assert.equal(replaced.importedParserMode, "multiline");
  assert.equal(replaced.rawSource, "Exact original source");
});

test("card configuration targets editor-owned content ids", () => {
  const statblock = createSavedStatblock(document(), { parserVersion: "test", id: "s1" });
  const updated = updateSavedStatblockCardConfig(statblock, {
    showName: false,
    showArmorClass: true,
    showSavingThrows: false,
    customContentIds: ["feature-1"],
  });
  assert.deepEqual(updated.cardConfig.customContentIds, ["feature-1"]);
  assert.notEqual(updated.cardConfig.customContentIds, statblock.cardConfig.customContentIds);
});

test("a new Ukrainian translation establishes its own immutable backup", () => {
  let statblock = createSavedStatblock(document("English"), { parserVersion: "test", id: "translated" });
  statblock = createOrReplaceSavedStatblockUkrainian(statblock, { ...document("Українська"), language: "uk" });
  const translated = statblock.versions.uk!;
  const edited = updateWorkingDocument(translated, { ...document("Правка"), language: "uk" });
  const saved = saveWorkingDocument(edited);
  assert.equal(saved.saved.facts.name, "Правка");
  assert.equal(saved.backup?.facts.name, "Українська");
});
