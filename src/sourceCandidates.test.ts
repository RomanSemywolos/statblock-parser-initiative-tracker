import test from "node:test";
import assert from "node:assert/strict";

import { createLosslessSourceMap } from "./losslessSource.js";
import {
  createSourceCandidates,
  enrichGenericCandidates,
  enrichMultilineCandidates,
  enrichSinglelineCandidates,
} from "./sourceCandidates.js";

function candidateStartingWith(source: string, prefix: string): number {
  const documentStart = source.startsWith(prefix) ? 0 : -1;
  const lfStart = source.indexOf(`\n${prefix}`);
  const crStart = source.indexOf(`\r${prefix}`);
  const lineStarts = [lfStart, crStart].filter((index) => index >= 0).map((index) => index + 1);
  const index =
    documentStart >= 0 ? documentStart : lineStarts.length > 0 ? Math.min(...lineStarts) : source.indexOf(prefix);

  assert.notEqual(index, -1, `fixture is missing ${JSON.stringify(prefix)}`);

  return index;
}

function assertCandidateAt(source: string, prefix: string): void {
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const expectedStart = candidateStartingWith(source, prefix);

  assert.equal(
    candidates.some((candidate) => candidate.start === expectedStart),
    true,
    `expected a candidate at ${JSON.stringify(prefix)}`,
  );
}

test("creates language-neutral candidates from document, lines, paragraphs and punctuation", () => {
  const source = [
    "Ім'я істоти",
    "Велика потвора",
    "",
    "Перша риса. Опис. Друга риса. Інший опис.",
    "Ключ: значення",
  ].join("\n");

  const candidates = createSourceCandidates(source, createLosslessSourceMap(source));

  assertCandidateAt(source, "Ім'я істоти");
  assertCandidateAt(source, "Велика потвора");
  assertCandidateAt(source, "Перша риса.");
  assertCandidateAt(source, "Опис.");
  assertCandidateAt(source, "Друга риса.");
  assert.equal(
    candidates.some((candidate) => candidate.preview.startsWith("Інший опис.")),
    false,
  );
  assert.equal(
    candidates.some((candidate) => candidate.preview.startsWith("Ключ:")),
    false,
  );

  const first = candidates.find((candidate) => candidate.start === 0);
  assert.ok(first);
  assert.deepEqual(first.reasons, ["document_start", "line_start"]);

  const paragraphStart = candidateStartingWith(source, "Перша риса.");
  const paragraph = candidates.find((candidate) => candidate.start === paragraphStart);
  assert.ok(paragraph);
  assert.equal(paragraph.reasons.includes("line_start"), true);
  assert.equal(paragraph.reasons.includes("paragraph_start"), true);
});

test("adds a candidate after a colon without assigning any semantic meaning", () => {
  const source = "Розділ: Перша дія. Опис.";
  const candidates = createSourceCandidates(source, createLosslessSourceMap(source));
  const start = candidateStartingWith(source, "Перша дія.");
  const candidate = candidates.find((current) => current.start === start);

  assert.ok(candidate);
  assert.equal(candidate.reasons.includes("colon_start"), true);
});

test("marks compact rows followed by several numeric cells as table-like without knowing labels", () => {
  const source = "СИЛ ЛОВ ТЕЛ ІНТ МДР ХАР\n25 (+7) 27 (+8) 29 (+9) 25 (+7) 17 (+3) 25 (+7)\nНаступне поле";
  const candidates = createSourceCandidates(source, createLosslessSourceMap(source));
  const tableStart = candidateStartingWith(source, "СИЛ ЛОВ ТЕЛ");
  const candidate = candidates.find((current) => current.start === tableStart);

  assert.ok(candidate);
  assert.equal(candidate.reasons.includes("table_row_start"), true);
});

test("handles LF, CRLF and CR line starts without changing source coordinates", () => {
  for (const separator of ["\n", "\r\n", "\r"]) {
    const source = ["Alpha", "Beta", "Gamma"].join(separator);
    const sourceMap = createLosslessSourceMap(source);
    const candidates = createSourceCandidates(source, sourceMap);

    for (const prefix of ["Alpha", "Beta", "Gamma"]) {
      const start = candidateStartingWith(source, prefix);
      const candidate = candidates.find((current) => current.start === start);

      assert.ok(candidate, `${JSON.stringify(separator)} ${prefix}`);
      assert.equal(sourceMap.units.find((unit) => unit.id === candidate.startUnitId)?.start, start);
    }
  }
});

test("keeps candidate count bounded on a long wrapped statblock while covering important starts", () => {
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
Legendary Resistances (5/Day). If Lolth fails a saving
throw, she can choose to succeed instead.
Actions
Multiattack. Lolth makes three attacks with her Impaling
Legs, one of which she may replace with a use of her
Kiss of Lolth or Insidious Embrace.
Kiss of Lolth. Melee Weapon Attack: +15 to hit, reach
15 ft., one creature. Hit: 26 (3d12 + 7) piercing
damage and the target is Cursed.
While Cursed in this way, a creature is Poisoned, loses
any immunity to the Poisoned condition or poison
damage, and takes 5 (1d10) poison damage at the end
of each of its turns.
This curse is suppressed for 24 hours by any effect
that cures the Poisoned condition.
Impaling Legs. Melee Weapon Attack: +15 to hit, reach
15 ft., one creature. Hit: 20 (3d8 + 7) piercing damage
and Lolth may either grapple the target (escape DC 23)
or push it 10 feet away.
A creature reduced to 0 hit points by this damage
immediately fails a death save.
Insidious Embrace. One creature within 15 feet of Lolth
must succeed on a DC 23 Strength saving throw or be
restrained (escape DC 23) in a cocoon of silk.
While restrained in this way, a creature is Blinded and
has its Charisma score reduced by 5 (2d4) at the end
of each of its turns, which lasts until it escapes. A
creature that has its Charisma score reduced to 0 in
this way immediately emerges as a Chwidencha under
Lolth's control.
Darkfire Abyss (9th Level Spell, Recharge 5-6). A burst of
black fire erupts in a 15 foot radius centered on a point
Lolth can see within 120 feet, leaving behind an area of
magical darkness that lasts until dispelled.
Each light in the area is extinguished, and each creature
in the area must succeed on a DC 23 Dexterity saving
throw or take 70 (20d6) fire damage, or half as much
on a success.
At the beginning of each of Lolth's turns, if a source of
Bright Light is within 15 feet of the area its radius
expands by 5 feet, then each creature in the area takes
17 (5d6) fire damage.
Reactions
Strands of the Demonweave (5th Level Spell). As a
reaction when a creature she can see within 60 feet
casts a spell, Lolth weaves a portion of the expended
magic into threads of binding silk.
Any damage dealt by the spell is reduced by half, and
the spell's caster must succeed on a DC 23 Strength
saving throw or be restrained (escape DC 23) until it
takes any damage.
Compelled Betrayal. As a reaction when Lolth is targeted
with a ranged attack, she causes the attack to swerve
and instead target a creature in the attack's range
affected by her Kiss of Lolth.
Legendary Actions
Lolth can take 4 legendary actions, choosing from the
options below.
Bounding Strike. Lolth leaps up to 20 feet to an
unoccupied space, then makes a Impaling Legs attack.
Bide Time. Lolth moves up to half her speed and gains
20 temporary hit points.
Lolth's Fickle Favor (Costs 2 Actions). One friendly
creature Lolth can see may use its reaction to move up
to its speed and make an attack. If the attack misses,
the creature explodes in a torrent of venomous spiders.
Each creature within 15 feet of it must succeed on a
DC 23 Constitution saving throw or take 10 (3d6)
piercing plus 14 (4d6) poison damage, or half as much
on a success.
Spider's Embrace (Costs 3 Actions). Lolth teleports up to
40 feet to an unoccupied space she can see, then
forces one creature within 5 feet to make a DC 23
Strength saving throw.
On a failed save, the creature is grappled (escape DC
23\\) and Lolth makes an attack against it with her kiss
of Lolth.`;

  const candidates = createSourceCandidates(source, createLosslessSourceMap(source));

  const expectedStarts = [
    "Lolth, Queen of the",
    "Huge fiend (demon), chaotic evil",
    "Armor Class 18 (Natural Armor)",
    "STR DEX CON INT WIS CHA",
    "Nexus of the Great Web.",
    "By the Dark Mother's Design.",
    "Legendary Resistances (5/Day).",
    "Actions",
    "Multiattack.",
    "Kiss of Lolth.",
    "Impaling Legs.",
    "Insidious Embrace.",
    "Darkfire Abyss",
    "Reactions",
    "Strands of the Demonweave",
    "Compelled Betrayal.",
    "Legendary Actions",
    "Bounding Strike.",
    "Bide Time.",
    "Lolth's Fickle Favor",
    "Spider's Embrace",
  ];

  for (const prefix of expectedStarts) {
    const expectedStart = candidateStartingWith(source, prefix);

    assert.equal(
      candidates.some((candidate) => candidate.start === expectedStart),
      true,
      `expected candidate coverage for ${JSON.stringify(prefix)}`,
    );
  }

  assert.ok(candidates.length >= expectedStarts.length);
  assert.ok(candidates.length <= 180, `candidate list unexpectedly grew to ${candidates.length}`);

  const tableCandidate = candidates.find(
    (candidate) => candidate.start === candidateStartingWith(source, "STR DEX CON INT WIS CHA"),
  );

  assert.ok(tableCandidate);
  assert.equal(tableCandidate.reasons.includes("table_row_start"), true);
});

test("smart proposals keep wrapped Nabassu traits together", () => {
  const source = `Challenge 8 (3,900 XP)
Magic Resistance. The nabassu has advantage on
saving throws against spells and other magical
effects.
Banished From the Abyss. The nabassu can treat any
20 foot or taller archway in the Abyss that is at
least 20 feet as a one-way portal to a random spot
on the material plane.
Draining Gaze. When a creature that can see the
nabassu starts its turn within 30 feet of it, the nabassu can force it to make a save.
Actions
Multiattack. The nabassu makes three melee attacks.`;
  const candidates = createSourceCandidates(source, createLosslessSourceMap(source));
  const previews = candidates.map((candidate) => candidate.preview);

  assert.equal(
    previews.some((preview) => preview.startsWith("Magic Resistance.")),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("Banished From the Abyss.")),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("Draining Gaze.")),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("Actions")),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("saving throws against")),
    false,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("20 foot or taller")),
    false,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("nabassu starts")),
    false,
  );
});

test("smart proposals keep saving throw resolution inside one Aboleth action", () => {
  const source = `Actions
Consume Memories. Intelligence Saving Throw: DC 16, one creature within 30 feet. Failure: 10 (3d6) Psychic damage. Success: Half damage. Failure or Success: The aboleth gains the target’s memories.
Dominate Mind (2/Day). Wisdom Saving Throw: DC 16, one creature the aboleth can see.`;
  const candidates = createSourceCandidates(source, createLosslessSourceMap(source));
  const previews = candidates.map((candidate) => candidate.preview);

  assert.equal(
    previews.some((preview) => preview.startsWith("Consume Memories.")),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("Dominate Mind (2/Day).")),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("Failure:")),
    false,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("Success:")),
    false,
  );
});

test("returns no candidates for empty or whitespace-only source", () => {
  for (const source of ["", "   \t\r\n"]) {
    assert.deepEqual(createSourceCandidates(source, createLosslessSourceMap(source)), []);
  }
});

test("candidate previews are smart proposals and keep resolution prose with its title", () => {
  const source = "Creature\nActions\nBite. Hit: 4 damage. Claw. Hit: 5 damage.";
  const candidates = createSourceCandidates(source, createLosslessSourceMap(source));
  const actions = candidates.find((candidate) => candidate.preview.startsWith("Actions"));
  const bite = candidates.find((candidate) => candidate.preview.startsWith("Bite."));
  const claw = candidates.find((candidate) => candidate.preview.startsWith("Claw."));

  assert.ok(actions);
  assert.ok(bite);
  assert.ok(claw);
  assert.doesNotMatch(actions.preview, /Bite\./u);
  assert.doesNotMatch(bite.preview, /Claw\./u);
  assert.match(bite.preview, /^Bite\. Hit: 4 damage\.\s*$/u);
  assert.match(claw.preview, /^Claw\. Hit: 5 damage\.\s*$/u);
  assert.equal(
    candidates.some((candidate) => candidate.preview.startsWith("Hit:")),
    false,
  );
});

test("singleline specialization gets inline header, identity, section and feature proposals", () => {
  const source =
    "Marilith Decimator Large fiend (demon), chaotic evil Armor Class 17 (Natural Armor) Hit Points 273 (26d10 + 130) Speed 40 ft. STR DEX CON INT WIS CHA 18 (+4) 20 (+5) 20 (+5) 18 (+4) 16 (+3) 20 (+5) Saving Throws STR +9, CON +10, WIS +8, CHA +10 Damage Resistances Cold, Fire, Lightning Damage Immunities Poison Condition Immunities Poisoned Senses Truesight 120 ft. Languages Abyssal Challenge 16 (15,000 XP) Reactive. The marilith can take one reaction. Magic Resistance. The marilith has advantage on saves. Actions Multiattack. The marilith makes seven attacks. Claws. Melee Weapon Attack: +9 to hit. Reactions Deflect. When hit, the marilith adds 5 AC.";
  const map = createLosslessSourceMap(source);
  const candidates = enrichSinglelineCandidates(source, map, createSourceCandidates(source, map));
  for (const prefix of [
    "Large",
    "Armor Class 17",
    "Hit Points 273",
    "Speed 40",
    "STR DEX CON INT WIS CHA",
    "Saving Throws STR",
    "Damage Resistances",
    "Damage Immunities",
    "Condition Immunities",
    "Senses",
    "Languages",
    "Challenge 16",
    "Actions",
    "Multiattack.",
    "Claws.",
    "Reactions",
    "Deflect.",
  ]) {
    const offset = source.indexOf(prefix);
    assert.notEqual(offset, -1);
    assert.equal(
      candidates.some((candidate) => candidate.start === offset),
      true,
      `missing coordinate for ${prefix}`,
    );
  }
});

test("short standalone heading keeps following section rules as a separate proposal", () => {
  const source = `Legendary Actions
The creature can take 3 legendary actions, choosing from the options below.
Attack. The creature attacks.`;
  const candidates = createSourceCandidates(source, createLosslessSourceMap(source));
  const previews = candidates.map((candidate) => candidate.preview);
  assert.equal(
    previews.some((preview) => preview.trim() === "Legendary Actions"),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("The creature can take 3 legendary actions")),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("Attack.")),
    true,
  );
});

test("single-line enrichment adds dense shape-only coordinates without changing base universal lattice", () => {
  const source =
    "Demogorgon Huge Fiend (Demon), Chaotic Evil Armor Class 22 (natural armor) Hit Points 406 (28d12 + 224) Speed 50 ft., Swim 50 ft. STR 29 (+9) DEX 14 (+2) CON 26 (+8) INT 20 (+5) WIS 17 (+3) CHA 25 (+7) Saving Throws DEX +10, CON +16, WIS +11, CHA +15 Traits Magic Resistance. Demogorgon has advantage on saving throws. Magic Weapons. Demogorgon’s weapon attacks are magical. Actions Multiattack. Demogorgon makes two attacks. Tentacle. Melee Weapon Attack: +17 to hit. Gaze. The target suffers one of several effects: 1. Beguiling Gaze. The target is stunned. 2. Hypnotic Gaze. The target is charmed. Legendary Actions Demogorgon can take 2 legendary actions. Tail. Melee Weapon Attack: +17 to hit.";
  const sourceMap = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, sourceMap);
  const enriched = enrichSinglelineCandidates(source, sourceMap, base);

  const startOf = (text: string) => {
    const start = source.indexOf(text);
    assert.notEqual(start, -1, text);
    return start;
  };

  // Identity prefix gets vocabulary-free token coordinates.
  assert.equal(
    enriched.some((candidate) => candidate.start === startOf("Huge Fiend")),
    true,
  );
  // Compact repeated label/value/modifier cells expose the start of the row.
  assert.equal(
    enriched.some((candidate) => candidate.start === startOf("STR 29")),
    true,
  );
  // Inline section headings get a right edge so heading and rules can differ.
  assert.equal(
    enriched.some((candidate) => candidate.start === startOf("Demogorgon can take 2 legendary actions")),
    true,
  );
  // Named features and their following prose both have coordinates.
  assert.equal(
    enriched.some((candidate) => candidate.start === startOf("Tentacle.")),
    true,
  );
  // Nested list markers are visible as hierarchy proposals rather than lost text.
  assert.equal(
    enriched.some((candidate) => candidate.start === startOf("1. Beguiling Gaze.")),
    true,
  );
  assert.equal(
    enriched.some((candidate) => candidate.start === startOf("Beguiling Gaze.")),
    false,
  );

  assert.ok(enriched.length > base.length);
});

test("single-line numbered hierarchy requires an actual sequence even when dense weak coordinates include prose-ending numbers", () => {
  const source =
    "Actions Tentacle. The target dies if its maximum is reduced to 0. Gaze. The target suffers one of the following: 1. First Effect. Text. 2. Second Effect. Text. 3. Third Effect. Text.";
  const sourceMap = createLosslessSourceMap(source);
  const enriched = enrichSinglelineCandidates(source, sourceMap, createSourceCandidates(source, sourceMap));
  const starts = new Set(enriched.map((candidate) => candidate.start));

  const proseZero = enriched.find((candidate) => candidate.start === source.indexOf("0. Gaze."));
  assert.ok(proseZero);
  assert.equal(proseZero.reasons.includes("sentence_start"), true);
  assert.equal(starts.has(source.indexOf("Gaze.")), true);
  assert.equal(starts.has(source.indexOf("1. First Effect.")), true);
  assert.equal(starts.has(source.indexOf("2. Second Effect.")), true);
  assert.equal(starts.has(source.indexOf("3. Third Effect.")), true);
  const nestedTitle = enriched.find((candidate) => candidate.start === source.indexOf("First Effect."));
  assert.ok(nestedTitle);
  assert.equal(nestedTitle.reasons.includes("named_block_start"), false);
});

test("wrapped action references do not become sibling feature candidates", () => {
  const source = `Actions
Multiattack. The erlking makes three attacks. The erlking may forgo making one of these attacks to instead use the Hide or
Misty Step action.
Naturalize (Costs 2 Actions). The erlking uses its
Naturalize action.`;
  const candidates = createSourceCandidates(source, createLosslessSourceMap(source));
  const previews = candidates.map((candidate) => candidate.preview);

  assert.equal(
    previews.some((preview) => preview.startsWith("Multiattack.")),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("Naturalize (Costs 2 Actions).")),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("Misty Step action.")),
    false,
  );
  assert.equal(
    previews.some((preview) => preview.startsWith("Naturalize action.")),
    false,
  );
});

test("mixed/generic enrichment keeps soft-wrapped physical rows as weak-capable coordinates without changing multiline geometry", () => {
  const source = `Lolth, Queen of the
Demonweb
Huge fiend (demon), chaotic evil
Armor Class 18 (Natural Armor)
Hit Points 542 (35d12 + 315)`;
  const map = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, map);
  const generic = enrichGenericCandidates(source, map, base);
  const multiline = enrichMultilineCandidates(source, map, base);
  const demonwebStart = source.indexOf("Demonweb");
  const classificationStart = source.indexOf("Huge fiend");

  assert.equal(
    base.some((candidate) => candidate.start === demonwebStart),
    true,
  );
  assert.equal(
    generic.some((candidate) => candidate.start === demonwebStart),
    true,
  );
  assert.equal(
    generic.some((candidate) => candidate.start === classificationStart),
    true,
  );
  assert.equal(generic.find((candidate) => candidate.start === demonwebStart)?.reasons.includes("line_start"), true);
  assert.equal(
    multiline.some((candidate) => candidate.start === demonwebStart),
    true,
  );
});

test("treats period, exclamation mark, and question mark as equivalent compact title terminators", () => {
  const source = "Singing Longbow. Attack text. Tally Ho! The creature moves. Who Goes There? The target must save.";
  const candidates = createSourceCandidates(source, createLosslessSourceMap(source));

  for (const title of ["Singing Longbow.", "Tally Ho!", "Who Goes There?"]) {
    const start = source.indexOf(title);
    const candidate = candidates.find((current) => current.start === start);
    assert.ok(candidate, `missing candidate for ${title}`);
    assert.equal(candidate.reasons.includes("named_block_start"), true, title);
  }
});

test("inline candidate enrichment does not promote an ordinary sentence containing capitalized rule names", () => {
  const source =
    "Multiattack. The dragon uses its Dread Visage. It then makes three attacks: one with its Bite or Tail, and two with its Claw. Bite. Melee Weapon Attack: +16 to hit.";
  const map = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, map);
  assert.equal(
    base.some((candidate) => candidate.preview.startsWith("The dragon uses its Dread Visage.")),
    false,
  );
  assert.equal(
    base.some((candidate) => candidate.preview.startsWith("Bite.")),
    true,
  );
});

test("inline candidate enrichment still preserves compact multiword rule titles with lowercase connectors", () => {
  const source =
    "Parent Feature. Gift of the Gem Dragon. The creature gains a benefit. Eyes of the Rune Keeper. The creature reads all writing.";
  const base = createSourceCandidates(source, createLosslessSourceMap(source));

  assert.equal(
    base.some((candidate) => candidate.start === source.indexOf("Gift of the Gem Dragon.")),
    true,
  );
  assert.equal(
    base.some((candidate) => candidate.start === source.indexOf("Eyes of the Rune Keeper.")),
    true,
  );
});

test("inline candidate enrichment rejects sentence-shaped continuations without weakening later compact titles", () => {
  const source =
    "Parent Feature. The creature calls on its Ancient Power. It then moves up to its speed. Final Strike. The creature attacks.";
  const base = createSourceCandidates(source, createLosslessSourceMap(source));

  assert.equal(
    base.some((candidate) => candidate.preview.startsWith("The creature calls on its Ancient Power.")),
    false,
  );
  assert.equal(
    base.some((candidate) => candidate.preview.startsWith("Final Strike.")),
    true,
  );
});

test("trusted physical-line title proposals allow short sentence-case localized names", () => {
  const source = [
    "Существо",
    "Разорвать серебряную нить. Если существо совершает критическое попадание, происходит эффект.",
  ].join("\n");
  const map = createLosslessSourceMap(source);
  const candidate = createSourceCandidates(source, map).find((current) =>
    current.preview.startsWith("Разорвать серебряную нить."),
  );
  assert.ok(candidate);
  assert.ok(candidate.reasons.includes("named_block_start"));
});

test("trusted physical-line title proposals tolerate one missing space after the title terminator", () => {
  const source = [
    "Creature",
    "Possession.One creature that the malekarnus has grappled must make a saving throw.",
  ].join("\n");
  const map = createLosslessSourceMap(source);
  const candidate = createSourceCandidates(source, map).find(
    (current) => current.start === source.indexOf("Possession.One"),
  );
  assert.ok(candidate);
  assert.ok(candidate.reasons.includes("named_block_start"));
  assert.equal(source.includes("Possession.One"), true);
});

test("single-line localization keeps exact header and section coordinates with no language profile", () => {
  const source =
    "Астральный Дредноут Громадный монстр (титан), без мировоззрения Класс Доспеха 20 Хиты 297 Скорость 15 футов Антимагический конус. Текст. Действия Укус. Текст.";
  const map = createLosslessSourceMap(source);
  const candidates = enrichSinglelineCandidates(source, map, createSourceCandidates(source, map));
  for (const text of ["Класс", "Хиты", "Скорость", "Действия", "Укус."]) {
    const offset = source.indexOf(text);
    assert.notEqual(offset, -1);
    assert.equal(
      candidates.some((candidate) => candidate.start === offset),
      true,
      text,
    );
  }
});

test("mixed long localized header row exposes weak token coordinates without a language profile", () => {
  const source = [
    "Существо",
    "Сопротивление урону дробящий, колющий, рубящий от немагических атак Иммунитет к состоянию испуг, истощение, окаменение, отравление, очарование",
    "Антимагический конус. Текст.",
  ].join("\n");
  const map = createLosslessSourceMap(source);
  const candidates = enrichGenericCandidates(source, map, createSourceCandidates(source, map));
  const secondField = source.indexOf("Иммунитет");
  const candidate = candidates.find((current) => current.start === secondField);
  assert.ok(candidate);
  assert.equal(candidate.reasons.includes("sentence_start"), true);
});
