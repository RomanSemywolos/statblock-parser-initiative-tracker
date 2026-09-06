import { createSavedStatblock, type EditableStatblockDocument } from "statblock-parser-core/product";

export function fixtureDocument(name = "Aboleth"): EditableStatblockDocument {
  const abilities = {
    str: { score: 10, modifier: 0 },
    dex: { score: 10, modifier: 0 },
    con: { score: 10, modifier: 0 },
    int: { score: 10, modifier: 0 },
    wis: { score: 10, modifier: 0 },
    cha: { score: 10, modifier: 0 },
  };
  const savingThrows = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  return {
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: { id: "name", field: "name", text: name },
      subtitle: { id: "subtitle", field: "size_type_alignment", text: "Large Aberration" },
      primaryRows: [
        { id: "ac", field: "armor_class", text: "Armor Class 17" },
        { id: "hp", field: "hit_points", text: "Hit Points 135" },
      ],
      abilities,
      savingThrows,
      secondaryRows: [],
    },
    body: [{ id: "trait", type: "paragraph", text: "***Probing Telepathy.*** (3/Day) Text." }],
    facts: {
      name,
      armorClass: 17,
      hitPointMaximum: 135,
      initiative: { modifier: 0, provenance: "dex_modifier" },
      abilities,
      savingThrows,
      proficiencyBonus: 4,
    },
  };
}

export function fixtureSavedStatblock(id = "aboleth") {
  return createSavedStatblock(fixtureDocument(), {
    id,
    parserVersion: "test",
    now: "2026-09-06T00:00:00.000Z",
  });
}
