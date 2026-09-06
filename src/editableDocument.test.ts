import assert from "node:assert/strict";
import test from "node:test";

import {
  addEditableHeaderRow,
  applyEditableAutoStyle,
  editEditableAbility,
  editEditableHeaderText,
  editEditableNodeText,
  editEditableSavingThrow,
  ensureEditableHeaderSubtitle,
  insertEditableNodeAfter,
  mergeEditableNodeWithNext,
  mergeEditableNodeWithPrevious,
  removeEditableHeaderRow,
  removeEditableNode,
  setEditableHeaderName,
  setEditableHeaderSubtitle,
  splitEditableNodeAt,
  splitEditableNodeText,
  toggleEditableNodeHeading,
} from "./editableDocument.js";
import type { EditableStatblockDocument } from "./productModel.js";

function fixture(): EditableStatblockDocument {
  const abilities = {
    str: { score: 10, modifier: 0 },
    dex: { score: 16, modifier: 3 },
    con: { score: 14, modifier: 2 },
    int: { score: 8, modifier: -1 },
    wis: { score: 12, modifier: 1 },
    cha: { score: 6, modifier: -2 },
  };
  const savingThrows = { str: 0, dex: 3, con: 2, int: -1, wis: 1, cha: -2 };
  return {
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: { id: "name", field: "name", text: "Test Beast" },
      subtitle: null,
      primaryRows: [
        { id: "ac", field: "armor_class", text: "Armor Class 18" },
        { id: "header-initiative-derived", field: "initiative", text: "Initiative +3" },
        { id: "hp", field: "hit_points", text: "Hit Points 100" },
      ],
      abilities,
      savingThrows,
      secondaryRows: [],
    },
    body: [
      { id: "actions", type: "heading", headingKind: "actions", text: "Actions" },
      { id: "bite", type: "paragraph", text: "Bite. Hit: 7 (1d8 + 3) piercing damage." },
      { id: "tail", type: "paragraph", text: "Tail. Hit: 6 (1d6 + 3) bludgeoning damage." },
    ],
    facts: {
      name: "Test Beast",
      armorClass: 18,
      hitPointMaximum: 100,
      initiative: { modifier: 3, provenance: "dex_modifier" },
      abilities,
      savingThrows,
      proficiencyBonus: 3,
    },
  };
}

test("editing a header row refreshes derived facts without mutating source", () => {
  const source = fixture();
  const next = editEditableHeaderText(source, "ac", "Armor Class 20");
  assert.equal(source.facts.armorClass, 18);
  assert.equal(next.facts.armorClass, 20);
  assert.equal(next.header.primaryRows[0]?.text, "Armor Class 20");
});

test("editing DEX updates ability facts and fallback save but not the existing Initiative field", () => {
  const next = editEditableAbility(fixture(), "dex", { score: 18, modifier: 4 });
  assert.deepEqual(next.facts.abilities.dex, { score: 18, modifier: 4 });
  assert.equal(next.facts.savingThrows.dex, 4);
  assert.deepEqual(next.facts.initiative, { modifier: 3, provenance: "dex_modifier" });
  assert.equal(next.header.primaryRows.find((row) => row.field === "initiative")?.text, "Initiative +3");
});

test("editing the Initiative field is authoritative after document creation", () => {
  const next = editEditableHeaderText(fixture(), "header-initiative-derived", "Initiative +8");
  assert.deepEqual(next.facts.initiative, { modifier: 8, provenance: "dex_modifier" });
  assert.equal(next.facts.abilities.dex?.modifier, 3);
});

test("printed save can be edited independently from ability modifier", () => {
  const next = editEditableSavingThrow(fixture(), "dex", 7);
  assert.equal(next.header.savingThrows.dex, 7);
  assert.equal(next.facts.savingThrows.dex, 7);
  assert.deepEqual(next.facts.abilities.dex, { score: 16, modifier: 3 });
});

test("body node text editing is editor-owned and does not touch facts", () => {
  const source = fixture();
  const next = editEditableNodeText(source, "bite", "Bite. Hit: 99.");
  assert.equal(next.body.find((node) => node.id === "bite")?.text, "Bite. Hit: 99.");
  assert.deepEqual(next.facts, source.facts);
});

test("split creates a new editor paragraph with fresh id", () => {
  const source = fixture();
  const offset = source.body.find((node) => node.id === "bite")!.text.indexOf("Hit:");
  const next = splitEditableNodeAt(source, "bite", offset, () => "split");
  const index = next.body.findIndex((node) => node.id === "bite");
  assert.equal(next.body[index]?.text, "Bite. ");
  assert.deepEqual(next.body[index + 1], { id: "split", type: "paragraph", text: "Hit: 7 (1d8 + 3) piercing damage." });
});

test("merge removes current node and keeps previous editor-owned node id", () => {
  const next = mergeEditableNodeWithPrevious(fixture(), "tail");
  assert.equal(
    next.body.some((node) => node.id === "tail"),
    false,
  );
  assert.equal(
    next.body.find((node) => node.id === "bite")?.text,
    "Bite. Hit: 7 (1d8 + 3) piercing damage.Tail. Hit: 6 (1d6 + 3) bludgeoning damage.",
  );
});

test("heading toggle changes authoring node type, not parser metadata", () => {
  const heading = toggleEditableNodeHeading(fixture(), "bite");
  const bite = heading.body.find((node) => node.id === "bite");
  assert.equal(bite?.type, "heading");
  const restored = toggleEditableNodeHeading(heading, "bite");
  assert.equal(restored.body.find((node) => node.id === "bite")?.type, "paragraph");
});

test("new paragraphs and header rows can be created without parser participation", () => {
  let next = insertEditableNodeAfter(fixture(), "tail", { type: "paragraph", text: "New paragraph" }, () => "new-node");
  assert.equal(next.body.at(-1)?.id, "new-node");
  next = addEditableHeaderRow(next, "other_header", "Custom Header Value", () => "new-row");
  assert.equal(next.header.secondaryRows[0]?.id, "new-row");
});

test("remove node operates on current authoring document", () => {
  const next = removeEditableNode(fixture(), "tail");
  assert.equal(
    next.body.some((node) => node.id === "tail"),
    false,
  );
});

test("bold/italic authoring markup does not corrupt deterministic header facts", () => {
  const next = editEditableHeaderText(fixture(), "ac", "**Armor Class 22**");
  assert.equal(next.facts.armorClass, 22);
});

test("Delete-style merge keeps current node id and consumes the following node", () => {
  const next = mergeEditableNodeWithNext(fixture(), "bite");
  assert.equal(
    next.body.some((node) => node.id === "tail"),
    false,
  );
  assert.equal(
    next.body.find((node) => node.id === "bite")?.text,
    "Bite. Hit: 7 (1d8 + 3) piercing damage.Tail. Hit: 6 (1d6 + 3) bludgeoning damage.",
  );
});

test("removing a card-critical AC row clears its value but preserves the labelled repair slot", () => {
  const next = removeEditableHeaderRow(fixture(), "ac");
  assert.equal(next.header.primaryRows.find((row) => row.id === "ac")?.text, "Armor Class");
  assert.equal(next.facts.armorClass, null);
});

test("removing the proficiency row clears the fact instead of restoring a stale value", () => {
  const source = fixture();
  source.header.secondaryRows.push({ id: "pb", field: "proficiency_bonus", text: "Proficiency Bonus +3" });
  const next = removeEditableHeaderRow(source, "pb");
  assert.equal(next.facts.proficiencyBonus, null);
});

test("clearing the proficiency value does not resurrect the previously imported fact", () => {
  const source = fixture();
  source.header.secondaryRows.push({ id: "pb", field: "proficiency_bonus", text: "Proficiency Bonus +3" });
  const next = editEditableHeaderText(source, "pb", "Proficiency Bonus");
  assert.equal(next.facts.proficiencyBonus, null);
});

test("merge boundary operations are no-ops when there is no neighbor", () => {
  const source = fixture();
  assert.equal(mergeEditableNodeWithPrevious(source, "actions"), source);
  assert.equal(mergeEditableNodeWithNext(source, "tail"), source);
});

test("formatting-safe split accepts independently valid markup fragments", () => {
  let source = fixture();
  source = editEditableNodeText(source, "bite", "**Bite attack** and *effect*");
  const next = splitEditableNodeText(source, "bite", "**Bite**", "** attack** and *effect*", () => "formatted-split");
  assert.equal(next.body.find((node) => node.id === "bite")?.text, "**Bite**");
  assert.equal(next.body.find((node) => node.id === "formatted-split")?.text, "** attack** and *effect*");
});

test("missing name can be created and then edited through the product editor", () => {
  const source = fixture();
  source.header.name = null;
  source.facts.name = null;

  const named = setEditableHeaderName(source, "Recovered Name", () => "recovered-name");
  assert.equal(named.header.name?.id, "recovered-name");
  assert.equal(named.header.name?.text, "Recovered Name");
  assert.equal(named.facts.name, "Recovered Name");

  const cleared = setEditableHeaderName(named, "");
  assert.equal(cleared.header.name?.text, "");
  assert.equal(cleared.facts.name, null);
});

test("missing subtitle can be created without parser participation", () => {
  const source = fixture();
  source.header.subtitle = null;
  const next = setEditableHeaderSubtitle(source, "Large Fiend, Chaotic Evil", () => "subtitle-new");
  assert.deepEqual(next.header.subtitle, {
    id: "subtitle-new",
    field: "size_type_alignment",
    text: "Large Fiend, Chaotic Evil",
  });
});

test("subtitle is optional, can be explicitly created, and disappears when cleared", () => {
  const source = fixture();
  source.header.subtitle = null;

  const added = ensureEditableHeaderSubtitle(source, () => "subtitle-slot");
  assert.deepEqual(added.header.subtitle, {
    id: "subtitle-slot",
    field: "size_type_alignment",
    text: "",
  });

  const filled = setEditableHeaderSubtitle(added, "Large Fiend, Chaotic Evil");
  assert.equal(filled.header.subtitle?.text, "Large Fiend, Chaotic Evil");

  const cleared = setEditableHeaderSubtitle(filled, "");
  assert.equal(cleared.header.subtitle, null);
});

test("Auto Style writes editable authoring markup idempotently", () => {
  const source = fixture();
  source.header.subtitle = { id: "subtitle", field: "size_type_alignment", text: "Medium Beast, Neutral" };
  const styled = applyEditableAutoStyle(source);

  assert.equal(styled.header.name?.text, "**Test Beast**");
  assert.equal(styled.header.subtitle?.text, "*Medium Beast, Neutral*");
  assert.equal(styled.header.primaryRows.find((row) => row.field === "armor_class")?.text, "**Armor Class** 18");
  assert.equal(styled.header.primaryRows.find((row) => row.field === "initiative")?.text, "**Initiative** +3");
  assert.equal(styled.header.primaryRows.find((row) => row.field === "hit_points")?.text, "**Hit Points** 100");
  assert.equal(styled.body[0]?.type, "heading");
  assert.equal(styled.body[0]?.text, "**Actions**");
  assert.equal(styled.body[1]?.text, "***Bite.*** Hit: 7 (1d8 + 3) piercing damage.");
  assert.equal(styled.facts.name, "Test Beast");

  styled.body.push({
    id: "lowercase",
    type: "heading",
    headingKind: "actions",
    text: "**saving throws against spells. continuation**",
  });
  styled.body.push({
    id: "prose",
    type: "heading",
    headingKind: "actions",
    text: "***The creature immediately begins to suffocate.***",
  });
  const restyled = applyEditableAutoStyle(styled);
  assert.equal(restyled.body.at(-2)?.type, "paragraph");
  assert.equal(restyled.body.at(-2)?.text, "saving throws against spells. continuation");
  assert.equal(restyled.body.at(-1)?.type, "paragraph");
  assert.equal(restyled.body.at(-1)?.text, "The creature immediately begins to suffocate.");

  const extended = fixture();
  extended.body = [
    {
      id: "legendary-resistance",
      type: "paragraph",
      text: "Legendary Resistance (3/Day, or 4/Day in Lair). If the creature fails a save, it succeeds instead.",
    },
    {
      id: "chromatic-wrath",
      type: "paragraph",
      text: "Chromatic Wrath (Recharges after a Short or Long Rest). The aspect returns to battle.",
    },
  ];
  const extendedStyled = applyEditableAutoStyle(extended);
  assert.equal(
    extendedStyled.body[0]?.text,
    "***Legendary Resistance (3/Day, or 4/Day in Lair).*** If the creature fails a save, it succeeds instead.",
  );
  assert.equal(
    extendedStyled.body[1]?.text,
    "**Chromatic Wrath (Recharges after a Short or Long Rest).** The aspect returns to battle.",
  );

  // Running the command again is idempotent and does not add nested markup.
  assert.deepEqual(applyEditableAutoStyle(restyled), restyled);
});

test("Auto Style uses the exact source-proven header label without normalizing aliases", () => {
  const source = fixture();
  source.header.secondaryRows = [
    { id: "res", field: "damage_resistances", text: "Resistances Cold, Fire, Lightning" },
    { id: "imm", field: "damage_immunities", text: "Immunities Poison; Charmed" },
    { id: "full", field: "damage_resistances", text: "Damage Resistances Acid" },
  ];

  const styled = applyEditableAutoStyle(source);
  assert.equal(styled.header.secondaryRows[0]?.text, "**Resistances** Cold, Fire, Lightning");
  assert.equal(styled.header.secondaryRows[1]?.text, "**Immunities** Poison; Charmed");
  assert.equal(styled.header.secondaryRows[2]?.text, "**Damage Resistances** Acid");
});

test("manual header row can be inserted directly after the focused row", () => {
  const source = fixture();
  const next = addEditableHeaderRow(source, "other_header", "Inserted", () => "inserted", "ac");
  assert.equal(next.header.primaryRows[1]?.id, "inserted");
});

test("Auto Style italicizes a short line-leading colon label", () => {
  const source = fixture();
  source.body = [
    { id: "cantrips", type: "paragraph", text: "Cantrips (at will): chill touch, mage hand" },
    { id: "level", type: "paragraph", text: "1st level (4 slots): shield, magic missile" },
  ];
  const styled = applyEditableAutoStyle(source);
  assert.equal(styled.body[0]?.text, "*Cantrips (at will):* chill touch, mage hand");
  assert.equal(styled.body[1]?.text, "*1st level (4 slots):* shield, magic missile");
  assert.deepEqual(applyEditableAutoStyle(styled), styled);
});

test("Auto Style colon labels do not erase feature-title bold markup", () => {
  const source = fixture();
  source.body = [
    {
      id: "multiattack",
      type: "paragraph",
      text: "Multiattack. The dragon makes three attacks: one Bite and two Claw attacks.",
    },
    { id: "bite", type: "paragraph", text: "Bite. Melee Weapon Attack: +15 to hit, reach 15 ft., one target." },
    {
      id: "legendary",
      type: "paragraph",
      text: "Legendary Resistance (3/Day). If the dragon fails a saving throw, it succeeds instead.",
    },
  ];
  const styled = applyEditableAutoStyle(source);
  assert.equal(
    styled.body[0]?.text,
    "***Multiattack.*** The dragon makes three attacks: one Bite and two Claw attacks.",
  );
  assert.equal(styled.body[1]?.text, "***Bite.*** Melee Weapon Attack: +15 to hit, reach 15 ft., one target.");
  assert.equal(
    styled.body[2]?.text,
    "***Legendary Resistance (3/Day).*** If the dragon fails a saving throw, it succeeds instead.",
  );
  assert.deepEqual(applyEditableAutoStyle(styled), styled);
});

test("Auto Style keeps compact parenthetical feature metadata bold-italic", () => {
  const source = fixture();
  source.body = [
    { id: "breath", type: "paragraph", text: "Acid Breath (Recharge 5–6). The dragon exhales acid." },
    { id: "wing", type: "paragraph", text: "Wing Attack (Costs 2 Actions). The dragon beats its wings." },
  ];

  const styled = applyEditableAutoStyle(source);
  assert.equal(styled.body[0]?.text, "***Acid Breath (Recharge 5–6).*** The dragon exhales acid.");
  assert.equal(styled.body[1]?.text, "***Wing Attack (Costs 2 Actions).*** The dragon beats its wings.");
});

test("Auto Style preserves physical line geometry inside one paragraph and styles each source line locally", () => {
  const document = fixture();
  document.body = [
    {
      id: "spellcasting",
      type: "paragraph",
      text: "Innate Spellcasting. The creature casts spells.\n\nAt will: detect magic\n3/day each: dispel magic\n1/day each: teleport",
    },
  ];

  const styled = applyEditableAutoStyle(document);
  assert.equal(
    styled.body[0]?.text,
    "***Innate Spellcasting.*** The creature casts spells.\n\n*At will:* detect magic\n*3/day each:* dispel magic\n*1/day each:* teleport",
  );
});

test("Auto Style italicizes a numbered short subeffect title without styling its prose", () => {
  const document = fixture();
  document.body = [
    {
      id: "gaze-list",
      type: "paragraph",
      text: "1. Beguiling Gaze. The target is stunned until the start of Demogorgon’s next turn.\n2. Hypnotic Gaze. The target is charmed until the start of Demogorgon’s next turn.\n3. Insanity Gaze. The target suffers the effect of the confusion spell.",
    },
  ];

  const styled = applyEditableAutoStyle(document);
  assert.equal(
    styled.body[0]?.text,
    "*1. Beguiling Gaze.* The target is stunned until the start of Demogorgon’s next turn.\n*2. Hypnotic Gaze.* The target is charmed until the start of Demogorgon’s next turn.\n*3. Insanity Gaze.* The target suffers the effect of the confusion spell.",
  );
  assert.deepEqual(applyEditableAutoStyle(styled), styled);
});

test("Auto Style does not italicize a numbered prose sentence that is not title-shaped", () => {
  const document = fixture();
  document.body = [
    { id: "plain-number", type: "paragraph", text: "1. The target is stunned until the end of its next turn." },
  ];
  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.text, "1. The target is stunned until the end of its next turn.");
});

test("Auto Style treats exclamation and question title terminators like periods", () => {
  const document = fixture();
  document.body = [
    { id: "bang", type: "paragraph", text: "Tally Ho! The fieldian emits a rallying cry." },
    { id: "question", type: "paragraph", text: "Who Goes There? The guardian calls out." },
  ];
  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.text, "***Tally Ho!*** The fieldian emits a rallying cry.");
  assert.equal(styled.body[1]?.text, "***Who Goes There?*** The guardian calls out.");
});

test("Auto Style italicizes bulleted subeffect titles instead of promoting them to peer feature styling", () => {
  const document = fixture();
  document.body = [
    {
      id: "breath-options",
      type: "paragraph",
      text: "Breath Weapons (Recharge 5–6). The dragon uses one of the following breath weapons:\n• Antimagic Bomb. The dragon spits a globule of antimagic.\n• Force Breath. The dragon exhales pure disintegrating force.",
    },
  ];

  const styled = applyEditableAutoStyle(document);
  assert.equal(
    styled.body[0]?.text,
    "***Breath Weapons (Recharge 5–6).*** The dragon uses one of the following breath weapons:\n*• Antimagic Bomb.* The dragon spits a globule of antimagic.\n*• Force Breath.* The dragon exhales pure disintegrating force.",
  );
  assert.deepEqual(applyEditableAutoStyle(styled), styled);
});

test("Auto Style does not treat a list marker at the start of a semantic paragraph as proof of a nested subeffect", () => {
  const document = fixture();
  document.body = [
    { id: "bite", type: "paragraph", text: "- Bite. Melee Weapon Attack: +7 to hit." },
    { id: "claw", type: "paragraph", text: "+ Claw. Melee Weapon Attack: +7 to hit." },
    { id: "tail", type: "paragraph", text: "• Tail Attack. The creature makes a Tail attack." },
  ];

  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.text, "- ***Bite.*** Melee Weapon Attack: +7 to hit.");
  assert.equal(styled.body[1]?.text, "+ ***Claw.*** Melee Weapon Attack: +7 to hit.");
  assert.equal(styled.body[2]?.text, "• ***Tail Attack.*** The creature makes a Tail attack.");
  assert.deepEqual(applyEditableAutoStyle(styled), styled);
});

test("Auto Style bolds a short section-rules colon lead immediately after a section heading", () => {
  const source = fixture();
  source.body = [
    { id: "legendary-heading", type: "heading", headingKind: "legendary_actions", text: "Legendary Actions" },
    {
      id: "legendary-rules",
      type: "paragraph",
      text: "Legendary Action Uses: 3 (4 in Lair). Immediately after another creature's turn, the aboleth can expend a use.",
    },
    { id: "tail", type: "paragraph", text: "Tail Swipe. The aboleth makes one tail attack." },
  ];

  const styled = applyEditableAutoStyle(source);
  assert.equal(
    styled.body[1]?.text,
    "**Legendary Action Uses:** 3 (4 in Lair). Immediately after another creature's turn, the aboleth can expend a use.",
  );
  assert.equal(styled.body[2]?.text, "***Tail Swipe.*** The aboleth makes one tail attack.");
});

test("Auto Style keeps an internal compact colon row italic instead of promoting it to section-rules bold", () => {
  const source = fixture();
  source.body = [
    { id: "actions-heading", type: "heading", headingKind: "actions", text: "Actions" },
    { id: "bite", type: "paragraph", text: "Bite. Melee Weapon Attack: +16 to hit.\nHit: 28 piercing damage." },
  ];

  const styled = applyEditableAutoStyle(source);
  assert.equal(styled.body[1]?.text, "***Bite.*** Melee Weapon Attack: +16 to hit.\n*Hit:* 28 piercing damage.");
});

test("Auto Style italicizes a standalone mechanical colon row even when it arrives as its own paragraph", () => {
  const source = fixture();
  source.body = [
    { id: "actions-heading", type: "heading", headingKind: "actions", text: "Actions" },
    { id: "bite", type: "paragraph", text: "Bite. Melee Weapon Attack: +16 to hit, reach 15 ft., one target." },
    { id: "hit", type: "paragraph", text: "Hit: 28 (3d12 + 9) piercing damage and 21 (6d6) force damage." },
  ];

  const styled = applyEditableAutoStyle(source);
  assert.equal(styled.body[1]?.text, "***Bite.*** Melee Weapon Attack: +16 to hit, reach 15 ft., one target.");
  assert.equal(styled.body[2]?.text, "*Hit:* 28 (3d12 + 9) piercing damage and 21 (6d6) force damage.");
});

test("Auto Style recognizes a title-shaped feature when copied text loses the space after its terminator", () => {
  const source = fixture();
  source.body = [
    { id: "legendary-heading", type: "heading", headingKind: "legendary_actions", text: "Legendary Actions" },
    { id: "rules", type: "paragraph", text: "Kraken can take 3 legendary actions, choosing from the options below." },
    {
      id: "fling",
      type: "paragraph",
      text: "Tentacle Attack or Fling.The kraken makes one tentacle attack or uses its Fling.",
    },
    { id: "storm", type: "paragraph", text: "Lightning Storm (Costs 2 Actions).The kraken uses Lightning Storm." },
    {
      id: "ink",
      type: "paragraph",
      text: "Ink Cloud (Costs 3 Actions).While underwater, the kraken expels an ink cloud.",
    },
  ];

  const styled = applyEditableAutoStyle(source);
  assert.equal(
    styled.body[2]?.text,
    "***Tentacle Attack or Fling.***The kraken makes one tentacle attack or uses its Fling.",
  );
  assert.equal(styled.body[3]?.text, "***Lightning Storm (Costs 2 Actions).***The kraken uses Lightning Storm.");
  assert.equal(
    styled.body[4]?.text,
    "***Ink Cloud (Costs 3 Actions).***While underwater, the kraken expels an ink cloud.",
  );
});

test("Auto Style uses structural Label shape rather than a mechanical vocabulary", () => {
  const source = fixture();
  source.body = [
    { id: "actions", type: "heading", headingKind: "actions", text: "Actions" },
    { id: "strike", type: "paragraph", text: "Strike. The creature attacks.\nOutcome: 12 points of damage." },
  ];
  const styled = applyEditableAutoStyle(source);
  assert.equal(styled.body[1]?.text, "***Strike.*** The creature attacks.\n*Outcome:* 12 points of damage.");
});

test("Auto Style classifies compact numeric parenthetical metadata by shape", () => {
  const source = fixture();
  source.body = [
    { id: "actions", type: "heading", headingKind: "actions", text: "Actions" },
    { id: "pulse", type: "paragraph", text: "Pulse (2 Charges). The creature emits a pulse." },
    { id: "rest", type: "paragraph", text: "Ward (Returns after a Short or Long Rest). The creature raises a ward." },
  ];
  const styled = applyEditableAutoStyle(source);
  assert.equal(styled.body[1]?.text, "***Pulse (2 Charges).*** The creature emits a pulse.");
  assert.equal(styled.body[2]?.text, "**Ward (Returns after a Short or Long Rest).** The creature raises a ward.");
});

test("Auto Style italicizes an inline compact label after completed feature prose without styling the first mechanics clause", () => {
  const source = fixture();
  source.body = [
    { id: "actions", type: "heading", headingKind: "actions", text: "Actions" },
    {
      id: "fist",
      type: "paragraph",
      text: "Phantasmal Fist. Melee Weapon Attack: +16 to hit, reach 30 ft., one creature. Hit: 23 (3d8 + 9) bludgeoning damage.",
    },
  ];

  const styled = applyEditableAutoStyle(source);
  assert.equal(
    styled.body[1]?.text,
    "***Phantasmal Fist.*** Melee Weapon Attack: +16 to hit, reach 30 ft., one creature. *Hit:* 23 (3d8 + 9) bludgeoning damage.",
  );
  assert.deepEqual(applyEditableAutoStyle(styled), styled);
});

test("Auto Style inline compact-label handling is vocabulary-free", () => {
  const source = fixture();
  source.body = [
    { id: "actions", type: "heading", headingKind: "actions", text: "Actions" },
    {
      id: "strike",
      type: "paragraph",
      text: "Arc Strike. Primary Clause: +7 to resolve, one target. Outcome: 12 points of damage.",
    },
  ];

  const styled = applyEditableAutoStyle(source);
  assert.equal(
    styled.body[1]?.text,
    "***Arc Strike.*** Primary Clause: +7 to resolve, one target. *Outcome:* 12 points of damage.",
  );
});

test("Auto Style supports short sentence-case localized feature titles", () => {
  const document = fixture();
  document.body = [
    {
      id: "ru-feature",
      type: "paragraph",
      text: "Разорвать серебряную нить. Если существо совершает критическое попадание, происходит эффект.",
    },
  ];
  const styled = applyEditableAutoStyle(document);
  assert.equal(
    styled.body[0]?.text,
    "***Разорвать серебряную нить.*** Если существо совершает критическое попадание, происходит эффект.",
  );
});

test("Auto Style bolds localized printed saving-throw labels", () => {
  const document = fixture();
  document.header.secondaryRows = [
    { id: "localized-saves", field: "saving_throws", text: "Спасброски Лов +5, Мдр +9" },
  ];
  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.header.secondaryRows[0]?.text, "**Спасброски** Лов +5, Мдр +9");
});

test("Auto Style recognizes localized description headings", () => {
  const document = fixture();
  document.body = [{ id: "description-heading", type: "heading", headingKind: "description", text: "Описание" }];
  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.text, "**Описание**");
});

test("Auto Style presentation fallback bolds a known printed header label without changing semantic ownership", () => {
  const document = fixture();
  document.header.secondaryRows = [
    { id: "misclassified-resistance", field: "skills", text: "Сопротивление урону дробящий, колющий" },
  ];
  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.header.secondaryRows[0]?.field, "skills");
  assert.equal(styled.header.secondaryRows[0]?.text, "**Сопротивление урону** дробящий, колющий");
});

test("Auto Style presentation fallback styles a known unresolved preamble label without promoting the paragraph", () => {
  const document = fixture();
  document.body = [
    { id: "source-meta", type: "paragraph", text: "ERLW p303" },
    { id: "unknown-save-row", type: "paragraph", text: "Спасброски Лов +5, Мдр +9" },
    { id: "trait", type: "paragraph", text: "Амфибия. Существо может дышать воздухом и водой." },
  ];
  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[1]?.type, "paragraph");
  assert.equal(styled.body[1]?.text, "**Спасброски** Лов +5, Мдр +9");
  assert.equal(styled.body[2]?.text, "***Амфибия.*** Существо может дышать воздухом и водой.");
});

test("Auto Style presentation fallback does not turn a feature title equal to a header word into a header label", () => {
  const document = fixture();
  document.body = [{ id: "senses-feature", type: "paragraph", text: "Senses. The creature extends its awareness." }];
  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.text, "***Senses.*** The creature extends its awareness.");
});

test("Auto Style continues a nested bullet sequence across adjacent semantic paragraphs", () => {
  const document = fixture();
  document.body = [
    {
      id: "breath-parent",
      type: "paragraph",
      text: "Breath Weapons (Recharge 5–6). The dragon uses one of the following breath weapons:\n• Antimagic Bomb. The dragon spits a globule of antimagic.",
    },
    {
      id: "force-breath",
      type: "paragraph",
      text: "• Force Breath. The dragon exhales pure disintegrating force.",
    },
  ];

  const styled = applyEditableAutoStyle(document);
  assert.equal(
    styled.body[0]?.text,
    "***Breath Weapons (Recharge 5–6).*** The dragon uses one of the following breath weapons:\n*• Antimagic Bomb.* The dragon spits a globule of antimagic.",
  );
  assert.equal(styled.body[1]?.text, "*• Force Breath.* The dragon exhales pure disintegrating force.");
  assert.deepEqual(applyEditableAutoStyle(styled), styled);
});

test("Auto Style keeps separate leading bullet paragraphs as peer features without a nested-list introducer", () => {
  const document = fixture();
  document.body = [
    { id: "bite", type: "paragraph", text: "• Bite. The creature bites." },
    { id: "claw", type: "paragraph", text: "• Claw. The creature claws." },
  ];

  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.text, "• ***Bite.*** The creature bites.");
  assert.equal(styled.body[1]?.text, "• ***Claw.*** The creature claws.");
});

test("Auto Style preserves structurally typed and untyped headings with one shared rule", () => {
  const document = fixture();
  document.body = [
    { id: "ru-actions", type: "heading", headingKind: null, text: "Действия" },
    { id: "ru-feature", type: "paragraph", text: "Мультиатака. Существо совершает две атаки." },
    { id: "ru-legendary", type: "heading", headingKind: null, text: "Легендарные действия" },
    { id: "ru-rules", type: "paragraph", text: "Астральный Дредноут может совершить 3 легендарных действия." },
  ];

  const styled = applyEditableAutoStyle(document);

  assert.equal(styled.body[0]?.type, "heading");
  assert.equal(styled.body[0]?.type === "heading" ? styled.body[0].headingKind : "not-heading", null);
  assert.equal(styled.body[0]?.text, "**Действия**");
  assert.equal(styled.body[1]?.type, "paragraph");
  assert.match(styled.body[1]?.text ?? "", /Мультиатака/u);
  assert.equal(styled.body[2]?.type, "heading");
  assert.equal(styled.body[2]?.type === "heading" ? styled.body[2].headingKind : "not-heading", null);
  assert.equal(styled.body[2]?.text, "**Легендарные действия**");
  assert.equal(styled.body[3]?.type, "paragraph");
});

test("Auto Style rescues a standalone heading-shaped paragraph from body context without vocabulary", () => {
  const document = fixture();
  document.body = [
    { id: "section", type: "paragraph", text: "ΩМЕГА РОЗДІЛ" },
    { id: "feature", type: "paragraph", text: "Крижаний подих. Істота видихає мороз." },
  ];

  const styled = applyEditableAutoStyle(document);

  assert.equal(styled.body[0]?.type, "heading");
  assert.equal(styled.body[0]?.type === "heading" ? styled.body[0].headingKind : "not-heading", null);
  assert.equal(styled.body[0]?.text, "**ΩМЕГА РОЗДІЛ**");
});

test("Auto Style heading rescue is invariant under section-label vocabulary changes", () => {
  const labels = ["TRAITS", "Действия", "ДІЇ", "SPECIAL POWERS", "ΩМЕГА РОЗДІЛ"];
  for (const label of labels) {
    const document = fixture();
    document.body = [
      { id: `section-${label}`, type: "paragraph", text: label },
      { id: `feature-${label}`, type: "paragraph", text: "Crystal Wake. The creature releases a pulse." },
    ];
    const styled = applyEditableAutoStyle(document);
    assert.equal(styled.body[0]?.type, "heading", label);
    assert.equal(styled.body[0]?.type === "heading" ? styled.body[0].headingKind : "not-heading", null, label);
  }
});

test("Auto Style emphasizes a short feature name with a long parenthesized metadata phrase", () => {
  const document = fixture();
  document.body = [
    {
      id: "mythic-trait",
      type: "paragraph",
      text: "Сбрасывание кожи (Мифическая особенность; Перезарядка после короткого или продолжительного отдыха). Если хиты Гитонии уменьшаются до 0, она не умирает.",
    },
  ];

  const styled = applyEditableAutoStyle(document);

  assert.equal(
    styled.body[0]?.text,
    "**Сбрасывание кожи (Мифическая особенность; Перезарядка после короткого или продолжительного отдыха).** Если хиты Гитонии уменьшаются до 0, она не умирает.",
  );
});

test("Auto Style never promotes a paragraph to heading from wording alone", () => {
  const document = fixture();
  document.body = [{ id: "unknown-label", type: "paragraph", text: "Действия" }];
  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.type, "paragraph");
  assert.equal(styled.body[0]?.text, "Действия");
});

test("Auto Style does not promote heading-shaped metadata when following content is not a named rule", () => {
  const document = fixture();
  document.body = [
    { id: "label", type: "paragraph", text: "Languages" },
    { id: "value", type: "paragraph", text: "Common, Infernal" },
  ];
  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.type, "paragraph");
  assert.equal(styled.body[1]?.type, "paragraph");
});

test("Auto Style rescues a standalone heading before one explanatory paragraph and named peer entries", () => {
  const document = fixture();
  document.body = [
    { id: "legendary", type: "paragraph", text: "Legendary Actions" },
    {
      id: "rules",
      type: "paragraph",
      text: "The creature can take 3 special options, choosing from the options below.",
    },
    { id: "fling", type: "paragraph", text: "Fling. The creature throws one target." },
  ];

  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.type, "heading");
  assert.equal(styled.body[0]?.type === "heading" ? styled.body[0].headingKind : "not-heading", null);
  assert.equal(styled.body[0]?.text, "**Legendary Actions**");
  assert.equal(styled.body[1]?.type, "paragraph");
  assert.equal(styled.body[2]?.type, "paragraph");
  assert.deepEqual(applyEditableAutoStyle(styled).body, styled.body);
});

test("Auto Style does not rescue arbitrary heading-shaped text before two ordinary prose paragraphs", () => {
  const document = fixture();
  document.body = [
    { id: "label", type: "paragraph", text: "Languages" },
    { id: "value", type: "paragraph", text: "Common and Infernal are understood by the creature." },
    { id: "more", type: "paragraph", text: "This sentence is also ordinary prose without a named-rule lead." },
  ];
  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.type, "paragraph");
});

test("Auto Style demotes comma-list rows that were incorrectly typed as headings", () => {
  const document = fixture();
  document.body = [
    {
      id: "condition",
      type: "heading",
      headingKind: null,
      text: "Condition Immunities Charmed, Deafened, Frightened, Paralyzed, Stunned",
    },
    { id: "languages", type: "heading", headingKind: null, text: "Languages Common, Draconic" },
    { id: "traits", type: "heading", headingKind: null, text: "Traits" },
  ];

  const styled = applyEditableAutoStyle(document);
  assert.equal(styled.body[0]?.type, "paragraph");
  assert.equal(styled.body[1]?.type, "paragraph");
  assert.equal(styled.body[2]?.type, "heading");
  assert.equal(styled.body[2]?.text, "**Traits**");
});

test("Auto Style demotes short printed header-value rows that otherwise look heading-shaped", () => {
  const document = fixture();
  document.body = [
    { id: "condition", type: "heading", headingKind: null, text: "Condition Immunities poisoned" },
    { id: "damage", type: "heading", headingKind: null, text: "Damage Immunities radiant" },
    { id: "languages", type: "heading", headingKind: null, text: "Languages None" },
    { id: "traits", type: "heading", headingKind: null, text: "Traits" },
  ];

  const styled = applyEditableAutoStyle(document);
  assert.deepEqual(
    styled.body.slice(0, 3).map((node) => [node.type, node.text]),
    [
      ["paragraph", "**Condition Immunities** poisoned"],
      ["paragraph", "**Damage Immunities** radiant"],
      ["paragraph", "**Languages** None"],
    ],
  );
  assert.equal(styled.body[3]?.type, "heading");
  assert.equal(styled.body[3]?.text, "**Traits**");
  assert.deepEqual(applyEditableAutoStyle(styled).body, styled.body);
});

test("Auto Style keeps lowercase table/noise labels as paragraphs", () => {
  const document = fixture();
  document.body = [
    { id: "mod", type: "paragraph", text: "mod" },
    { id: "save", type: "paragraph", text: "save" },
  ];
  const styled = applyEditableAutoStyle(document);
  assert.deepEqual(
    styled.body.map((node) => [node.type, node.text]),
    [
      ["paragraph", "mod"],
      ["paragraph", "save"],
    ],
  );
});

test("toggle heading does not infer semantic kind from wording", () => {
  const document = fixture();
  document.body = [{ id: "actions", type: "paragraph", text: "Actions" }];
  const toggled = toggleEditableNodeHeading(document, "actions");
  assert.equal(toggled.body[0]?.type, "heading");
  assert.equal(toggled.body[0]?.type === "heading" ? toggled.body[0].headingKind : "not-heading", null);
});
