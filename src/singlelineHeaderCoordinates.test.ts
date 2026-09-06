import test from "node:test";
import assert from "node:assert/strict";

import { prepareCandidateLattice } from "./candidateLattice.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import { groundSinglelineHeaderCoordinates } from "./singlelineHeaderCoordinates.js";
import type { ParsedSinglelineHeaderCoordinatesResponse } from "./modelSchema.js";

function candidatesFor(source: string) {
  return prepareCandidateLattice(source, createLosslessSourceMap(source), "singleline").headerCandidates;
}

function spanAt(
  source: string,
  candidates: ReturnType<typeof candidatesFor>,
  phrase: string,
): { startCandidate: number; endCandidate: number } {
  const start = source.indexOf(phrase);
  assert.notEqual(start, -1, `Missing source phrase ${phrase}`);
  const endChar = start + phrase.length;
  const startCandidate = candidates.findIndex((candidate) => candidate.start === start);
  assert.notEqual(startCandidate, -1, `Missing start coordinate for ${phrase}`);
  let endCandidate = startCandidate;
  for (let index = startCandidate; index < candidates.length; index += 1) {
    if (candidates[index]!.start < endChar) endCandidate = index;
    else break;
  }
  return { startCandidate, endCandidate };
}

function parsed(
  identity: ParsedSinglelineHeaderCoordinatesResponse["identity"],
  fields: ParsedSinglelineHeaderCoordinatesResponse["fields"],
  abilityLabels: ParsedSinglelineHeaderCoordinatesResponse["abilityLabels"],
): ParsedSinglelineHeaderCoordinatesResponse {
  return { identity, fields, abilityLabels, issues: [] };
}

function abilitySpan(
  source: string,
  candidates: ReturnType<typeof candidatesFor>,
  ability: "str" | "dex" | "con" | "int" | "wis" | "cha",
  phrase: string,
) {
  return { ability, ...spanAt(source, candidates, phrase) };
}

function fieldSpan(
  source: string,
  candidates: ReturnType<typeof candidatesFor>,
  kind: "ac" | "init" | "hp" | "sv" | "cr" | "pb",
  phrase: string,
) {
  return { kind, ...spanAt(source, candidates, phrase) };
}

test("singleline coordinate Header grounds localized identity, scalar fields, abilities and saves", () => {
  const source =
    "Астральный Дредноут Громадный Монстр (титан), без мировоззрения Класс Доспеха 20 (природный доспех) Хиты 297 (17к20 + 119) Скорость 15 футов Сил 28 (+9) Лов 7 (-2) Тел 25 (+7) Инт 5 (-3) Мдр 14 (+2) Хар 18 (+4) Спасброски Лов +5, Мдр +9 Навыки Восприятие +9 Опасность 21 (33 000 опыта) Бонус мастерства +7 Антимагический конус. Текст.";
  const candidates = candidatesFor(source);
  const result = groundSinglelineHeaderCoordinates(
    source,
    candidates,
    parsed(
      [
        { kind: "name", ...spanAt(source, candidates, "Астральный Дредноут") },
        { kind: "size_type_alignment", ...spanAt(source, candidates, "Громадный Монстр (титан), без мировоззрения") },
      ],
      [
        fieldSpan(source, candidates, "ac", "Класс Доспеха 20 (природный доспех)"),
        fieldSpan(source, candidates, "hp", "Хиты 297 (17к20 + 119)"),
        fieldSpan(source, candidates, "sv", "Спасброски Лов +5, Мдр +9"),
        fieldSpan(source, candidates, "cr", "Опасность 21 (33 000 опыта)"),
        fieldSpan(source, candidates, "pb", "Бонус мастерства +7"),
      ],
      [
        abilitySpan(source, candidates, "str", "Сил"),
        abilitySpan(source, candidates, "dex", "Лов"),
        abilitySpan(source, candidates, "con", "Тел"),
        abilitySpan(source, candidates, "int", "Инт"),
        abilitySpan(source, candidates, "wis", "Мдр"),
        abilitySpan(source, candidates, "cha", "Хар"),
      ],
    ),
  );

  assert.deepEqual(result.issues, []);
  const byKind = new Map(
    result.groundedRegions.map((region) => [region.kind, source.slice(region.start, region.end)] as const),
  );
  assert.equal(byKind.get("name"), "Астральный Дредноут");
  assert.equal(byKind.get("size_type_alignment"), "Громадный Монстр (титан), без мировоззрения");
  assert.equal(byKind.get("armor_class"), "Класс Доспеха 20 (природный доспех)");
  assert.equal(byKind.get("hit_points"), "Хиты 297 (17к20 + 119)");
  assert.equal(byKind.get("ability_scores"), "Сил 28 (+9) Лов 7 (-2) Тел 25 (+7) Инт 5 (-3) Мдр 14 (+2) Хар 18 (+4)");
  assert.equal(byKind.get("saving_throws"), "Спасброски Лов +5, Мдр +9");
  assert.equal(byKind.get("challenge"), "Опасность 21 (33 000 опыта)");
  assert.equal(byKind.get("proficiency_bonus"), "Бонус мастерства +7");
});

test("singleline coordinate Header supports 2024 initiative, save-column cells and nested PB inside CR", () => {
  const source =
    "Tarrasque Gargantuan Monstrosity (Titan), Unaligned AC 25 Initiative +18 (28) HP 697 (34d20 + 340) Speed 60 ft. STR 30 +10 +10 DEX 11 +0 +9 CON 30 +10 +10 INT 3 −4 +5 WIS 11 +0 +9 CHA 11 +0 +9 Skills Perception +9 CR 30 (XP 155,000; PB +9) Traits Legendary Resistance.";
  const candidates = candidatesFor(source);
  const result = groundSinglelineHeaderCoordinates(
    source,
    candidates,
    parsed(
      [
        { kind: "name", ...spanAt(source, candidates, "Tarrasque") },
        { kind: "size_type_alignment", ...spanAt(source, candidates, "Gargantuan Monstrosity (Titan), Unaligned") },
      ],
      [
        fieldSpan(source, candidates, "ac", "AC 25"),
        fieldSpan(source, candidates, "init", "Initiative +18 (28)"),
        fieldSpan(source, candidates, "hp", "HP 697 (34d20 + 340)"),
        fieldSpan(source, candidates, "cr", "CR 30 (XP 155,000; PB +9)"),
        fieldSpan(source, candidates, "pb", "PB +9"),
      ],
      [
        abilitySpan(source, candidates, "str", "STR"),
        abilitySpan(source, candidates, "dex", "DEX"),
        abilitySpan(source, candidates, "con", "CON"),
        abilitySpan(source, candidates, "int", "INT"),
        abilitySpan(source, candidates, "wis", "WIS"),
        abilitySpan(source, candidates, "cha", "CHA"),
      ],
    ),
  );

  assert.deepEqual(result.issues, []);
  const byKind = new Map(
    result.groundedRegions.map((region) => [region.kind, source.slice(region.start, region.end)] as const),
  );
  assert.equal(byKind.get("initiative"), "Initiative +18 (28)");
  assert.equal(
    byKind.get("ability_scores"),
    "STR 30 +10 +10 DEX 11 +0 +9 CON 30 +10 +10 INT 3 −4 +5 WIS 11 +0 +9 CHA 11 +0 +9",
  );
  assert.equal(byKind.get("challenge"), "CR 30 (XP 155,000; PB +9)");
  assert.equal(byKind.get("proficiency_bonus"), "PB +9");
});

test("singleline coordinate Header proves a separate six-label ability row deterministically", () => {
  const source =
    "Baphomet Huge fiend (demon), chaotic evil Armor Class 22 Hit Points 522 Speed 40 ft. STR DEX CON INT WIS CHA 30 (+10) 14 (+2) 26 (+8) 18 (+4) 24 (+7) 16 (+3) Saving Throws DEX +9, CON +15, WIS +14 Challenge 23 Traits Rule.";
  const candidates = candidatesFor(source);
  const result = groundSinglelineHeaderCoordinates(
    source,
    candidates,
    parsed(
      [
        { kind: "name", ...spanAt(source, candidates, "Baphomet") },
        { kind: "size_type_alignment", ...spanAt(source, candidates, "Huge fiend (demon), chaotic evil") },
      ],
      [
        fieldSpan(source, candidates, "ac", "Armor Class 22"),
        fieldSpan(source, candidates, "hp", "Hit Points 522"),
        fieldSpan(source, candidates, "sv", "Saving Throws DEX +9, CON +15, WIS +14"),
        fieldSpan(source, candidates, "cr", "Challenge 23"),
      ],
      [
        abilitySpan(source, candidates, "str", "STR"),
        abilitySpan(source, candidates, "dex", "DEX"),
        abilitySpan(source, candidates, "con", "CON"),
        abilitySpan(source, candidates, "int", "INT"),
        abilitySpan(source, candidates, "wis", "WIS"),
        abilitySpan(source, candidates, "cha", "CHA"),
      ],
    ),
  );
  assert.equal(
    result.issues.some((issue) => issue.code === "singleline_header_ability_region_rejected"),
    false,
  );
  const ability = result.groundedRegions.find((region) => region.kind === "ability_scores");
  assert.ok(ability);
  assert.equal(
    source.slice(ability.start, ability.end),
    "STR DEX CON INT WIS CHA 30 (+10) 14 (+2) 26 (+8) 18 (+4) 24 (+7) 16 (+3)",
  );
});

test("wrong existing span cannot become Initiative when the adjacent value has ability-score shape", () => {
  const source =
    "Creature Large outsider AC 18 HP 100 STR 20 (+5) DEX 14 (+2) CON 18 (+4) INT 10 (+0) WIS 12 (+1) CHA 8 (-1) Traits Rule.";
  const candidates = candidatesFor(source);
  const result = groundSinglelineHeaderCoordinates(
    source,
    candidates,
    parsed(
      [
        { kind: "name", ...spanAt(source, candidates, "Creature") },
        { kind: "size_type_alignment", ...spanAt(source, candidates, "Large outsider") },
      ],
      [fieldSpan(source, candidates, "init", "STR 20 (+5)")],
      [],
    ),
  );
  assert.ok(result.issues.some((issue) => issue.code === "singleline_header_field_coordinate_rejected"));
  assert.equal(
    result.groundedRegions.some((region) => region.kind === "initiative"),
    false,
  );
});

test("singleline ability spans support multi-token printed labels without model text", () => {
  const source =
    "Creature Large outsider AC 18 HP 100 Might Score 20 (+5) Agility Score 14 (+2) Endurance Score 18 (+4) Reason Score 10 (+0) Insight Score 12 (+1) Presence Score 8 (-1) CR 5 Traits Rule.";
  const candidates = candidatesFor(source);
  const result = groundSinglelineHeaderCoordinates(
    source,
    candidates,
    parsed(
      [
        { kind: "name", ...spanAt(source, candidates, "Creature") },
        { kind: "size_type_alignment", ...spanAt(source, candidates, "Large outsider") },
      ],
      [
        fieldSpan(source, candidates, "ac", "AC 18"),
        fieldSpan(source, candidates, "hp", "HP 100"),
        fieldSpan(source, candidates, "cr", "CR 5"),
      ],
      [
        abilitySpan(source, candidates, "str", "Might Score"),
        abilitySpan(source, candidates, "dex", "Agility Score"),
        abilitySpan(source, candidates, "con", "Endurance Score"),
        abilitySpan(source, candidates, "int", "Reason Score"),
        abilitySpan(source, candidates, "wis", "Insight Score"),
        abilitySpan(source, candidates, "cha", "Presence Score"),
      ],
    ),
  );

  assert.deepEqual(result.issues, []);
  assert.deepEqual(
    result.modelFacts.abilityLabels.map((label) => [label.ability, label.labelQuote]),
    [
      ["str", "Might Score"],
      ["dex", "Agility Score"],
      ["con", "Endurance Score"],
      ["int", "Reason Score"],
      ["wis", "Insight Score"],
      ["cha", "Presence Score"],
    ],
  );
});

test("singleline ability mapping may repair one numeric-cell coordinate left only when the six-label mechanics prove the region", () => {
  const source =
    "Tarrasque Gargantuan Monstrosity (Titan), Unaligned AC 25 HP 697 STR 30 +10 +10 DEX 11 +0 +9 CON 30 +10 +10 INT 3 −4 +5 WIS 11 +0 +9 CHA 11 +0 +9 CR 30 Traits Rule.";
  const candidates = candidatesFor(source);
  const con = spanAt(source, candidates, "CON");
  const conScoreCandidate = con.startCandidate + 1;
  const result = groundSinglelineHeaderCoordinates(
    source,
    candidates,
    parsed(
      [
        { kind: "name", ...spanAt(source, candidates, "Tarrasque") },
        { kind: "size_type_alignment", ...spanAt(source, candidates, "Gargantuan Monstrosity (Titan), Unaligned") },
      ],
      [
        fieldSpan(source, candidates, "ac", "AC 25"),
        fieldSpan(source, candidates, "hp", "HP 697"),
        fieldSpan(source, candidates, "cr", "CR 30"),
      ],
      [
        abilitySpan(source, candidates, "str", "STR"),
        abilitySpan(source, candidates, "dex", "DEX"),
        { ability: "con", startCandidate: conScoreCandidate, endCandidate: conScoreCandidate },
        abilitySpan(source, candidates, "int", "INT"),
        abilitySpan(source, candidates, "wis", "WIS"),
        abilitySpan(source, candidates, "cha", "CHA"),
      ],
    ),
  );

  assert.equal(
    result.issues.some((issue) => issue.code === "singleline_header_ability_coordinate_rejected"),
    false,
  );
  assert.equal(
    result.issues.some((issue) => issue.code === "singleline_header_ability_region_rejected"),
    false,
  );
  assert.equal(result.modelFacts.abilityLabels.find((label) => label.ability === "con")?.labelQuote, "CON");
  const ability = result.groundedRegions.find((region) => region.kind === "ability_scores");
  assert.ok(ability);
  assert.equal(
    source.slice(ability.start, ability.end),
    "STR 30 +10 +10 DEX 11 +0 +9 CON 30 +10 +10 INT 3 −4 +5 WIS 11 +0 +9 CHA 11 +0 +9",
  );
});

test("singleline full-fact grounding carves only an already-owned scalar prefix from the next HP claim", () => {
  const source =
    "Tarrasque Gargantuan Monstrosity (Titan), Unaligned AC 25 Initiative +18 (28) HP 697 (34d20 + 340) Speed 60 ft. Traits Rule.";
  const candidates = candidatesFor(source);
  const result = groundSinglelineHeaderCoordinates(
    source,
    candidates,
    parsed(
      [
        { kind: "name", ...spanAt(source, candidates, "Tarrasque") },
        { kind: "size_type_alignment", ...spanAt(source, candidates, "Gargantuan Monstrosity (Titan), Unaligned") },
      ],
      [
        fieldSpan(source, candidates, "ac", "AC 25"),
        fieldSpan(source, candidates, "init", "Initiative +18 (28)"),
        fieldSpan(source, candidates, "hp", "(28) HP 697 (34d20 + 340)"),
      ],
      [],
    ),
  );

  assert.equal(
    result.issues.some((issue) => issue.code === "singleline_header_field_coordinate_rejected"),
    false,
  );
  const hp = result.groundedRegions.find((region) => region.kind === "hit_points");
  assert.ok(hp);
  assert.equal(source.slice(hp.start, hp.end), "HP 697 (34d20 + 340)");
});
