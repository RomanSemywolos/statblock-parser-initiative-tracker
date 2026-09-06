import test from "node:test";
import assert from "node:assert/strict";
import { detectParserStructure } from "./parserRouting.js";

test("auto detects a clean multiline statblock", () => {
  const source = `Adult Black Dragon\nHuge dragon, chaotic evil\nArmor Class 19\nHit Points 195\nSpeed 40 ft., fly 80 ft.\nSaving Throws DEX +7, CON +10\nSkills Perception +11\nSenses blindsight 60 ft.\nLanguages Common, Draconic\nChallenge 14\nTraits\nAmphibious. The dragon can breathe air and water.\nActions\nMultiattack. The dragon makes three attacks.\nBite. Melee Weapon Attack: +11 to hit.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "multiline");
  assert.equal(result.selectedMode, "multiline");
  assert.ok(result.confidence > 0.7);
});

test("auto detects a collapsed single-line statblock", () => {
  const source = `Adult Black Dragon Huge dragon, chaotic evil Armor Class 19 Hit Points 195 Speed 40 ft., fly 80 ft. Saving Throws DEX +7, CON +10 Skills Perception +11 Senses blindsight 60 ft. Languages Common, Draconic Challenge 14 Traits Amphibious. The dragon can breathe air and water. Actions Multiattack. The dragon makes three attacks. Bite. Melee Weapon Attack: +11 to hit. Claw. Melee Weapon Attack: +11 to hit. Tail. Melee Weapon Attack: +11 to hit.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "singleline");
  assert.equal(result.selectedMode, "singleline");
});

test("auto detects mixed structure and routes it to unchanged generic parser", () => {
  const source = `Adult Black Dragon\nHuge dragon, chaotic evil\nArmor Class 19\nHit Points 195\nSpeed 40 ft., fly 80 ft.\nSaving Throws DEX +7, CON +10\nSkills Perception +11\nSenses blindsight 60 ft.\nLanguages Common, Draconic\nChallenge 14\nTraits\nAmphibious. The dragon can breathe air and water.\nActions Multiattack. The dragon makes three attacks. Bite. Melee Weapon Attack: +11 to hit. Claw. Melee Weapon Attack: +11 to hit. Tail. Melee Weapon Attack: +11 to hit.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "mixed");
  assert.equal(result.selectedMode, "generic");
  assert.ok(result.signals.some((signal) => signal.code === "mixed_structure"));
});

test("a long normal multiline prose paragraph does not make the source mixed", () => {
  const source = `Adult Black Dragon\nHuge dragon, chaotic evil\nArmor Class 19\nHit Points 195\nSpeed 40 ft., fly 80 ft.\nSaving Throws DEX +7, CON +10\nSkills Perception +11\nSenses blindsight 60 ft.\nLanguages Common, Draconic\nChallenge 14\nTraits\nFrightful Presence. Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 19 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours.\nActions\nMultiattack. The dragon makes three attacks.\nBite. Melee Weapon Attack: +11 to hit.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "multiline");
  assert.equal(result.selectedMode, "multiline");
});

test("sentence-like prose is not counted as collapsed feature evidence", () => {
  const source = `Adult Black Dragon\nArmor Class 19\nHit Points 195\nSpeed 40 ft.\nActions\nMultiattack. The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.\nFrightful Presence. Each creature must succeed on a saving throw. A creature can repeat the saving throw. If it succeeds, the effect ends.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "multiline");
  assert.equal(result.selectedMode, "multiline");
});

test("short but clean statblock uses anchor density instead of few-line fallback", () => {
  const source = `Tiny Construct, Unaligned\nArmor Class 12\nHit Points 3`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "multiline");
  assert.equal(result.selectedMode, "multiline");
  assert.ok(
    result.signals.some(
      (signal) => signal.code === "shape_density_fallback" || signal.code === "isolated_anchor_ratio",
    ),
  );
});

test("four collapsed physical lines are not mistaken for multiline merely because there are four lines", () => {
  const source = `Ancient Dragon Armor Class 22 Hit Points 367 Speed 40 ft.\nSTR 27 DEX 14 CON 25 INT 16 WIS 15 CHA 19 Saving Throws DEX +9 CON +14 Skills Perception +16\nActions Multiattack. The dragon makes three attacks. Bite. Melee Weapon Attack: +15 to hit. Claw. Melee Weapon Attack: +15 to hit.\nLegendary Actions Detect. The dragon makes a Wisdom check. Tail Attack. The dragon makes a tail attack. Wing Attack (Costs 2 Actions). The dragon beats its wings.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "singleline");
  assert.equal(result.selectedMode, "singleline");
});

test("preserved header plus collapsed body is mixed", () => {
  const source = `Ancient Dragon\nArmor Class 22\nHit Points 367\nSpeed 40 ft.\nSaving Throws DEX +9, CON +14\nSkills Perception +16\nActions Multiattack. The dragon makes three attacks. Bite. Melee Weapon Attack: +15 to hit. Claw. Melee Weapon Attack: +15 to hit.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "mixed");
  assert.equal(result.selectedMode, "generic");
});

test("manual parser mode bypasses automatic detection", () => {
  const result = detectParserStructure("Anything at all", "multiline");
  assert.equal(result.detectedStructure, null);
  assert.equal(result.selectedMode, "multiline");
  assert.equal(result.confidence, 1);
  assert.equal(result.signals[0]?.code, "manual_override");
});

test("confirmed numbered subeffects do not make clean multiline input mixed", () => {
  const source = `Demogorgon
Huge Fiend (Demon), Chaotic Evil

Armor Class 22 (natural armor)
Hit Points 406 (28d12 + 224)
Speed 50 ft., Swim 50 ft.
Saving Throws DEX +10, CON +16, WIS +11, CHA +15
Skills Insight +11, Perception +19
Senses Truesight 120 ft.
Languages All
Challenge 26
Proficiency Bonus +8

Traits
Innate Spellcasting. Demogorgon can innately cast spells.

At will: detect magic, major image

3/day each: dispel magic, fear, telekinesis

1/day each: feeblemind, project image

Actions
Multiattack. Demogorgon makes two tentacle attacks.
Tentacle. Melee Weapon Attack: +17 to hit.
Gaze. Demogorgon turns his magical gaze toward one creature.
If the target fails the save, it suffers one of the following effects:

1. Beguiling Gaze. The target is stunned until the start of Demogorgon's next turn.

2. Hypnotic Gaze. The target is charmed by Demogorgon until the start of his next turn.

3. Insanity Gaze. The target suffers the effect of confusion.

Legendary Actions
Demogorgon can take 2 legendary actions.
Tail. Melee Weapon Attack: +17 to hit.
Maddening Gaze. Demogorgon uses his Gaze action.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "multiline");
  assert.equal(result.selectedMode, "multiline");
  assert.equal(
    result.signals.some((signal) => signal.code === "mixed_structure"),
    false,
  );
});

test("column-wrapped body routes to mixed because logical structures cross physical rows", () => {
  const source = `Lolth, Queen of the
Demonweb
Huge fiend (demon), chaotic evil
Armor Class 18 (Natural Armor)
Hit Points 542 (35d12 + 315)
Speed 40 ft., climb 40 ft.
STR DEX CON INT WIS CHA
25 (+7) 27 (+8) 29 (+9) 25 (+7) 17 (+3) 25 (+7)
Saving Throws DEX +16, CON +17, WIS +11
Skills Deception +23, History +15, Perception +11
Damage Resistances Cold, Fire, Lightning
Damage Immunities Poison; Bludgeoning, Piercing, and
Slashing from Nonmagical Attacks
Condition Immunities Blinded, Charmed, Deafened,
Exhaustion, Frightened, Grappled, Paralyzed,
Petrified, Poisoned, Prone, Restrained, Stunned,
Unconscious
Senses Truesight 120 ft., Passive Perception 22
Languages All, Telepathy 120 ft.
Challenge 27 (105,000 XP)
Nexus of the Great Web. Lolth knows the location,
identity, and current hit points of any creature in
contact with a spider's web, and cannot be Surprised.
By the Dark Mother's Design. Lolth does not roll
initiative. Instead, if she has not yet taken a turn this
round, Lolth may take her turn directly after any other
creature's turn.
Spider Climb. Lolth can climb difficult surfaces,
including upside down on ceilings, without needing to
make an ability check.
Magic Resistance. Lolth has advantage on saving throws
against spells and other magical effects.
Actions
Multiattack. Lolth makes three attacks with her Impaling
Legs, one of which she may replace with a use of her
Kiss of Lolth or Insidious Embrace.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "mixed");
  assert.equal(result.selectedMode, "generic");
  assert.ok(
    result.signals.some(
      (signal) => signal.code === "soft_wrapped_column" || signal.code === "wrapped_structure_continuation",
    ),
  );
  assert.ok(result.signals.some((signal) => signal.code === "mixed_wrapped_structure"));
});

test("body prose that begins with a header-like word cannot hide a soft-wrapped mixed region", () => {
  const source = `ADULT IMPERIAL DRAGON
Gargantuan dragon, any lawful alignment
Armor Class 22 (natural armor)
Hit Points 385 (22d20 + 154)
Speed 50 ft., fly 100 ft.
Saving Throws Str +16, Dex +10, Con +14, Wis +13
Skills Athletics +23, Insight +13
Damage Resistances bludgeoning, piercing, and
slashing from nonmagical attacks
Senses blindsight 60 ft., darkvision 120 ft.
Languages Common, Draconic
Challenge 21 (27,500 XP)
TRAITS
Heavy Armor. The dragon reduces damage it takes from
weapon attacks by 10.
Improved Critical. The dragon's weapon attacks score a critical
hit on an 18-20.
ACTIONS
Dread Visage. Each creature of the dragon's choice within 120
feet of the dragon that are aware of it must succeed on a DC 21
Wisdom saving throw or become frightened for 1 minute. While
frightened in this way, a creature must take the Dash action and
move away from the dragon by the safest available route.
LEGENDARY ACTIONS
Power Dive (Costs 2 Actions). The dragon flies up to its
speed in a straight line and immediately makes a weapon attack
at the end of that movement. On a successful hit, the attack deals
an additional 3 (1d6) bludgeoning damage.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "mixed");
  assert.equal(result.selectedMode, "generic");
  assert.ok(
    result.signals.some(
      (signal) => signal.code === "soft_wrapped_column" || signal.code === "wrapped_structure_continuation",
    ),
  );
  assert.ok(result.signals.some((signal) => signal.code === "mixed_wrapped_structure"));
});

test("one named body structure split across physical rows is mixed even without collapsed peers", () => {
  const source = `Actions
Breath Weapon. Each creature in the cone must make
a Dexterity saving throw or take damage.
Bite. Melee Weapon Attack: +7 to hit.`;
  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "mixed");
  assert.equal(result.selectedMode, "generic");
  assert.ok(result.signals.some((signal) => signal.code === "wrapped_structure_continuation"));
  assert.ok(result.signals.some((signal) => signal.code === "mixed_wrapped_structure"));
});

test("router counts exclamation and question feature titles as the same structural evidence as period titles", () => {
  const source = `Creature
Large fiend, evil
Armor Class 18
Hit Points 100
Actions
Tally Ho! The creature emits a rallying cry.
Who Goes There? The creature challenges an intruder.`;
  const result = detectParserStructure(source);
  assert.equal(result.selectedMode, "multiline");
});

test("routing keeps compact AC HP CR aliases out of its conservative header evidence", () => {
  const source = `Test Creature
AC 17
HP 100
CR 5
Traits
Alert. The creature cannot be surprised.`;
  const result = detectParserStructure(source, "auto");

  assert.equal(
    result.signals.some((signal) => signal.code === "clean_header_run"),
    false,
  );
  assert.equal(
    result.signals.some((signal) => signal.code === "isolated_header_fields"),
    false,
  );
});

test("routing recognizes compact metadata geometry without any English header alias", () => {
  const source = `Тестовое существо
Класс Доспеха 17
Хиты 100
Скорость 30 футов
Спасброски Лов +4
Навыки Восприятие +5
Черты
Бдительность. Существо нельзя застать врасплох.`;
  const result = detectParserStructure(source, "auto");

  assert.equal(result.selectedMode, "multiline");
  assert.ok(
    result.signals.some((signal) => signal.code === "clean_metadata_run" || signal.code === "isolated_metadata_rows"),
  );
});

test("Russian vertical statblock routes to multiline without English profile anchors", () => {
  const source = `Астральный Дредноут [Astral Dreadnought]
Громадный монстр (титан), без мировоззрения
Класс Доспеха 20 (природный доспех)
Хиты 297 (17к20 + 119)
Скорость 15 футов, летая 80 футов (парит)
Сил 28 (+9)
Лов 7 (-2)
Тел 25 (+7)
Инт 5 (-3)
Мдр 14 (+2)
Хар 18 (+4)
Спасброски Лов +5, Мдр +9
Навыки Восприятие +9
Опасность 21 (33 000 опыта)
Бонус мастерства +7
Антимагический конус. Открытый глаз создаёт антимагическую зону.
Астральная сущность. Дредноут не может покинуть Астральный План.
Действия
Мультиатака. Дредноут совершает три атаки.
Укус. Рукопашная атака оружием: +16 к попаданию.`;
  const result = detectParserStructure(source, "auto");

  assert.equal(result.detectedStructure, "multiline");
  assert.equal(result.selectedMode, "multiline");
  assert.ok(result.signals.some((signal) => signal.code === "clean_metadata_run"));
});

test("tiny lowercase table-cell rows do not turn otherwise clean Rak-style geometry into mixed input", () => {
  const source = `Rak Tulkhesh
Huge Fiend, Neutral Evil
AC 23 (natural armor; 25 versus ranged attacks)
Initiative +4 (14)
HP 478 (33d12 + 264)
Speed 40 ft., Climb 40 ft., Fly 80 ft.
mod
save
mod
save
mod
save
Str
29
+9
+17
Dex
19
+4
+4
Con
27
+8
+16
Int
21
+5
+5
Wis
22
+6
+14
Cha
26
+8
+16
Skills Athletics +17, Intimidation +16, Perception +14
Resistances Cold, Fire, Lightning
Immunities Poison; Bludgeoning, Piercing, and Slashing from nonmagical attacks; Charmed, Exhaustion, Frightened, Paralyzed, Poisoned, Stunned
Senses Truesight 120 ft., Passive Perception 24
Languages All, telepathy 120 ft.
CR 28 (XP 120 000; PB +8)
Traits
Deadly Critical. Rak Tulkhesh scores a critical hit on a roll of 19 or 20.
Actions
Multiattack. Rak Tulkhesh makes four weapon attacks.
Legendary Actions
Attack. Rak Tulkhesh makes one weapon attack.`;

  const result = detectParserStructure(source);
  assert.equal(result.detectedStructure, "multiline");
  assert.equal(result.selectedMode, "multiline");
  assert.equal(
    result.signals.some((signal) => signal.code === "mixed_wrapped_structure"),
    false,
  );
});

test("routing corpus keeps representative source geometries on their intended parser path", () => {
  const corpus = [
    {
      name: "clean multiline metadata and features",
      source: [
        "Creature",
        "Large fiend, evil",
        "Armor Class 18",
        "Hit Points 100",
        "Speed 30 ft.",
        "Traits",
        "Alert. The creature cannot be surprised.",
        "Actions",
        "Bite. Melee Weapon Attack: +7 to hit.",
      ].join("\n"),
      structure: "multiline",
      mode: "multiline",
    },
    {
      name: "soft-wrapped prose mixed with structural rows",
      source: [
        "Creature",
        "Armor Class 18",
        "Hit Points 100",
        "Actions",
        "Dread Visage. Each creature within 120",
        "feet of the creature must succeed on",
        "a saving throw or become frightened",
        "until the end of its next turn while",
        "the creature remains within sight.",
        "Bite. Melee Weapon Attack: +7 to hit.",
      ].join("\n"),
      structure: "mixed",
      mode: "generic",
    },
    {
      name: "fully collapsed single physical row",
      source:
        "Creature Large fiend, evil Armor Class 18 Hit Points 100 Actions Bite. Melee Weapon Attack: +7 to hit. Claw. Melee Weapon Attack: +7 to hit.",
      structure: "singleline",
      mode: "singleline",
    },
    {
      name: "tiny lowercase table cells remain multiline",
      source: [
        "Creature",
        "Huge Fiend, Neutral Evil",
        "AC 23",
        "HP 478",
        "mod",
        "save",
        "mod",
        "save",
        "mod",
        "save",
        "Str",
        "29",
        "+9",
        "+17",
        "Dex",
        "19",
        "+4",
        "+4",
        "Actions",
        "Attack. The creature attacks.",
      ].join("\n"),
      structure: "multiline",
      mode: "multiline",
    },
    {
      name: "localized clean multiline geometry",
      source: [
        "Істота",
        "Великий монстр",
        "Клас броні 18",
        "Хіти 100",
        "Швидкість 30 футів",
        "Особливості",
        "Пильність. Істоту не можна застати зненацька.",
        "Дії",
        "Укус. Рукопашна атака зброєю: +7 до влучання.",
      ].join("\n"),
      structure: "multiline",
      mode: "multiline",
    },
  ] as const;

  for (const entry of corpus) {
    const result = detectParserStructure(entry.source);
    assert.equal(result.detectedStructure, entry.structure, entry.name);
    assert.equal(result.selectedMode, entry.mode, entry.name);
  }
});
