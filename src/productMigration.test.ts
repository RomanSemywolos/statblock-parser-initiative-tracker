import assert from "node:assert/strict";
import test from "node:test";

import { migrateEditableStatblockDocument, migrateSavedStatblock } from "./productMigration.js";

const facts = {
  name: "Legacy",
  armorClass: 17,
  hitPointMaximum: 20,
  initiative: { modifier: 2, provenance: "dex_modifier" as const },
  abilities: { str: null, dex: { score: 14, modifier: 2 }, con: null, int: null, wis: null, cha: null },
  savingThrows: { str: null, dex: 2, con: null, int: null, wis: null, cha: null },
  proficiencyBonus: 2,
};

const legacyDocument = {
  formatVersion: "editable-statblock-v1",
  language: "en",
  blocks: [
    { id: "name", role: "name", section: null, field: "name", text: "Legacy" },
    { id: "ac", role: "header_field", section: null, field: "armor_class", text: "Armor Class 17" },
    { id: "actions", role: "section_heading", section: "actions", field: null, text: "Actions" },
    { id: "bite", role: "feature", section: "actions", field: null, text: "Bite." },
  ],
  facts,
};

test("v1 editable document migrates to header/body and preserves body ids", () => {
  const migrated = migrateEditableStatblockDocument(legacyDocument);
  assert.equal(migrated.formatVersion, "editable-statblock-v2");
  assert.equal(migrated.header.name?.id, "name");
  assert.equal(migrated.header.primaryRows[0]?.id, "ac");
  assert.deepEqual(
    migrated.body.map((node) => node.id),
    ["actions", "bite"],
  );
});

test("v1 SavedStatblock migrates card references to editor-owned content ids", () => {
  const version = { working: legacyDocument, saved: legacyDocument, backup: null, workingUpdatedAt: "x", savedAt: "x" };
  const migrated = migrateSavedStatblock({
    formatVersion: "saved-statblock-v1",
    id: "legacy",
    versions: { en: version },
    cardConfig: { showName: true, showArmorClass: true, showSavingThrows: true, customBlockIds: ["bite"] },
    importedWithParserVersion: "old",
    createdAt: "x",
    updatedAt: "x",
  });
  assert.equal(migrated.formatVersion, "saved-statblock-v2");
  assert.deepEqual(migrated.cardConfig.customContentIds, ["bite"]);
  assert.equal(migrated.versions.en.working.body[1]?.id, "bite");
  assert.equal(migrated.versions.en.backup?.body[1]?.id, "bite");
  assert.equal(migrated.importedParserMode, null);
  assert.equal(migrated.rawSource, null);
});

test("legacy ability-table card reference maps to editor-owned builtin ability content", () => {
  const withAbilities = {
    ...legacyDocument,
    blocks: [
      ...legacyDocument.blocks,
      {
        id: "ability-block",
        role: "header_field",
        section: null,
        field: "ability_scores",
        text: "STR 10 (+0) DEX 14 (+2)",
      },
    ],
  };
  const version = { working: withAbilities, saved: withAbilities, backup: null, workingUpdatedAt: "x", savedAt: "x" };
  const migrated = migrateSavedStatblock({
    formatVersion: "saved-statblock-v1",
    id: "legacy-abilities",
    versions: { en: version },
    cardConfig: { showName: true, showArmorClass: true, showSavingThrows: true, customBlockIds: ["ability-block"] },
    importedWithParserVersion: "old",
    createdAt: "x",
    updatedAt: "x",
  });
  assert.deepEqual(migrated.cardConfig.customContentIds, ["builtin-abilities"]);
});

test("modern v2 documents keep a permanent name slot but leave subtitle optional", () => {
  const document = migrateEditableStatblockDocument({
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: null,
      subtitle: null,
      primaryRows: [],
      abilities: facts.abilities,
      savingThrows: facts.savingThrows,
      secondaryRows: [],
    },
    body: [],
    facts: { ...facts, name: null },
  });

  assert.equal(document.header.name?.text, "");
  assert.equal(document.header.subtitle, null);
  assert.equal(document.facts.name, null);
});

test("modern v2 migration materializes authoritative Initiative and PB rows from legacy facts", () => {
  const document = migrateEditableStatblockDocument({
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: { id: "name", field: "name", text: "Legacy v2" },
      subtitle: null,
      primaryRows: [{ id: "ac", field: "armor_class", text: "Armor Class 17" }],
      abilities: facts.abilities,
      savingThrows: facts.savingThrows,
      secondaryRows: [],
    },
    body: [],
    facts,
  });

  assert.equal(document.header.primaryRows.find((row) => row.field === "initiative")?.text, "Initiative +2");
  assert.equal(
    document.header.secondaryRows.find((row) => row.field === "proficiency_bonus")?.text,
    "Proficiency Bonus +2",
  );
});

test("modern editable documents are runtime-validated before migration", () => {
  assert.throws(
    () =>
      migrateEditableStatblockDocument({
        formatVersion: "editable-statblock-v2",
        language: "en",
        header: {
          name: { id: "name", field: "name", text: "Broken" },
          subtitle: null,
          primaryRows: [],
          abilities: { ...facts.abilities, str: { score: "ten", modifier: 0 } },
          savingThrows: facts.savingThrows,
          secondaryRows: [],
        },
        body: [],
        facts,
      }),
    /header\.abilities\.str\.score must be a finite number/u,
  );
});
