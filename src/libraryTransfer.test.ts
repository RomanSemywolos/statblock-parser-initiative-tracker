import test from "node:test";
import assert from "node:assert/strict";
import { createSavedStatblock } from "./savedStatblock.js";
import { parseLibraryExport, serializeLibraryExport } from "./libraryTransfer.js";
import type { EditableStatblockDocument } from "./productModel.js";

function fixture(): EditableStatblockDocument {
  const abilities = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  const savingThrows = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  return {
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: { id: "name", field: "name", text: "Goblin" },
      subtitle: null,
      primaryRows: [{ id: "ac", field: "armor_class", text: "Armor Class 15" }],
      abilities,
      savingThrows,
      secondaryRows: [],
    },
    body: [],
    facts: {
      name: "Goblin",
      armorClass: 15,
      hitPointMaximum: 7,
      initiative: { modifier: 2, provenance: "dex_modifier" },
      abilities,
      savingThrows,
      proficiencyBonus: 2,
    },
  };
}

test("library export round-trips v2 saved statblocks", () => {
  const statblock = createSavedStatblock(fixture(), {
    parserVersion: "test",
    parserStructure: "mixed",
    parserMode: "auto",
    rawSource: "Goblin\nArmor Class 15",
    id: "goblin",
    now: "2026-08-27T10:00:00.000Z",
  });
  const text = serializeLibraryExport([statblock], "2026-08-27T11:00:00.000Z");
  const parsed = parseLibraryExport(text);
  assert.equal(parsed.formatVersion, 2);
  assert.equal(parsed.statblocks[0]?.formatVersion, "saved-statblock-v2");
  assert.equal(parsed.statblocks[0]?.id, "goblin");
  assert.equal(parsed.statblocks[0]?.rawSource, "Goblin\nArmor Class 15");
  assert.equal(parsed.statblocks[0]?.importedParserMode, "auto");
  assert.equal(parsed.statblocks[0]?.importedParserStructure, "mixed");
});

test("library import migrates legacy v1 statblocks", () => {
  const legacyDocument = {
    formatVersion: "editable-statblock-v1",
    language: "en",
    blocks: [
      { id: "name", role: "name", section: null, field: "name", text: "Legacy Goblin" },
      { id: "ac", role: "header_field", section: null, field: "armor_class", text: "Armor Class 15" },
      { id: "actions", role: "section_heading", section: "actions", field: null, text: "Actions" },
      { id: "bite", role: "feature", section: "actions", field: null, text: "Bite." },
    ],
    facts: fixture().facts,
  };
  const legacy = {
    formatVersion: 1,
    statblocks: [
      {
        formatVersion: "saved-statblock-v1",
        id: "legacy",
        versions: {
          en: { working: legacyDocument, saved: legacyDocument, backup: null, workingUpdatedAt: "x", savedAt: "x" },
        },
        cardConfig: { showName: true, showArmorClass: true, showSavingThrows: true, customBlockIds: ["bite"] },
        importedWithParserVersion: "old",
        createdAt: "x",
        updatedAt: "x",
      },
    ],
  };
  const parsed = parseLibraryExport(JSON.stringify(legacy));
  assert.equal(parsed.statblocks[0]?.versions.en.working.header.name?.text, "Legacy Goblin");
  assert.equal(parsed.statblocks[0]?.versions.en.working.body[1]?.id, "bite");
  assert.deepEqual(parsed.statblocks[0]?.cardConfig.customContentIds, ["bite"]);
});

test("library import rejects malformed input", () => {
  assert.throws(() => parseLibraryExport("not json"), /valid JSON/);
  assert.throws(() => parseLibraryExport('{"formatVersion":3,"statblocks":[]}'), /Unsupported/);
  assert.throws(() => parseLibraryExport('{"formatVersion":2,"statblocks":[{}]}'), /invalid statblock/i);
});
