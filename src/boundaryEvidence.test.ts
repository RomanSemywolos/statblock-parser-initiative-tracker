import assert from "node:assert/strict";
import test from "node:test";

import { attachBoundaryEvidence } from "./boundaryEvidence.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import {
  createSourceCandidates,
  enrichGenericCandidates,
  enrichMultilineCandidates,
  enrichSinglelineCandidates,
} from "./sourceCandidates.js";

test("single-line boundary evidence distinguishes peer titles from nested list sequence", () => {
  const source =
    "Actions Tentacle. Hit: 10 damage. Gaze. The target suffers one of the following effects: 1. First Gaze. Effect one. 2. Second Gaze. Effect two. 3. Third Gaze. Effect three. Legendary Actions The creature can take 2 legendary actions. Tail. Hit: 8 damage.";
  const map = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, map);
  const candidates = attachBoundaryEvidence(source, map, enrichSinglelineCandidates(source, map, base), "singleline");

  const at = (text: string) => candidates.find((candidate) => candidate.start === source.indexOf(text));
  assert.equal(at("Gaze.")?.boundary?.scope, "top_level");
  assert.equal(at("Gaze.")?.boundary?.strength, "strong");
  assert.equal(at("1. First Gaze.")?.boundary?.scope, "internal");
  assert.equal(at("2. Second Gaze.")?.boundary?.scope, "internal");
  assert.equal(at("3. Third Gaze.")?.boundary?.scope, "internal");
  // A punctuation-free collapsed label remains an address for the body LLM,
  // but deterministic evidence must not promote it from English vocabulary.
  assert.equal(at("Legendary Actions")?.boundary?.scope, "unknown");
  assert.equal(at("Legendary Actions")?.boundary?.strength, "weak");
});

test("mixed physical rows stay weak unless independent source shape supports a new block", () => {
  const source = `Actions
Bite. Melee Weapon Attack: +16 to hit, reach 15 ft., one target.
Hit: 28 (3d12 + 9) piercing damage.
Claw. Melee Weapon Attack: +16 to hit, reach 10 ft., one target.`;
  const map = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, map);
  const generic = enrichGenericCandidates(source, map, base);
  const candidates = attachBoundaryEvidence(source, map, generic, "generic");

  const byPrefix = (prefix: string) => candidates.find((candidate) => candidate.preview.startsWith(prefix));
  const hit = byPrefix("Hit:");
  const claw = byPrefix("Claw.");

  assert.ok(hit);
  assert.deepEqual(hit.reasons.includes("standalone_block_start"), false);
  assert.equal(hit.boundary?.scope, "unknown");
  assert.equal(hit.boundary?.strength, "weak");
  assert.equal(hit.boundary?.evidence.includes("physical_line"), true);

  assert.ok(claw);
  assert.equal(claw.boundary?.scope, "top_level");
  assert.equal(claw.boundary?.strength, "strong");
  assert.equal(claw.boundary?.evidence.includes("title_shape"), true);
});

test("mixed document start remains a hard top-level boundary after physical-line demotion", () => {
  const source = `Creature Name
Large creature, neutral`;
  const map = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, map);
  const generic = enrichGenericCandidates(source, map, base);
  const candidates = attachBoundaryEvidence(source, map, generic, "generic");

  assert.equal(candidates[0]?.boundary?.scope, "top_level");
  assert.equal(candidates[0]?.boundary?.strength, "hard");
  assert.equal(candidates[0]?.boundary?.evidence.includes("document_start"), true);
});

test("mixed visual-wrap and compact-label rows are weak while real title-shaped peers stay strong", () => {
  const source = `Actions
Phantasmal Fist. Melee Weapon Attack: +16 to hit,
reach 30 ft., one creature. Hit: 23 damage.
Bite. Melee Weapon Attack: +16 to hit, reach 15 ft., one target.
Hit: 28 damage.
Claw. Melee Weapon Attack: +16 to hit, reach 10 ft., one target.
Hit: 22 damage.`;
  const map = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, map);
  const generic = enrichGenericCandidates(source, map, base);
  const candidates = attachBoundaryEvidence(source, map, generic, "generic");
  const byPrefix = (prefix: string) => candidates.find((candidate) => candidate.preview.startsWith(prefix));

  for (const prefix of ["reach 30 ft.", "Hit: 28", "Hit: 22"]) {
    const candidate = byPrefix(prefix);
    assert.ok(candidate, `candidate not found: ${prefix}`);
    assert.equal(candidate.boundary?.scope, "unknown");
    assert.equal(candidate.boundary?.strength, "weak");
    assert.equal(candidate.boundary?.evidence.includes("physical_line"), true);
  }

  for (const prefix of ["Bite.", "Claw."]) {
    const candidate = byPrefix(prefix);
    assert.ok(candidate, `candidate not found: ${prefix}`);
    assert.equal(candidate.boundary?.scope, "top_level");
    assert.equal(candidate.boundary?.strength, "strong");
    assert.equal(candidate.boundary?.evidence.includes("title_shape"), true);
  }
});

test("mixed wrapped header continuations do not outrank known header starts", () => {
  const source = `Creature
Damage Resistances Cold, Fire, Lightning
Damage Immunities Poison; Bludgeoning, Piercing, and
Slashing from Nonmagical Attacks
Condition Immunities Charmed, Exhaustion, Frightened,
Poisoned
Senses Truesight 120 ft.`;
  const map = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, map);
  const routed = enrichGenericCandidates(source, map, base);
  const candidates = attachBoundaryEvidence(source, map, routed, "generic");
  const byPrefix = (prefix: string) => candidates.find((candidate) => candidate.preview.startsWith(prefix));

  for (const prefix of ["Damage Resistances", "Damage Immunities", "Condition Immunities", "Senses"]) {
    const candidate = byPrefix(prefix);
    assert.ok(candidate, `candidate not found: ${prefix}`);
    assert.equal(candidate.boundary?.scope, "top_level");
    assert.equal(candidate.boundary?.strength, "strong");
  }

  const slashing = byPrefix("Slashing from Nonmagical Attacks");
  assert.ok(slashing);
  assert.equal(slashing.boundary?.scope, "unknown");
  assert.equal(slashing.boundary?.strength, "weak");
  assert.equal(slashing.boundary?.continuationStrength, "soft");
  assert.equal(slashing.boundary?.continuationEvidence.includes("previous_line_open"), true);

  const poisoned = byPrefix("Poisoned");
  assert.ok(poisoned);
  assert.equal(poisoned.boundary?.scope, "unknown");
  assert.equal(poisoned.boundary?.strength, "weak");
  assert.equal(poisoned.boundary?.continuationStrength, "strong");
  assert.equal(poisoned.boundary?.continuationEvidence.includes("previous_line_trailing_separator"), true);
});

test("mixed feature wraps carry continuation evidence while long parenthetical feature titles remain positive starts", () => {
  const source = `Challenge 23 (50,000 XP)
Shroud of the Hidden Hand (Mythic Trait, 1/Day). When
Fraz-Urb'luu is reduced to 0 hit points, he doesn't die
or fall unconscious. Instead, he resets to 200 hit
points.
Ephemeral Resistance (5/Day). When Fraz-Urb'luu is
targeted with a spell or magical effect, he can choose
to teleport to an unoccupied space he can see within
30 feet, revealing his previous position to be an
illusory trick.`;
  const map = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, map);
  const routed = enrichGenericCandidates(source, map, base);
  const candidates = attachBoundaryEvidence(source, map, routed, "generic");
  const byPrefix = (prefix: string) => candidates.find((candidate) => candidate.preview.startsWith(prefix));

  const shroud = byPrefix("Shroud of the Hidden Hand");
  assert.ok(shroud);
  assert.equal(shroud.reasons.includes("named_block_start"), true);
  assert.equal(shroud.boundary?.strength, "strong");
  assert.equal(shroud.boundary?.evidence.includes("title_shape"), true);

  const targeted = byPrefix("targeted with a spell");
  const teleport = byPrefix("to teleport to an unoccupied space");
  for (const candidate of [targeted, teleport]) {
    assert.ok(candidate);
    assert.equal(candidate.boundary?.strength, "weak");
    assert.equal(candidate.boundary?.continuationStrength, "strong");
    assert.equal(candidate.boundary?.continuationEvidence.includes("lowercase_line_start"), true);
  }
});

test("mixed compact Label continuation gets explicit continuation evidence without vocabulary", () => {
  const source = `Bite. Primary mechanics text ends here.
Outcome: 28 points of effect.
Claw. Another independent rule.`;
  const map = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, map);
  const routed = enrichGenericCandidates(source, map, base);
  const candidates = attachBoundaryEvidence(source, map, routed, "generic");
  const outcome = candidates.find((candidate) => candidate.preview.startsWith("Outcome:"));
  assert.ok(outcome);
  assert.equal(outcome.boundary?.strength, "weak");
  assert.equal(outcome.boundary?.continuationStrength, "strong");
  assert.equal(outcome.boundary?.continuationEvidence.includes("compact_label_after_named_start"), true);
});

test("mixed paragraph geometry is strong rather than hard while trusted multiline remains hard", () => {
  const source = "First logical paragraph.\n\nSecond logical paragraph.";
  const map = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, map);
  const generic = attachBoundaryEvidence(source, map, enrichGenericCandidates(source, map, base), "generic");
  const multiline = attachBoundaryEvidence(source, map, enrichMultilineCandidates(source, map, base), "multiline");

  const genericSecond = generic.find((candidate) => candidate.preview.startsWith("Second logical paragraph."));
  const multilineSecond = multiline.find((candidate) => candidate.preview.startsWith("Second logical paragraph."));
  assert.ok(genericSecond);
  assert.ok(multilineSecond);
  assert.equal(genericSecond.boundary?.evidence.includes("paragraph"), true);
  assert.equal(genericSecond.boundary?.strength, "strong");
  assert.equal(multilineSecond.boundary?.evidence.includes("paragraph"), true);
  assert.equal(multilineSecond.boundary?.strength, "hard");
});

test("mixed introduced bullet sequences are hard internal hierarchy rather than peer feature starts", () => {
  const source = `Breath Weapons. The creature uses one of the following options:
• Antimagic Bomb. First effect.
• Force Breath. Second effect.
Claw. Another feature.`;
  const map = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    map,
    enrichGenericCandidates(source, map, createSourceCandidates(source, map)),
    "generic",
  );

  const anti = candidates.find((candidate) => candidate.preview.startsWith("• Antimagic Bomb."));
  const force = candidates.find((candidate) => candidate.preview.startsWith("• Force Breath."));
  const claw = candidates.find((candidate) => candidate.preview.startsWith("Claw."));
  assert.ok(anti && force && claw);
  assert.equal(anti.boundary?.scope, "internal");
  assert.equal(anti.boundary?.strength, "hard");
  assert.equal(anti.boundary?.evidence.includes("list_sequence"), true);
  assert.equal(force.boundary?.scope, "internal");
  assert.equal(force.boundary?.evidence.includes("list_sequence"), true);
  assert.equal(claw.boundary?.scope, "top_level");
});

test("generic mixed boundary evidence preserves localized pre-body metadata without an English profile", () => {
  const source = [
    "Астральный Дредноут [Astral Dreadnought]",
    "Громадный монстр (титан), без мировоззрения",
    "Класс Доспеха 20 (природный доспех)",
    "Хиты 297 (17к20 + 119)",
    "Скорость 15 футов, летая 80 футов (парит)",
    "Сил 28 (+9)",
    "Лов 7 (-2)",
    "Тел 25 (+7)",
    "Инт 5 (-3)",
    "Мдр 14 (+2)",
    "Хар 18 (+4)",
    "Спасброски Лов +5, Мдр +9",
    "Навыки Восприятие +9",
    "Сопротивление урону дробящий, колющий, рубящий от немагических атак",
    "Иммунитет к состоянию испуг, истощение, окаменение, отравление, очарование, ошеломление, паралич, сбивание с ног",
    "Чувства тёмное зрение 120 футов, пассивное Восприятие 19",
    "Опасность 21 (33 000 опыта)",
    "Бонус мастерства +7",
    "Антимагический конус. Открытый глаз создаёт антимагическую зону.",
  ].join("\n");
  const map = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    map,
    enrichGenericCandidates(source, map, createSourceCandidates(source, map)),
    "generic",
  );
  const find = (prefix: string) => {
    const offset = source.indexOf(prefix);
    return candidates.find((candidate) => candidate.start === offset);
  };

  for (const prefix of [
    "Громадный монстр",
    "Класс Доспеха",
    "Хиты 297",
    "Скорость 15",
    "Спасброски Лов",
    "Навыки Восприятие",
    "Сопротивление урону",
    "Иммунитет к состоянию",
    "Чувства тёмное",
    "Опасность 21",
    "Бонус мастерства",
  ]) {
    const candidate = find(prefix);
    assert.ok(candidate, prefix);
    assert.equal(candidate.boundary?.scope, "top_level", prefix);
    assert.notEqual(candidate.boundary?.strength, "weak", prefix);
    assert.equal(candidate.boundary?.continuationStrength, "none", prefix);
    assert.ok(candidate.boundary?.evidence.includes("compact_metadata"), prefix);
  }

  const abilityRows = ["Сил 28", "Лов 7", "Тел 25", "Инт 5", "Мдр 14", "Хар 18"].map((prefix) => find(prefix));
  assert.ok(abilityRows.every(Boolean));
  assert.equal(abilityRows[0]?.boundary?.scope, "top_level");
  assert.equal(abilityRows[0]?.boundary?.strength, "hard");
  for (const row of abilityRows.slice(1)) {
    assert.equal(row?.boundary?.scope, "internal");
    assert.equal(row?.boundary?.strength, "hard");
    assert.ok(row?.boundary?.evidence.includes("table_shape"));
  }
});

test("generic metadata fallback does not restore false strong boundaries for bare wrapped words", () => {
  const source = [
    "Creature",
    "Damage Immunities Poison; Bludgeoning, Piercing, and",
    "Slashing from Nonmagical Attacks",
    "Condition Immunities Charmed, Exhaustion, Frightened,",
    "Poisoned",
    "Magic Resistance. The creature has advantage on saving throws.",
  ].join("\n");
  const map = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    map,
    enrichGenericCandidates(source, map, createSourceCandidates(source, map)),
    "generic",
  );
  const slashing = candidates.find((candidate) => candidate.preview.startsWith("Slashing"));
  const poisoned = candidates.find((candidate) => candidate.preview.startsWith("Poisoned"));
  assert.equal(slashing?.boundary?.strength, "weak");
  assert.equal(poisoned?.boundary?.strength, "weak");
});

test("hybrid inline-first introduced bullet sequence is internal hierarchy", () => {
  const source =
    "Breath Weapons. The dragon uses one of the following breath weapons: • Antimagic Bomb.\nThe first effect continues here.\n• Force Breath. The second effect.";
  const map = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    map,
    enrichGenericCandidates(source, map, createSourceCandidates(source, map)),
    "generic",
  );
  const anti = candidates.find((candidate) => candidate.preview.startsWith("• Antimagic Bomb."));
  const force = candidates.find((candidate) => candidate.preview.startsWith("• Force Breath."));
  assert.ok(anti && force);
  assert.equal(anti.boundary?.scope, "internal");
  assert.equal(anti.boundary?.evidence.includes("list_sequence"), true);
  assert.equal(force.boundary?.scope, "internal");
  assert.equal(force.boundary?.evidence.includes("list_sequence"), true);
});

test("mixed introduced ordered lists with wrapped PDF rows are hard internal hierarchy", () => {
  const source = `Heartcleaver. On a critical hit, the target suffers one additional effect selected at random:
1. Curse of Brutality. The target must succeed on a save.
Wrapped continuation for the first result.
2. Crush Bones. The target must succeed on a save.
Another wrapped continuation.
3. Cleave Limb. The target loses a limb.
4. Bisect. The target dies.
Desecration Breath. Another feature.`;
  const map = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    map,
    enrichGenericCandidates(source, map, createSourceCandidates(source, map)),
    "generic",
  );

  const at = (text: string) => candidates.find((candidate) => candidate.start === source.indexOf(text));
  for (const marker of ["1. Curse of Brutality.", "2. Crush Bones.", "3. Cleave Limb.", "4. Bisect."]) {
    const candidate = at(marker);
    assert.ok(candidate, marker);
    assert.equal(candidate.boundary?.scope, "internal", marker);
    assert.equal(candidate.boundary?.strength, "hard", marker);
    assert.equal(candidate.boundary?.evidence.includes("list_sequence"), true, marker);
  }
  const desecration = at("Desecration Breath.");
  assert.ok(desecration);
  assert.equal(desecration.boundary?.scope, "top_level");
});

test("mixed introduced dash lists with wrapped rows are hard internal hierarchy", () => {
  const source = `Random Effects. Choose one result:
— First effect. The first option begins here.
Wrapped continuation for the first option.
Still the same option.
— Second effect. The second option begins here.
Wrapped continuation for the second option.
Next Feature. Independent rule.`;
  const map = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    map,
    enrichGenericCandidates(source, map, createSourceCandidates(source, map)),
    "generic",
  );
  const first = candidates.find((candidate) => candidate.start === source.indexOf("— First effect."));
  const second = candidates.find((candidate) => candidate.start === source.indexOf("— Second effect."));
  const next = candidates.find((candidate) => candidate.start === source.indexOf("Next Feature."));
  assert.ok(first && second && next);
  for (const candidate of [first, second]) {
    assert.equal(candidate.boundary?.scope, "internal");
    assert.equal(candidate.boundary?.strength, "hard");
    assert.equal(candidate.boundary?.evidence.includes("list_sequence"), true);
  }
  assert.equal(next.boundary?.scope, "top_level");
});

test("repeated dash rows without an introducing colon are not promoted to internal list hierarchy", () => {
  const source = `Feature. Ordinary prose.
— First separate row.
— Second separate row.`;
  const map = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    map,
    enrichGenericCandidates(source, map, createSourceCandidates(source, map)),
    "generic",
  );
  const first = candidates.find((candidate) => candidate.start === source.indexOf("— First separate row."));
  const second = candidates.find((candidate) => candidate.start === source.indexOf("— Second separate row."));
  assert.ok(first && second);
  assert.equal(first.boundary?.evidence.includes("list_sequence"), false);
  assert.equal(second.boundary?.evidence.includes("list_sequence"), false);
});

test("multiple introduced bullet lists are kept as separate structural groups", () => {
  const source = `Rule One. Choose:
- Alpha option.
- Beta option.
Next Feature. Text.
Rule Two. Choose:
• Gamma option.
Wrapped gamma.
• Delta option.`;
  const map = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    map,
    enrichGenericCandidates(source, map, createSourceCandidates(source, map)),
    "generic",
  );
  for (const marker of ["- Alpha option.", "- Beta option.", "• Gamma option.", "• Delta option."]) {
    const candidate = candidates.find((current) => current.start === source.indexOf(marker));
    assert.ok(candidate, marker);
    assert.equal(candidate.boundary?.scope, "internal", marker);
    assert.equal(candidate.boundary?.evidence.includes("list_sequence"), true, marker);
  }
});

test("mixed compact metadata continuation after a trailing comma cannot self-promote to a strong row", () => {
  const source = `Creature
Skills Acrobatics +13, Athletics +11, Perception +17,
Stealth +19, Survival +11
Damage Immunities poison
Feature Name. Prose.`;
  const map = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    map,
    enrichGenericCandidates(source, map, createSourceCandidates(source, map)),
    "generic",
  );
  const stealth = candidates.find((candidate) => candidate.preview.startsWith("Stealth +19"));
  assert.ok(stealth);
  assert.equal(stealth.boundary?.strength, "weak");
  assert.equal(stealth.boundary?.scope, "unknown");
  assert.equal(stealth.boundary?.continuationStrength, "strong");
  assert.equal(stealth.boundary?.continuationEvidence.includes("previous_line_trailing_separator"), true);
  assert.equal(stealth.boundary?.evidence.includes("compact_metadata"), false);
});
