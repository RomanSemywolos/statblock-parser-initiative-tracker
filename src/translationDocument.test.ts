import test from "node:test";
import assert from "node:assert/strict";
import { translateEditableStatblockDeterministic } from "./translationDocument.js";
import type { EditableStatblockDocument } from "./productModel.js";

function fixture(): EditableStatblockDocument {
  return {
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: { id: "n", field: "name", text: "Test Fiend" },
      subtitle: null,
      primaryRows: [{ id: "ac", field: "armor_class", text: "Armor Class 18" }],
      abilities: {
        str: { score: 10, modifier: 0 },
        dex: { score: 16, modifier: 3 },
        con: null,
        int: null,
        wis: null,
        cha: null,
      },
      savingThrows: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
      secondaryRows: [],
    },
    body: [
      { id: "h", type: "heading", headingKind: "actions", text: "Actions" },
      { id: "a", type: "paragraph", text: "Claw. Melee Weapon Attack: +7 to hit. Hit: 12 (2d6 + 5) slashing damage." },
    ],
    facts: {
      name: "Test Fiend",
      armorClass: 18,
      hitPointMaximum: null,
      initiative: { modifier: 3, provenance: "dex_modifier" },
      abilities: {
        str: { score: 10, modifier: 0 },
        dex: { score: 16, modifier: 3 },
        con: null,
        int: null,
        wis: null,
        cha: null,
      },
      savingThrows: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
      proficiencyBonus: null,
    },
  };
}

test("deterministic document translation preserves structure/mechanics and localizes semantic headings", () => {
  const result = translateEditableStatblockDeterministic(fixture());
  assert.equal(result.document.language, "uk");
  assert.equal(result.document.body[0]?.type, "heading");
  assert.equal(result.document.body[0]?.text, "Дії");
  assert.match(result.document.body[1]?.text ?? "", /\+7/);
  assert.match(result.document.body[1]?.text ?? "", /2d6 \+ 5/);
  assert.equal(result.issues.length, 0);
  assert.equal(result.document.body.length, 2);
});

test("structured header ownership localizes known labels without guessing from prose", () => {
  const source = fixture();
  source.header.primaryRows = [
    { id: "ac", field: "armor_class", text: "**Armor Class** 18 (Natural Armor)" },
    { id: "hp", field: "hit_points", text: "**Hit Points** 100 (10d10 + 40)" },
    { id: "init", field: "initiative", text: "**Initiative** +7 (17)" },
  ];
  const result = translateEditableStatblockDeterministic(source);
  assert.match(result.document.header.primaryRows[0]?.text ?? "", /^\*\*Клас броні\*\*/u);
  assert.match(result.document.header.primaryRows[1]?.text ?? "", /^\*\*Хіти\*\*/u);
  assert.match(result.document.header.primaryRows[2]?.text ?? "", /^\*\*Ініціатива\*\*/u);
  assert.match(result.document.header.primaryRows[0]?.text ?? "", /Природний обладунок/u);
});

test("structured Ukrainian header translates saves, skills, damage and condition atoms", () => {
  const source = fixture();
  source.header.savingThrows = { str: 8, dex: 7, con: 9, int: 16, wis: 16, cha: 18 };
  source.header.secondaryRows = [
    { id: "skills", field: "skills", text: "Skills Intimidation +18, Perception +16" },
    {
      id: "res",
      field: "damage_resistances",
      text: "Damage Resistances Cold, Fire, Radiant; Bludgeoning, Piercing, and Slashing from Nonmagical Attacks",
    },
    {
      id: "imm",
      field: "damage_immunities",
      text: "Immunities Necrotic, Poison; Charmed, Exhaustion, Frightened, Poisoned",
    },
    { id: "cond", field: "condition_immunities", text: "Condition Immunities Blinded, Deafened, Stunned" },
    { id: "sense", field: "senses", text: "Senses Truesight 120 ft., Passive Perception 26" },
    { id: "lang", field: "languages", text: "Languages Common, Telepathy 120 ft." },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.equal(result.header.savingThrows.cha, 18);
  assert.match(result.header.secondaryRows[0]?.text ?? "", /Залякування \+18, Сприйняття \+16/u);
  assert.match(result.header.secondaryRows[1]?.text ?? "", /холод, вогонь, сяюча/u);
  assert.match(result.header.secondaryRows[1]?.text ?? "", /дробильна, колюча, та рубальна/u);
  assert.match(
    result.header.secondaryRows[2]?.text ?? "",
    /некротична, отрута; зачарований, виснаження, наляканий, отруєний/u,
  );
  assert.match(result.header.secondaryRows[3]?.text ?? "", /осліплений, оглухлий, приголомшений/u);
  assert.match(result.header.secondaryRows[4]?.text ?? "", /істинний зір 120 футів, пасивне Сприйняття 26/u);
  assert.match(result.header.secondaryRows[5]?.text ?? "", /Телепатія 120 футів/u);
});

test("type line translates size, creature type, subtype and alignment with basic gender agreement", () => {
  const source = fixture();
  source.header.subtitle = { id: "sub", field: "size_type_alignment", text: "*Large Fiend (Devil), Lawful Evil*" };
  const result = translateEditableStatblockDeterministic(source).document;
  assert.equal(result.header.subtitle?.text, "*Велика нечисть (диявол), законно-зла*");

  source.header.subtitle = {
    id: "sub2",
    field: "size_type_alignment",
    text: "*Gargantuan Dragon (Chromatic), Chaotic Evil*",
  };
  const dragon = translateEditableStatblockDeterministic(source).document;
  assert.equal(dragon.header.subtitle?.text, "*Колосальний дракон (хроматичний), хаотично-злий*");
});

test("structured speed and senses localize movement modes and feet", () => {
  const source = fixture();
  source.header.primaryRows.push({
    id: "speed",
    field: "speed",
    text: "Speed 40 ft., Burrow 20 ft., Fly 80 ft., Swim 40 ft.",
  });
  source.header.secondaryRows.push({
    id: "sense",
    field: "senses",
    text: "Senses Darkvision 120 ft., Passive Perception 18",
  });
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(
    result.header.primaryRows[1]?.text ?? "",
    /Швидкість 40 футів, риття 20 футів, політ 80 футів, плавання 40 футів/u,
  );
  assert.match(result.header.secondaryRows[0]?.text ?? "", /темнозір 120 футів, пасивне Сприйняття 18/u);
});

test("known trait titles translate only in the title slot", () => {
  const source = fixture();
  source.body = [
    {
      id: "t1",
      type: "paragraph",
      text: "***Magic Resistance.*** The creature has advantage on saving throws against spells.",
    },
    { id: "t2", type: "paragraph", text: "***Amphibious.*** The creature can breathe air and water." },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(result.body[0]?.text ?? "", /^\*\*\*Стійкість до магії\.\*\*\*/u);
  assert.match(result.body[1]?.text ?? "", /^\*\*\*Амфібія\.\*\*\*/u);
});

test("literal other_header condition label gets safe fallback localization", () => {
  const source = fixture();
  source.header.secondaryRows = [
    {
      id: "other",
      field: "other_header",
      text: "Condition Immunities Blinded, Charmed, Deafened, Frightened, Poisoned, Stunned",
    },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(result.header.secondaryRows[0]?.text ?? "", /^Імунітети до станів /u);
  assert.match(
    result.header.secondaryRows[0]?.text ?? "",
    /осліплений, зачарований, оглухлий, наляканий, отруєний, приголомшений/u,
  );
});

test("type-line subtype and structured language names use safe deterministic localization", () => {
  const source = fixture();
  source.header.subtitle = {
    id: "sub3",
    field: "size_type_alignment",
    text: "*Gargantuan Dragon (Chromatic), Chaotic Evil*",
  };
  source.header.secondaryRows = [
    { id: "lang2", field: "languages", text: "Languages Common, Draconic, Infernal, Telepathy 120 ft." },
    { id: "cr2", field: "challenge", text: "CR 10 (XP 5,900, or 7,200 in lair)" },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.equal(result.header.subtitle?.text, "*Колосальний дракон (хроматичний), хаотично-злий*");
  assert.match(result.header.secondaryRows[0]?.text ?? "", /Загальна, Драконяча, Інфернальна, Телепатія 120 футів/u);
  assert.match(result.header.secondaryRows[1]?.text ?? "", /або 7,200 у лігві/u);
});

test("type-line handles non-nine-grid alignment forms without forcing gender agreement", () => {
  const source = fixture();
  source.header.subtitle = {
    id: "sub4",
    field: "size_type_alignment",
    text: "*Medium Humanoid, Any Non-Good Alignment*",
  };
  const anyAlignment = translateEditableStatblockDeterministic(source).document;
  assert.equal(anyAlignment.header.subtitle?.text, "*Середній гуманоїд, будь-який недобрий світогляд*");

  source.header.subtitle = { id: "sub5", field: "size_type_alignment", text: "*Huge Construct, Unaligned*" };
  const unaligned = translateEditableStatblockDeterministic(source).document;
  assert.equal(unaligned.header.subtitle?.text, "*Величезний конструкт, без світогляду*");
});

test("trait metadata is localized even when the trait name itself is unresolved", () => {
  const source = fixture();
  source.body = [
    { id: "m1", type: "paragraph", text: "***Furious Bite (Costs 2 Actions).*** The aspect makes one Bite attack." },
    {
      id: "m2",
      type: "paragraph",
      text: "***Chromatic Wrath (Recharges after a Short or Long Rest).*** If reduced to 0 hit points...",
    },
    {
      id: "m3",
      type: "paragraph",
      text: "***Legendary Resistance (3/day, or 4/day in Lair).*** If the aboleth fails...",
    },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(result.body[0]?.text ?? "", /\(Коштує 2 дії\)/u);
  assert.match(result.body[1]?.text ?? "", /\(Відновлюється після короткого або тривалого відпочинку\)/u);
  assert.match(result.body[2]?.text ?? "", /\(3\/день, або 4\/день у лігві\)/u);
});

test("physical damage resistance qualifier is translated as one grammatical header phrase", () => {
  const source = fixture();
  source.header.secondaryRows = [
    {
      id: "res2",
      field: "damage_resistances",
      text: "Damage Resistances Cold, Fire; Bludgeoning, Piercing, and Slashing from Nonmagical Attacks that aren't Silvered",
    },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(
    result.header.secondaryRows[0]?.text ?? "",
    /дробильна, колюча, та рубальна від немагічних атак непосрібленою зброєю/u,
  );
  assert.doesNotMatch(result.header.secondaryRows[0]?.text ?? "", /\bfrom\b/iu);
});

test("closed statblock vocabularies cover official senses, languages, habitats and armor descriptors", () => {
  const source = fixture();
  source.header.primaryRows = [
    { id: "ac2", field: "armor_class", text: "AC 18 (Plate Armor, Shield)" },
    { id: "speed2", field: "speed", text: "Speed 30 ft., Fly 60 ft. (hover)" },
  ];
  source.header.secondaryRows = [
    {
      id: "sense2",
      field: "senses",
      text: "Senses Blindsight 30 ft., Darkvision 120 ft., Tremorsense 60 ft., Truesight 30 ft.; Passive Perception 18",
    },
    {
      id: "lang3",
      field: "languages",
      text: "Languages Common Sign Language, Druidic, Thieves’ Cant, Aquan, Auran, Ignan, Terran, None",
    },
    {
      id: "hab",
      field: "habitat",
      text: "Habitat Any, Arctic, Coastal, Desert, Forest, Grassland, Hill, Mountain, Swamp, Underdark, Underwater, Urban",
    },
    { id: "cr3", field: "challenge", text: "Challenge Rating 10 (XP 5,900; PB +4)" },
    { id: "res3", field: "damage_resistances", text: "Damage Resistances Cold, Fire" },
    { id: "vul3", field: "damage_vulnerabilities", text: "Damage Vulnerabilities Radiant" },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(result.header.primaryRows[0]?.text ?? "", /^Клас броні 18 \(Лати, Щит\)$/u);
  assert.match(result.header.primaryRows[1]?.text ?? "", /політ 60 футів \(зависання\)/u);
  assert.match(
    result.header.secondaryRows[0]?.text ?? "",
    /сліпе чуття 30 футів, темнозір 120 футів, відчуття вібрації 60 футів, істинний зір 30 футів; пасивне Сприйняття 18/u,
  );
  assert.match(
    result.header.secondaryRows[1]?.text ?? "",
    /Загальна жестова мова, Друїдська, Злодійський жаргон, Акван, Ауран, Ігнан, Терран, Немає/u,
  );
  assert.match(
    result.header.secondaryRows[2]?.text ?? "",
    /^Середовище Будь-яке, Арктика, Узбережжя, Пустеля, Ліс, Степ, Пагорби, Гори, Болото, Підзем'я, Під водою, Місто$/u,
  );
  assert.match(result.header.secondaryRows[3]?.text ?? "", /^Небезпека 10/u);
  assert.match(result.header.secondaryRows[4]?.text ?? "", /^Опори до шкоди /u);
  assert.match(result.header.secondaryRows[5]?.text ?? "", /^Вразливості /u);
});

test("final deterministic physical qualifier handles magic weapons and attacks", () => {
  const source = fixture();
  source.header.secondaryRows = [
    {
      id: "resMagic",
      field: "damage_resistances",
      text: "Damage Resistances Bludgeoning, Piercing, and Slashing from Magic Weapons",
    },
    { id: "resMagicAttack", field: "damage_resistances", text: "Damage Resistances Fire from Magical Attacks" },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(result.header.secondaryRows[0]?.text ?? "", /дробильна, колюча, та рубальна від магічної зброї/u);
  assert.match(result.header.secondaryRows[1]?.text ?? "", /вогонь від магічних атак/u);
});

test("structural header localization handles printed aliases without a translation-owned alias dictionary", () => {
  const source = fixture();
  source.header.secondaryRows = [
    { id: "savesAlias", field: "saving_throws", text: "**Saves** STR +5" },
    { id: "vulnAlias", field: "damage_vulnerabilities", text: "**Vulnerabilities** Fire" },
    { id: "pbAlias", field: "proficiency_bonus", text: "**PB** +4" },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(result.header.secondaryRows[0]?.text ?? "", /^\*\*Ряткидки\*\*/u);
  assert.match(result.header.secondaryRows[1]?.text ?? "", /^\*\*Вразливості\*\*/u);
  assert.match(result.header.secondaryRows[2]?.text ?? "", /^\*\*Бонус майстерності\*\*/u);
});

test("translated known feature titles preserve exclamation and question terminators", () => {
  const source = fixture();
  source.body = [
    { id: "bang", type: "paragraph", text: "***Magic Resistance!*** The creature resists magic." },
    { id: "question", type: "paragraph", text: "***Amphibious?*** The creature can breathe air and water." },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(result.body[0]?.text ?? "", /^\*\*\*Стійкість до магії!\*\*\*/u);
  assert.match(result.body[1]?.text ?? "", /^\*\*\*Амфібія\?\*\*\*/u);
});

test("legacy unstyled header aliases use the semantic classifier fallback", () => {
  const source = fixture();
  source.header.secondaryRows = [
    { id: "savesLegacy", field: "saving_throws", text: "Saves STR +5" },
    { id: "vulnLegacy", field: "damage_vulnerabilities", text: "Vulnerabilities Fire" },
    { id: "pbLegacy", field: "proficiency_bonus", text: "PB +4" },
  ];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(result.header.secondaryRows[0]?.text ?? "", /^Ряткидки/u);
  assert.match(result.header.secondaryRows[1]?.text ?? "", /^Вразливості/u);
  assert.match(result.header.secondaryRows[2]?.text ?? "", /^Бонус майстерності/u);
});

test("header localization never treats arbitrary full-row bold markup as a label boundary", () => {
  const source = fixture();
  source.header.secondaryRows = [{ id: "manualBold", field: "saving_throws", text: "**Saves STR +5**" }];
  const result = translateEditableStatblockDeterministic(source).document;
  assert.match(result.header.secondaryRows[0]?.text ?? "", /STR|СИЛ/u);
  assert.notEqual(result.header.secondaryRows[0]?.text, "**Ряткидки**");
});
