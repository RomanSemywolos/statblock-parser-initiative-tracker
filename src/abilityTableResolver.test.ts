import assert from "node:assert/strict";
import test from "node:test";

import type { LosslessStatblockDocument } from "./domain.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import {
  probeConstraintProvenAbilityRegionFromHeaderSource,
  probeModelGuidedAbilityRegionFromSource,
  resolveAbilityTableFromHeader,
  resolveVerifiedAbilityRegionFromSource,
} from "./abilityTableResolver.js";
import { enrichStructuredHeader } from "./headerFacts.js";

const TITLE_ABILITY_LABELS = [
  { ability: "str" as const, labelQuote: "Str" },
  { ability: "dex" as const, labelQuote: "Dex" },
  { ability: "con" as const, labelQuote: "Con" },
  { ability: "int" as const, labelQuote: "Int" },
  { ability: "wis" as const, labelQuote: "Wis" },
  { ability: "cha" as const, labelQuote: "Cha" },
];
const UPPER_ABILITY_LABELS = TITLE_ABILITY_LABELS.map((entry) => ({
  ...entry,
  labelQuote: entry.labelQuote.toUpperCase(),
}));

function documentWithAbilityHeader(text: string): LosslessStatblockDocument {
  const sourceMap = createLosslessSourceMap(text);
  const content = sourceMap.units.filter((unit) => unit.kind === "content");
  const first = content[0]!;
  const last = content.at(-1)!;
  return {
    formatVersion: "lossless-statblock-v1",
    rawSource: text,
    sourceMap,
    annotations: [
      {
        id: "ability-table",
        candidateIndex: 0,
        provenance: "model_span",
        role: "header_field",
        field: "ability_scores",
        section: null,
        source: { startUnitId: first.id, endUnitId: last.id, start: 0, end: text.length },
        text,
      },
    ],
    blocks: [],
    view: {
      sourceOrderBlockIds: [],
      sourceOrderContentBlockIds: [],
      header: { fieldBlockIds: [], contentBlockIds: [], unclassifiedBlockIds: [] },
      sections: [],
      supplementaryBlockIds: [],
      topLevelUnclassifiedBlockIds: [],
    },
    structuredHeader: {
      abilities: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
      savingThrows: [],
      proficiencyBonus: null,
    },
    model: {
      model: "test",
      attempted: true,
      succeeded: true,
      elapsedSeconds: 0,
      requestCount: 1,
      succeededRequestCount: 1,
      partialRequestCount: 0,
      failedRequestCount: 0,
      returnedCandidateCount: 1,
      suppressedDuplicateCandidateCount: 0,
      acceptedAnnotationCount: 1,
      acceptedModelAnnotationCount: 1,
      deterministicAnnotationCount: 0,
      rejectedCandidateCount: 0,
    },
    integrity: { sourceMapValid: true, blockPartitionValid: true, reconstructsRawSource: true },
    issues: [],
  };
}

test("vertical score/mod/save ability table resolves all six printed saves including the final CHA cell", () => {
  const text = [
    "mod",
    "save",
    "mod",
    "save",
    "mod",
    "save",
    "Str",
    "27",
    "+8",
    "+8",
    "Dex",
    "24",
    "+7",
    "+7",
    "Con",
    "28",
    "+9",
    "+9",
    "Int",
    "26",
    "+8",
    "+16",
    "Wis",
    "27",
    "+8",
    "+16",
    "Cha",
    "30",
    "+10",
    "+18",
  ].join("\n");
  const result = resolveAbilityTableFromHeader(
    documentWithAbilityHeader(text),
    [
      { ability: "str", labelQuote: "Str" },
      { ability: "dex", labelQuote: "Dex" },
      { ability: "con", labelQuote: "Con" },
      { ability: "int", labelQuote: "Int" },
      { ability: "wis", labelQuote: "Wis" },
      { ability: "cha", labelQuote: "Cha" },
    ],
    8,
  );

  assert.equal(result.abilities.length, 6);
  assert.deepEqual(
    result.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["str", 8],
      ["dex", 7],
      ["con", 9],
      ["int", 16],
      ["wis", 16],
      ["cha", 18],
    ],
  );
  assert.equal(result.region?.end, text.length);
});

function documentWithLineHeader(text: string): LosslessStatblockDocument {
  const sourceMap = createLosslessSourceMap(text);
  const lines = text.split("\n");
  let cursor = 0;
  const annotations = lines
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const start = text.indexOf(line, cursor);
      const end = start + line.length;
      cursor = end + 1;
      const content = sourceMap.units.filter(
        (unit) => unit.kind === "content" && unit.start >= start && unit.end <= end,
      );
      return {
        id: `line-${index}`,
        candidateIndex: index,
        provenance: "model_span" as const,
        role: "header_field" as const,
        field: "other_header" as const,
        section: null,
        source: {
          startUnitId: content[0]!.id,
          endUnitId: content.at(-1)!.id,
          start,
          end,
        },
        text: line,
      };
    });

  return {
    formatVersion: "lossless-statblock-v1",
    rawSource: text,
    sourceMap,
    annotations,
    blocks: [],
    view: {
      sourceOrderBlockIds: [],
      sourceOrderContentBlockIds: [],
      header: { fieldBlockIds: [], contentBlockIds: [], unclassifiedBlockIds: [] },
      sections: [],
      supplementaryBlockIds: [],
      topLevelUnclassifiedBlockIds: [],
    },
    structuredHeader: {
      abilities: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
      savingThrows: [],
      proficiencyBonus: null,
    },
    model: {
      model: "test",
      attempted: true,
      succeeded: true,
      elapsedSeconds: 0,
      requestCount: 1,
      succeededRequestCount: 1,
      partialRequestCount: 0,
      failedRequestCount: 0,
      returnedCandidateCount: annotations.length,
      suppressedDuplicateCandidateCount: 0,
      acceptedAnnotationCount: annotations.length,
      acceptedModelAnnotationCount: annotations.length,
      deterministicAnnotationCount: 0,
      rejectedCandidateCount: 0,
    },
    integrity: { sourceMapValid: true, blockPartitionValid: true, reconstructsRawSource: true },
    issues: [],
  };
}

test("localized ability labels ground as one ordered region even when DEX/WIS repeat in a later save row", () => {
  const text = [
    "Сил",
    "28 (+9)",
    "Лов",
    "7 (-2)",
    "Тел",
    "25 (+7)",
    "Инт",
    "5 (-3)",
    "Мдр",
    "14 (+2)",
    "Хар",
    "18 (+4)",
    "Спасброски Лов +5, Мдр +9",
    "Навыки Восприятие +9",
  ].join("\n");

  const result = resolveAbilityTableFromHeader(
    documentWithLineHeader(text),
    [
      { ability: "str", labelQuote: "Сил" },
      { ability: "dex", labelQuote: "Лов" },
      { ability: "con", labelQuote: "Тел" },
      { ability: "int", labelQuote: "Инт" },
      { ability: "wis", labelQuote: "Мдр" },
      { ability: "cha", labelQuote: "Хар" },
    ],
    7,
  );

  assert.deepEqual(
    result.abilities.map((ability) => [ability.ability, ability.score]),
    [
      ["str", 28],
      ["dex", 7],
      ["con", 25],
      ["int", 5],
      ["wis", 14],
      ["cha", 18],
    ],
  );
  assert.equal(result.region?.end, text.indexOf("\nСпасброски"));
  assert.equal(
    result.issues.some((issue) => issue.code === "ungrounded_ability_label_hint"),
    false,
  );
});

test("localized ability recovery never expands backward through unrelated unresolved header rows", () => {
  const text = [
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
  ].join("\n");

  const result = resolveAbilityTableFromHeader(
    documentWithLineHeader(text),
    [
      { ability: "str", labelQuote: "Сил" },
      { ability: "dex", labelQuote: "Лов" },
      { ability: "con", labelQuote: "Тел" },
      { ability: "int", labelQuote: "Инт" },
      { ability: "wis", labelQuote: "Мдр" },
      { ability: "cha", labelQuote: "Хар" },
    ],
    7,
  );

  assert.equal(result.region?.start, text.indexOf("Сил 28 (+9)"));
  assert.equal(result.region?.end, text.indexOf("\nСпасброски"));
  assert.deepEqual(
    result.abilities.map((ability) => [ability.ability, ability.score]),
    [
      ["str", 28],
      ["dex", 7],
      ["con", 25],
      ["int", 5],
      ["wis", 14],
      ["cha", 18],
    ],
  );
});

test("localized ability promotion preserves unresolved metadata before the first ability row", () => {
  const text = [
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
  ].join("\n");
  const document = documentWithLineHeader(text);
  const enriched = enrichStructuredHeader(document, {
    abilityRows: [],
    abilityLabels: [
      { ability: "str", labelQuote: "Сил" },
      { ability: "dex", labelQuote: "Лов" },
      { ability: "con", labelQuote: "Тел" },
      { ability: "int", labelQuote: "Инт" },
      { ability: "wis", labelQuote: "Мдр" },
      { ability: "cha", labelQuote: "Хар" },
    ],
    savingThrows: [],
    issues: [],
  });

  assert.ok(enriched.annotations.some((annotation) => annotation.text === "Класс Доспеха 20 (природный доспех)"));
  assert.ok(enriched.annotations.some((annotation) => annotation.text === "Хиты 297 (17к20 + 119)"));
  assert.ok(enriched.annotations.some((annotation) => annotation.text.startsWith("Скорость 15 футов")));
  const ability = enriched.annotations.find(
    (annotation) => annotation.role === "header_field" && annotation.field === "ability_scores",
  );
  assert.ok(ability);
  assert.equal(ability.text.startsWith("Сил 28 (+9)"), true);
  assert.equal(ability.text.includes("Класс Доспеха 20"), false);
  assert.equal(ability.text.includes("Хиты 297"), false);
});

test("source probe prefers a complete final save cell over a smaller six-score solution", () => {
  const text = [
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
    "Con",
    "27",
    "+8",
    "+16",
    "Int",
    "21",
    "+5",
    "+5",
    "Wis",
    "22",
    "+6",
    "+14",
    "Cha",
    "26",
    "+8",
    "+16",
    "Skills Athletics +17, Intimidation +16, Perception +14",
  ].join("\n");
  const full = documentWithLineHeader(text);
  const lines = text.split("\n");
  const chaSaveLineIndex = lines.findIndex((line, index) => line === "+16" && index > lines.lastIndexOf("Cha"));
  const skillsLineIndex = lines.findIndex((line) => line.startsWith("Skills "));
  const fragmented: LosslessStatblockDocument = {
    ...full,
    annotations: full.annotations
      .filter((annotation) => annotation.id !== `line-${chaSaveLineIndex}`)
      .map((annotation) =>
        annotation.id === `line-${skillsLineIndex}` ? { ...annotation, field: "skills" } : annotation,
      ),
  };

  const ordinary = resolveAbilityTableFromHeader(fragmented, [], 8);
  assert.equal(ordinary.abilities.length, 0);

  const sourceProbe = probeConstraintProvenAbilityRegionFromHeaderSource(fragmented);
  assert.equal(sourceProbe.region, null);
  assert.equal(sourceProbe.resolution, null);
  assert.equal(sourceProbe.evidenceAtomCount, 0);
});

test("source-only ability probing does not assign English ability semantics", () => {
  const text = [
    "STR",
    "29",
    "+9",
    "+17",
    "DEX",
    "19",
    "+4",
    "+4",
    "CON",
    "27",
    "+8",
    "+16",
    "INT",
    "21",
    "+5",
    "+5",
    "WIS",
    "22",
    "+6",
    "+14",
    "CHA",
    "26",
    "+8",
    "+16",
  ].join("\n");
  const probe = probeConstraintProvenAbilityRegionFromHeaderSource(documentWithLineHeader(text));
  assert.equal(probe.region, null);
  assert.equal(probe.resolution, null);
  assert.equal(probe.evidenceAtomCount, 0);
});

test("verified ability evidence can deterministically extend a truncated right edge to the complete table", () => {
  const text = [
    "STR",
    "29",
    "+9",
    "+17",
    "DEX",
    "19",
    "+4",
    "+4",
    "CON",
    "27",
    "+8",
    "+16",
    "INT",
    "21",
    "+5",
    "+5",
    "WIS",
    "22",
    "+6",
    "+14",
    "CHA",
    "26",
    "+8",
    "+16",
    "Skills Athletics +17, Intimidation +16, Perception +14",
    "Traits",
  ].join("\n");
  const document = documentWithLineHeader(text);
  const proposedEnd = text.indexOf("\n+8\n+16\nSkills") + "\n+8".length;
  const resolved = resolveVerifiedAbilityRegionFromSource(
    document,
    { start: text.indexOf("STR"), end: proposedEnd },
    UPPER_ABILITY_LABELS,
    8,
  );

  assert.ok(resolved !== null);
  assert.deepEqual(
    resolved.abilities.map((ability) => [ability.ability, ability.score, ability.printedModifier]),
    [
      ["str", 29, 9],
      ["dex", 19, 4],
      ["con", 27, 8],
      ["int", 21, 5],
      ["wis", 22, 6],
      ["cha", 26, 8],
    ],
  );
  assert.deepEqual(
    resolved.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["str", 17],
      ["dex", 4],
      ["con", 16],
      ["int", 5],
      ["wis", 14],
      ["cha", 16],
    ],
  );
  assert.equal(resolved.region?.end, text.indexOf("\nSkills"));
});

test("collapsed Demogorgon-style verified evidence recovers a truncated final CHA cell", () => {
  const text =
    "STR 29 (+9) DEX 14 (+2) CON 26 (+8) INT 20 (+5) WIS 17 (+3) CHA 25 (+7) Saving Throws DEX +10, CON +16, WIS +11, CHA +15";
  const document = documentWithAbilityHeader(text);
  const proposedEnd = text.indexOf(" CHA 25") + " CHA 25".length;
  const resolved = resolveVerifiedAbilityRegionFromSource(
    document,
    { start: 0, end: proposedEnd },
    UPPER_ABILITY_LABELS,
    8,
    true,
    true,
  );

  assert.ok(resolved !== null);
  assert.deepEqual(
    resolved.abilities.map((ability) => [ability.ability, ability.score, ability.modifier]),
    [
      ["str", 29, 9],
      ["dex", 14, 2],
      ["con", 26, 8],
      ["int", 20, 5],
      ["wis", 17, 3],
      ["cha", 25, 7],
    ],
  );
  assert.equal(resolved.savingThrows.length, 0);
  assert.equal(resolved.region?.end, text.indexOf(" Saving Throws"));
});

test("ownership-first verified ability repair stops at the smallest complete localized table", () => {
  const text = [
    "Сил",
    "21 (+5)",
    "Лов",
    "17 (+3)",
    "Тел",
    "19 (+4)",
    "Инт",
    "14 (+2)",
    "Мдр",
    "16 (+3)",
    "Хар",
    "18 (+4)",
    "Спасброски Сил +11, Тел +10, Хар +10",
    "Действия",
  ].join("\n");
  const document = documentWithLineHeader(text);
  const hints = [
    { ability: "str" as const, labelQuote: "Сил" },
    { ability: "dex" as const, labelQuote: "Лов" },
    { ability: "con" as const, labelQuote: "Тел" },
    { ability: "int" as const, labelQuote: "Инт" },
    { ability: "wis" as const, labelQuote: "Мдр" },
    { ability: "cha" as const, labelQuote: "Хар" },
  ];
  const proposedEnd = text.indexOf("\n18 (+4)");
  const resolved = resolveVerifiedAbilityRegionFromSource(
    document,
    { start: text.indexOf("Сил"), end: proposedEnd },
    hints,
    6,
    true,
    true,
  );

  assert.ok(resolved !== null);
  assert.deepEqual(
    resolved.abilities.map((ability) => [ability.ability, ability.score]),
    [
      ["str", 21],
      ["dex", 17],
      ["con", 19],
      ["int", 14],
      ["wis", 16],
      ["cha", 18],
    ],
  );
  assert.equal(resolved.region?.end, text.indexOf("\nСпасброски"));
  assert.equal(resolved.savingThrows.length, 0);
});

test("localized verified ability evidence uses the same constraint extension with model-grounded labels", () => {
  const text = [
    "Сил",
    "28",
    "+9",
    "+16",
    "Лов",
    "7",
    "-2",
    "+5",
    "Тел",
    "25",
    "+7",
    "+14",
    "Инт",
    "5",
    "-3",
    "+4",
    "Мдр",
    "14",
    "+2",
    "+9",
    "Хар",
    "18",
    "+4",
    "+11",
    "Навыки Восприятие +9",
    "Действия",
  ].join("\n");
  const document = documentWithLineHeader(text);
  const hints = [
    { ability: "str" as const, labelQuote: "Сил" },
    { ability: "dex" as const, labelQuote: "Лов" },
    { ability: "con" as const, labelQuote: "Тел" },
    { ability: "int" as const, labelQuote: "Инт" },
    { ability: "wis" as const, labelQuote: "Мдр" },
    { ability: "cha" as const, labelQuote: "Хар" },
  ];
  const proposedEnd = text.indexOf("\n+4\n+11\nНавыки") + "\n+4".length;
  const resolved = resolveVerifiedAbilityRegionFromSource(
    document,
    { start: text.indexOf("Сил"), end: proposedEnd },
    hints,
    7,
  );

  assert.ok(resolved !== null);
  assert.deepEqual(
    resolved.abilities.map((ability) => [ability.ability, ability.score]),
    [
      ["str", 28],
      ["dex", 7],
      ["con", 25],
      ["int", 5],
      ["wis", 14],
      ["cha", 18],
    ],
  );
  assert.deepEqual(
    resolved.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["str", 16],
      ["dex", 5],
      ["con", 14],
      ["int", 4],
      ["wis", 9],
      ["cha", 11],
    ],
  );
  assert.equal(resolved.region?.end, text.indexOf("\nНавыки"));
});

test("verified standalone save evidence can populate structured saves even when the source row remains outside header ownership", () => {
  const text = [
    "STR",
    "30 (+10)",
    "DEX",
    "18 (+4)",
    "CON",
    "29 (+9)",
    "INT",
    "25 (+7)",
    "WIS",
    "28 (+9)",
    "CHA",
    "30 (+10)",
    "Saving Throws CON +18, INT +16, WIS +18, CHA +19",
    "Traits",
  ].join("\n");
  const full = documentWithLineHeader(text);
  const saveText = "Saving Throws CON +18, INT +16, WIS +18, CHA +19";
  const saveStart = text.indexOf(saveText);
  const saveEnd = saveStart + saveText.length;
  const saveIndex = text.split("\n").indexOf(saveText);
  const traitsIndex = text.split("\n").indexOf("Traits");
  const wrongBoundary: LosslessStatblockDocument = {
    ...full,
    annotations: full.annotations.map((annotation) => {
      if (annotation.id === `line-${saveIndex}`)
        return { ...annotation, role: "section_rules" as const, field: null, section: "traits" as const };
      if (annotation.id === `line-${traitsIndex}`)
        return { ...annotation, role: "section_heading" as const, field: null, section: null };
      return annotation;
    }),
  };

  const enriched = enrichStructuredHeader(wrongBoundary, {
    abilityRows: [],
    abilityLabels: [
      { ability: "str", labelQuote: "STR" },
      { ability: "dex", labelQuote: "DEX" },
      { ability: "con", labelQuote: "CON" },
      { ability: "int", labelQuote: "INT" },
      { ability: "wis", labelQuote: "WIS" },
      { ability: "cha", labelQuote: "CHA" },
    ],
    savingThrows: [],
    essentialRegions: [{ kind: "saving_throws", start: saveStart, end: saveEnd }],
    issues: [],
  });

  assert.deepEqual(
    enriched.structuredHeader.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["con", 18],
      ["int", 16],
      ["wis", 18],
      ["cha", 19],
    ],
  );
  const saveOwner = enriched.annotations.find(
    (annotation) => annotation.source.start <= saveStart && annotation.source.end >= saveEnd,
  );
  assert.equal(saveOwner?.role, "section_rules");
});

test("model-guided source recovery proves localized abilities without an ab region claim", () => {
  const text = [
    "Сил 28 (+9) Лов 7 (-2) Тел 25 (+7) Инт 5 (-3) Мдр 14 (+2)",
    "Хар 18 (+4)",
    "Спасброски Лов +5, Мдр +9",
    "Действия",
  ].join("\n");
  const document = documentWithLineHeader(text);
  const hints = [
    { ability: "str" as const, labelQuote: "Сил" },
    { ability: "dex" as const, labelQuote: "Лов" },
    { ability: "con" as const, labelQuote: "Тел" },
    { ability: "int" as const, labelQuote: "Инт" },
    { ability: "wis" as const, labelQuote: "Мдр" },
    { ability: "cha" as const, labelQuote: "Хар" },
  ];
  const result = probeModelGuidedAbilityRegionFromSource(document, hints, 7);
  assert.ok(result.region !== null);
  assert.deepEqual(
    result.resolution?.abilities.map((ability) => [ability.ability, ability.score]),
    [
      ["str", 28],
      ["dex", 7],
      ["con", 25],
      ["int", 5],
      ["wis", 14],
      ["cha", 18],
    ],
  );
  assert.equal(result.resolution?.region?.end, text.indexOf("\nСпасброски"));
});
