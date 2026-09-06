import assert from "node:assert/strict";
import test from "node:test";

import type { LosslessStatblockDocument } from "./domain.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import { compileToEditableStatblock } from "./editableCompiler.js";

function fixture(): LosslessStatblockDocument {
  const rawSource = [
    "Test Creature",
    "Medium Fiend, Neutral Evil",
    "AC 17",
    "HP 45 (6d8 + 18)",
    "STR 14 (+2) DEX 18 (+4) CON 16 (+3) INT 10 (+0) WIS 12 (+1) CHA 8 (-1)",
    "Saving Throws DEX +7, WIS +4",
    "Actions",
    "Bite. Melee Weapon Attack: +7 to hit.",
    "Source: Test Book",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(rawSource);

  const spans = [
    ["name", "header_field", "name", null, "Test Creature"],
    ["sta", "header_field", "size_type_alignment", null, "Medium Fiend, Neutral Evil"],
    ["ac", "header_field", "armor_class", null, "AC 17"],
    ["hp", "header_field", "hit_points", null, "HP 45 (6d8 + 18)"],
    [
      "abilities",
      "header_field",
      "ability_scores",
      null,
      "STR 14 (+2) DEX 18 (+4) CON 16 (+3) INT 10 (+0) WIS 12 (+1) CHA 8 (-1)",
    ],
    ["saves", "header_field", "saving_throws", null, "Saving Throws DEX +7, WIS +4"],
    ["actions-heading", "section_heading", null, "actions", "Actions"],
    ["bite", "feature", null, "actions", "Bite. Melee Weapon Attack: +7 to hit."],
    ["source", "supplementary", null, null, "Source: Test Book"],
  ] as const;

  const annotations = spans.map(([id, role, field, section, text], index) => {
    const start = rawSource.indexOf(text);
    return {
      id,
      candidateIndex: index,
      provenance: "model_span" as const,
      role,
      field,
      section,
      source: {
        startUnitId: "unit-0",
        endUnitId: "unit-0",
        start,
        end: start + text.length,
      },
      text,
    };
  });

  return {
    formatVersion: "lossless-statblock-v1",
    rawSource,
    sourceMap,
    annotations,
    blocks: annotations.map((annotation, index) => ({
      id: `source-block-${index}`,
      kind: "annotated" as const,
      start: annotation.source.start,
      end: annotation.source.end,
      text: annotation.text,
      annotationId: annotation.id,
    })),
    view: {
      sourceOrderBlockIds: [],
      sourceOrderContentBlockIds: [],
      header: { fieldBlockIds: [], contentBlockIds: [], unclassifiedBlockIds: [] },
      sections: [],
      supplementaryBlockIds: [],
      topLevelUnclassifiedBlockIds: [],
    },
    structuredHeader: {
      abilities: {
        str: {
          ability: "str",
          score: 14,
          modifier: 2,
          printedModifier: 2,
          printedSave: null,
          provenance: "deterministic_header_parse",
          source: { annotationId: "abilities", start: 0, end: 0, evidence: "" },
        },
        dex: {
          ability: "dex",
          score: 18,
          modifier: 4,
          printedModifier: 4,
          printedSave: 7,
          provenance: "deterministic_header_parse",
          source: { annotationId: "abilities", start: 0, end: 0, evidence: "" },
        },
        con: {
          ability: "con",
          score: 16,
          modifier: 3,
          printedModifier: 3,
          printedSave: null,
          provenance: "deterministic_header_parse",
          source: { annotationId: "abilities", start: 0, end: 0, evidence: "" },
        },
        int: {
          ability: "int",
          score: 10,
          modifier: 0,
          printedModifier: 0,
          printedSave: null,
          provenance: "deterministic_header_parse",
          source: { annotationId: "abilities", start: 0, end: 0, evidence: "" },
        },
        wis: {
          ability: "wis",
          score: 12,
          modifier: 1,
          printedModifier: 1,
          printedSave: 4,
          provenance: "deterministic_header_parse",
          source: { annotationId: "abilities", start: 0, end: 0, evidence: "" },
        },
        cha: {
          ability: "cha",
          score: 8,
          modifier: -1,
          printedModifier: -1,
          printedSave: null,
          provenance: "deterministic_header_parse",
          source: { annotationId: "abilities", start: 0, end: 0, evidence: "" },
        },
      },
      savingThrows: [
        {
          ability: "dex",
          bonus: 7,
          provenance: "deterministic_header_parse",
          source: { annotationId: "saves", start: 0, end: 0, evidence: "" },
        },
        {
          ability: "wis",
          bonus: 4,
          provenance: "deterministic_header_parse",
          source: { annotationId: "saves", start: 0, end: 0, evidence: "" },
        },
      ],
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
      returnedCandidateCount: 0,
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

function replaceAnnotationSource(document: LosslessStatblockDocument, annotationId: string, replacement: string): void {
  const annotation = document.annotations.find((entry) => entry.id === annotationId);
  assert.ok(annotation);
  const oldStart = annotation.source.start;
  const oldEnd = annotation.source.end;
  const delta = replacement.length - (oldEnd - oldStart);
  document.rawSource = document.rawSource.slice(0, oldStart) + replacement + document.rawSource.slice(oldEnd);

  for (const current of document.annotations) {
    if (current.id === annotationId) {
      current.source.start = oldStart;
      current.source.end = oldStart + replacement.length;
      current.text = replacement;
      continue;
    }
    if (current.source.start >= oldEnd) {
      current.source.start += delta;
      current.source.end += delta;
    } else if (current.source.end > oldEnd) {
      current.source.end += delta;
    }
  }
  document.sourceMap = createLosslessSourceMap(document.rawSource);
}

function insertSourceBefore(document: LosslessStatblockDocument, beforeText: string, insertedText: string): number {
  const insertAt = document.rawSource.indexOf(beforeText);
  assert.notEqual(insertAt, -1);
  document.rawSource = document.rawSource.slice(0, insertAt) + insertedText + document.rawSource.slice(insertAt);
  for (const annotation of document.annotations) {
    if (annotation.source.start >= insertAt) {
      annotation.source.start += insertedText.length;
      annotation.source.end += insertedText.length;
    } else if (annotation.source.end > insertAt) {
      annotation.source.end += insertedText.length;
    }
  }
  document.sourceMap = createLosslessSourceMap(document.rawSource);
  return insertAt;
}

test("compileToEditableStatblock produces editor-owned header/body without parser internals", () => {
  const editable = compileToEditableStatblock(fixture());

  assert.equal(editable.formatVersion, "editable-statblock-v2");
  assert.equal(editable.language, "en");
  assert.equal(editable.header.name?.text, "**Test Creature**");
  assert.equal(editable.header.subtitle?.text, "*Medium Fiend, Neutral Evil*");
  assert.equal(editable.header.primaryRows.find((row) => row.field === "armor_class")?.text, "**AC** 17");
  assert.equal(editable.body[0]?.type, "heading");
  assert.equal(editable.body[0]?.text, "**Actions**");
  assert.equal(editable.body.at(-1)?.text, "*Source:* Test Book");
  assert.equal("annotations" in editable, false);
  assert.equal("blocks" in editable, false);
});

test("compiler renders abilities/saves from structured header and full fallback saves", () => {
  const editable = compileToEditableStatblock(fixture());

  assert.deepEqual(editable.header.abilities.dex, { score: 18, modifier: 4 });
  assert.deepEqual(editable.header.savingThrows, {
    str: 2,
    dex: 7,
    con: 3,
    int: 0,
    wis: 4,
    cha: -1,
  });
  assert.equal(editable.facts.armorClass, 17);
  assert.equal(editable.facts.hitPointMaximum, 45);
  assert.deepEqual(editable.facts.initiative, { modifier: 4, provenance: "dex_modifier" });
});

test("compiler materializes a derived initiative header row from DEX when no printed row exists", () => {
  const editable = compileToEditableStatblock(fixture());
  const initiative = editable.header.primaryRows.find((row) => row.field === "initiative");

  assert.equal(initiative?.id, "header-initiative-derived");
  assert.equal(initiative?.text, "**Initiative** +4");
  assert.deepEqual(editable.facts.initiative, { modifier: 4, provenance: "dex_modifier" });
});

test("printed initiative row overrides dex-derived initiative", () => {
  const document = fixture();
  const initiativeText = "Initiative +9 (19)";
  const insertAt = insertSourceBefore(document, "HP 45", `${initiativeText}\n`);
  document.annotations.push({
    id: "initiative",
    candidateIndex: 50,
    provenance: "model_span",
    role: "header_field",
    field: "initiative",
    section: null,
    source: {
      startUnitId: "unit-0",
      endUnitId: "unit-0",
      start: insertAt,
      end: insertAt + initiativeText.length,
    },
    text: initiativeText,
  });

  const editable = compileToEditableStatblock(document);
  assert.equal(editable.header.primaryRows.find((row) => row.field === "initiative")?.text, "**Initiative** +9 (19)");
  assert.deepEqual(editable.facts.initiative, { modifier: 9, provenance: "printed" });
});

test("header fragments of the same semantic field are combined before product rendering", () => {
  const document = fixture();
  const armor = document.annotations.find((annotation) => annotation.field === "armor_class")!;
  const insertAt = armor.source.end;
  const inserted = " (natural armor)";
  document.rawSource = document.rawSource.slice(0, insertAt) + inserted + document.rawSource.slice(insertAt);
  document.sourceMap = createLosslessSourceMap(document.rawSource);

  for (const annotation of document.annotations) {
    if (annotation.source.start >= insertAt && annotation.id !== armor.id) {
      annotation.source.start += inserted.length;
      annotation.source.end += inserted.length;
    } else if (annotation.source.end > insertAt && annotation.id !== armor.id) {
      annotation.source.end += inserted.length;
    }
  }
  for (const block of document.blocks) {
    if (block.start >= insertAt) {
      block.start += inserted.length;
      block.end += inserted.length;
    } else if (block.end > insertAt) {
      block.end += inserted.length;
    }
  }

  document.annotations.push({
    ...armor,
    id: "armor-type",
    candidateIndex: 99,
    field: "armor_type",
    source: {
      ...armor.source,
      start: insertAt,
      end: insertAt + inserted.length,
    },
    text: inserted,
  });
  document.blocks.push({
    id: "source-block-armor-type",
    kind: "annotated",
    start: insertAt,
    end: insertAt + inserted.length,
    text: inserted,
    annotationId: "armor-type",
  });

  const editable = compileToEditableStatblock(document);
  assert.match(editable.header.primaryRows.find((row) => row.field === "armor_class")?.text ?? "", /natural armor/);
});

test("compiler always emits a name slot while subtitle remains optional", () => {
  const document = fixture();
  document.annotations = document.annotations.filter(
    (annotation) => annotation.field !== "name" && annotation.field !== "size_type_alignment",
  );
  document.blocks = document.blocks.filter((block) => {
    const annotation = document.annotations.find((entry) => entry.id === block.annotationId);
    return block.annotationId === null || block.annotationId === undefined || annotation !== undefined;
  });

  const editable = compileToEditableStatblock(document);
  assert.equal(editable.header.name?.text, "");
  assert.equal(editable.header.subtitle, null);
  assert.equal(editable.facts.name, null);
});

test("incomplete printed Save-column data stays unresolved instead of silently falling back to the ability modifier", () => {
  const document = fixture();
  const abilityAnnotation = document.annotations.find((annotation) => annotation.field === "ability_scores")!;
  abilityAnnotation.text = "Мод Рят СИЛ 14 +2 +5 СПР 18 +4 +7 СТА 16 +3 +6 ІНТ 10 +0 +3 МДР 12 +1 +4 ХАР 8 -1";
  document.structuredHeader.abilities.str!.printedSave = 5;
  document.structuredHeader.abilities.dex!.printedSave = 7;
  document.structuredHeader.abilities.con!.printedSave = 6;
  document.structuredHeader.abilities.int!.printedSave = 3;
  document.structuredHeader.abilities.wis!.printedSave = 4;
  document.structuredHeader.abilities.cha!.printedSave = null;
  document.structuredHeader.savingThrows = [
    {
      ability: "str",
      bonus: 5,
      provenance: "deterministic_header_parse",
      source: { annotationId: "abilities", start: 0, end: 0, evidence: "+5" },
    },
    {
      ability: "dex",
      bonus: 7,
      provenance: "deterministic_header_parse",
      source: { annotationId: "abilities", start: 0, end: 0, evidence: "+7" },
    },
    {
      ability: "con",
      bonus: 6,
      provenance: "deterministic_header_parse",
      source: { annotationId: "abilities", start: 0, end: 0, evidence: "+6" },
    },
    {
      ability: "int",
      bonus: 3,
      provenance: "deterministic_header_parse",
      source: { annotationId: "abilities", start: 0, end: 0, evidence: "+3" },
    },
    {
      ability: "wis",
      bonus: 4,
      provenance: "deterministic_header_parse",
      source: { annotationId: "abilities", start: 0, end: 0, evidence: "+4" },
    },
  ];

  const editable = compileToEditableStatblock(document);
  assert.equal(editable.header.savingThrows.cha, null);
  assert.equal(editable.facts.savingThrows.cha, null);
});

test("compiler keeps labelled AC and HP repair slots when parsing did not resolve them", () => {
  const document = fixture();
  document.annotations = document.annotations.filter(
    (annotation) => annotation.field !== "armor_class" && annotation.field !== "hit_points",
  );
  const editable = compileToEditableStatblock(document);

  assert.equal(editable.header.primaryRows.find((row) => row.field === "armor_class")?.text, "**Armor Class**");
  assert.equal(editable.header.primaryRows.find((row) => row.field === "hit_points")?.text, "**Hit Points**");
  assert.equal(editable.facts.armorClass, null);
  assert.equal(editable.facts.hitPointMaximum, null);
});

test("compiler localizes synthetic product labels for direct Ukrainian compilation", () => {
  const document = fixture();
  document.annotations = document.annotations.filter(
    (annotation) =>
      annotation.field !== "armor_class" && annotation.field !== "hit_points" && annotation.field !== "initiative",
  );
  document.structuredHeader.proficiencyBonus = {
    value: 3,
    printed: false,
    challengeRating: 5,
    provenance: "deterministic_cr_derivation",
    source: { annotationId: "cr", start: 0, end: 0, evidence: "CR 5" },
  };

  const editable = compileToEditableStatblock(document, { language: "uk" });
  assert.equal(
    editable.header.primaryRows.find((row) => row.field === "armor_class")?.text.replace(/\*/gu, ""),
    "Клас броні",
  );
  assert.equal(editable.header.primaryRows.find((row) => row.field === "hit_points")?.text.replace(/\*/gu, ""), "Хіти");
  assert.equal(editable.header.primaryRows.find((row) => row.field === "initiative")?.text, "**Ініціатива** +4");
  assert.equal(
    editable.header.secondaryRows.find((row) => row.field === "proficiency_bonus")?.text,
    "**Бонус майстерності** +3",
  );
});

test("body text with a conflicting header-field annotation remains visible and cannot feed product header", () => {
  const document = fixture();
  const bite = document.annotations.find((annotation) => annotation.id === "bite");
  assert.ok(bite);
  bite.role = "header_field";
  bite.field = "saving_throws";
  bite.section = null;

  const editable = compileToEditableStatblock(document);
  assert.ok(editable.body.some((node) => node.text === "***Bite.*** Melee Weapon Attack: +7 to hit."));
  assert.equal(
    editable.header.secondaryRows.some((row) => row.text === "***Bite.*** Melee Weapon Attack: +7 to hit."),
    false,
  );
});

test("grounded AC and HP field ownership parses the first printed integer independent of label language", () => {
  const document = fixture();
  replaceAnnotationSource(document, "ac", "Класс Доспеха 20 (природный доспех)");
  replaceAnnotationSource(document, "hp", "Хиты 297 (17к20 + 119)");

  const editable = compileToEditableStatblock(document, { language: "ru" });
  assert.equal(editable.facts.armorClass, 20);
  assert.equal(editable.facts.hitPointMaximum, 297);
});

test("unknown pre-section header fragments become editable implicit-trait body content", () => {
  const document = fixture();
  const saves = document.annotations.find((annotation) => annotation.id === "saves")!;
  saves.field = "other_header";
  replaceAnnotationSource(document, "saves", "Magic Resistance. The creature has advantage on saves against spells.");
  document.structuredHeader.savingThrows = [];

  const editable = compileToEditableStatblock(document);
  assert.equal(
    editable.header.secondaryRows.some((row) => row.field === "other_header"),
    false,
  );
  assert.ok(editable.body.some((node) => node.type === "paragraph" && node.text.startsWith("***Magic Resistance.***")));
  assert.ok(
    editable.body.findIndex((node) => node.text.startsWith("***Magic Resistance.***")) <
      editable.body.findIndex((node) => node.text === "**Actions**"),
  );
});

test("structured ability promotion cannot hide an adjacent unresolved source fragment", () => {
  const document = fixture();
  const saves = document.annotations.find((annotation) => annotation.id === "saves");
  assert.ok(saves);
  saves.role = "supplementary";
  saves.field = null;
  replaceAnnotationSource(document, "saves", "MPMM");
  document.structuredHeader.savingThrows = [];

  const editable = compileToEditableStatblock(document);
  assert.ok(editable.body.some((node) => node.type === "paragraph" && node.text === "MPMM"));
  assert.equal(editable.header.primaryRows.find((row) => row.field === "armor_class")?.text, "**AC** 17");
  assert.equal(editable.header.primaryRows.find((row) => row.field === "hit_points")?.text, "**HP** 45 (6d8 + 18)");
  assert.deepEqual(editable.header.abilities.dex, { score: 18, modifier: 4 });
});

test("compiler canonicalizes blank source rows while preserving non-empty multiline feature geometry", () => {
  const document = fixture();
  const bite = document.annotations.find((annotation) => annotation.id === "bite");
  assert.ok(bite);
  replaceAnnotationSource(
    document,
    "bite",
    "Innate Spellcasting. The creature casts:\n\nAt will: alpha\n\n3/day each: beta\n1/day each: gamma",
  );
  bite.role = "feature";
  bite.section = "actions";

  const editable = compileToEditableStatblock(document);
  const node = editable.body.find((entry) => entry.type === "paragraph" && entry.text.includes("Innate Spellcasting"));
  assert.ok(node);
  assert.equal(node.text.includes("\n\n"), false);
  const lines = node.text.split("\n");
  assert.equal(lines.length, 4);
  assert.ok(lines[0]?.includes("Innate Spellcasting"));
  assert.ok(lines[1]?.includes("At will:"));
  assert.ok(lines[2]?.includes("3/day each:"));
  assert.ok(lines[3]?.includes("1/day each:"));
});

test("multiline compiler enforces one non-empty physical body row per editable object", () => {
  const document = fixture();
  const originalBite = "Bite. Melee Weapon Attack: +7 to hit.";
  const multilineBite =
    "Long Feature. First paragraph starts here\nand visually wraps.\n\nSecond paragraph starts here\nand visually wraps too.";
  document.rawSource = document.rawSource.replace(originalBite, multilineBite);
  document.sourceMap = createLosslessSourceMap(document.rawSource);

  const bite = document.annotations.find((annotation) => annotation.id === "bite");
  assert.ok(bite);
  bite.text = multilineBite;
  bite.role = "feature";
  bite.section = "actions";

  for (const annotation of document.annotations) {
    const start = document.rawSource.indexOf(annotation.text);
    assert.notEqual(start, -1);
    annotation.source.start = start;
    annotation.source.end = start + annotation.text.length;
  }

  const editable = compileToEditableStatblock(document, { parserStructure: "multiline" });
  const bodyText = editable.body.map((entry) => entry.text);
  const plainBodyText = bodyText.map((text) => text.replace(/\*+/gu, ""));
  assert.ok(plainBodyText.includes("Long Feature. First paragraph starts here"));
  assert.ok(plainBodyText.includes("and visually wraps."));
  assert.ok(plainBodyText.includes("Second paragraph starts here"));
  assert.ok(plainBodyText.includes("and visually wraps too."));
  assert.equal(
    bodyText.some((text) => text.includes("\n")),
    false,
  );
});

test("printed initiative fact extraction trusts semantic ownership rather than the English label", () => {
  const document = fixture();
  const initiativeText = "Ініціатива +7 (17)";
  const insertAt = insertSourceBefore(document, "HP 45", `${initiativeText}\n`);
  document.annotations.push({
    id: "initiative-localized",
    candidateIndex: 51,
    provenance: "model_span",
    role: "header_field",
    field: "initiative",
    section: null,
    source: { startUnitId: "unit-0", endUnitId: "unit-0", start: insertAt, end: insertAt + initiativeText.length },
    text: initiativeText,
  });
  const editable = compileToEditableStatblock(document);
  assert.deepEqual(editable.facts.initiative, { modifier: 7, provenance: "printed" });
});

test("compiler never duplicates name-owned source as subtitle identity", () => {
  const document = fixture();
  const name = document.annotations.find((annotation) => annotation.field === "name");
  assert.ok(name);
  document.annotations.push({
    ...structuredClone(name),
    id: "bad-overlapping-subtitle",
    candidateIndex: 999,
    field: "size_type_alignment",
  });

  const editable = compileToEditableStatblock(document, { language: "en", parserStructure: "mixed" });
  assert.ok(editable.header.name);
  assert.equal(editable.header.name.text.replace(/\*/gu, ""), "Test Creature");
  assert.equal(editable.header.subtitle?.text.replace(/\*/gu, ""), "Medium Fiend, Neutral Evil");
  assert.equal(editable.header.subtitle?.text.includes("Test Creature"), false);
});

test("compiler stores exact ability/save source evidence outside ordinary statblock content", () => {
  const editable = compileToEditableStatblock(fixture());

  assert.deepEqual(
    editable.header.evidence?.map((item) => ({ fields: item.fields, text: item.text })),
    [
      {
        fields: ["ability_scores"],
        text: "STR 14 (+2) DEX 18 (+4) CON 16 (+3) INT 10 (+0) WIS 12 (+1) CHA 8 (-1)",
      },
      {
        fields: ["saving_throws"],
        text: "Saving Throws DEX +7, WIS +4",
      },
    ],
  );
  assert.ok(!editable.body.some((node) => node.text.includes("STR 14 (+2)")));
  assert.ok(!editable.body.some((node) => node.text.includes("Saving Throws DEX +7")));
});

test("evidence-owned ability/save source is not duplicated in body even when structural ownership is wrong", () => {
  const document = fixture();
  const ability = document.annotations.find((annotation) => annotation.id === "abilities")!;
  const saves = document.annotations.find((annotation) => annotation.id === "saves")!;
  ability.role = "section_rules";
  ability.section = "traits";
  saves.role = "section_rules";
  saves.section = "traits";

  const editable = compileToEditableStatblock(document);

  assert.equal(editable.header.evidence?.length, 2);
  assert.ok(!editable.body.some((node) => node.text.includes("STR 14 (+2)")));
  assert.ok(!editable.body.some((node) => node.text.includes("Saving Throws DEX +7")));
  assert.ok(editable.body.some((node) => node.text.includes("Actions")));
});

test("verified AC and HP use standardized product labels while exact source rows move to Evidence", () => {
  const document = fixture();
  const ac = document.annotations.find((annotation) => annotation.id === "ac")!;
  const hp = document.annotations.find((annotation) => annotation.id === "hp")!;
  document.structuredHeader.armorClass = {
    value: 17,
    provenance: "model_evidence",
    source: { annotationId: ac.id, start: ac.source.start, end: ac.source.end, evidence: ac.text },
  };
  document.structuredHeader.hitPoints = {
    value: 45,
    provenance: "model_evidence",
    source: { annotationId: hp.id, start: hp.source.start, end: hp.source.end, evidence: hp.text },
  };

  const editable = compileToEditableStatblock(document);
  assert.equal(editable.header.primaryRows.find((row) => row.field === "armor_class")?.text, "**Armor Class** 17");
  assert.equal(
    editable.header.primaryRows.find((row) => row.field === "hit_points")?.text,
    "**Hit Points** 45 (6d8 + 18)",
  );
  assert.equal(
    editable.header.evidence?.some((item) => item.fields.includes("armor_class") && item.text === "AC 17"),
    true,
  );
  assert.equal(
    editable.header.evidence?.some((item) => item.fields.includes("hit_points") && item.text === "HP 45 (6d8 + 18)"),
    true,
  );
});

test("structured type source is not duplicated in BODY when structural ownership drifts", () => {
  const document = fixture();
  const type = document.annotations.find((annotation) => annotation.id === "sta")!;
  document.structuredHeader.sizeTypeAlignment = {
    text: type.text,
    provenance: "model_evidence",
    source: { annotationId: type.id, start: type.source.start, end: type.source.end, evidence: type.text },
  };
  type.role = "section_rules";
  type.section = "traits";

  const editable = compileToEditableStatblock(document);
  assert.equal(editable.header.subtitle?.text.replace(/\*/gu, ""), "Medium Fiend, Neutral Evil");
  assert.equal(
    editable.body.some((node) => node.text.replace(/\*/gu, "").includes("Medium Fiend, Neutral Evil")),
    false,
  );
});

test("semantic header mistakes cannot remove source prose from the product projection", () => {
  const rawSource = [
    "UTTERANCE OF DAMNATION",
    "Medium humanoid (any), chaotic evil",
    "Armor Class 19 (natural armor)",
    "Hit Points 180 (19d10 + 76)",
    "Speed 20 ft.",
    "STR DEX CON INT WIS CHA",
    "20 (+5) 12 (+1) 18 (+4) 14 (+2) 15 (+2) 20 (+5)",
    "Saving Throws Str +9, Con +8, Wis +6, Cha +9",
    "Challenge 12 (8,400 XP)",
    "TRAITS",
    "Fiendish Slaves. Allied fiends can carry the spell origin.",
    "Spellcasting. The utterance is an 18th-level spellcaster.",
    "At will: fireball, hex, hold monster",
    "ACTIONS",
    "Multiattack. The utterance uses Manifest Fiend.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(rawSource);
  const span = (text: string) => {
    const start = rawSource.indexOf(text);
    assert.notEqual(start, -1);
    return { start, end: start + text.length };
  };
  const annotation = (
    id: string,
    text: string,
    role: LosslessStatblockDocument["annotations"][number]["role"],
    field: LosslessStatblockDocument["annotations"][number]["field"],
    section: LosslessStatblockDocument["annotations"][number]["section"],
    candidateIndex: number,
  ): LosslessStatblockDocument["annotations"][number] => {
    const range = span(text);
    return {
      id,
      candidateIndex,
      provenance: "model_span",
      role,
      field,
      section,
      source: { startUnitId: "unit-0", endUnitId: "unit-0", ...range },
      text,
    };
  };

  const badTraits = [
    "Fiendish Slaves. Allied fiends can carry the spell origin.",
    "Spellcasting. The utterance is an 18th-level spellcaster.",
    "At will: fireball, hex, hold monster",
  ].join("\n");
  const annotations = [
    annotation("n", "UTTERANCE OF DAMNATION", "header_field", "name", null, 0),
    annotation("sta", "Medium humanoid (any), chaotic evil", "header_field", "size_type_alignment", null, 1),
    annotation("ac", "Armor Class 19 (natural armor)", "header_field", "armor_class", null, 2),
    annotation("hp", "Hit Points 180 (19d10 + 76)", "header_field", "hit_points", null, 3),
    annotation("speed", "Speed 20 ft.", "header_field", "speed", null, 4),
    annotation(
      "abilities",
      "STR DEX CON INT WIS CHA\n20 (+5) 12 (+1) 18 (+4) 14 (+2) 15 (+2) 20 (+5)",
      "header_field",
      "ability_scores",
      null,
      5,
    ),
    annotation("saves", "Saving Throws Str +9, Con +8, Wis +6, Cha +9", "header_field", "saving_throws", null, 6),
    annotation("cr", "Challenge 12 (8,400 XP)", "header_field", "challenge", null, 7),
    annotation("traits-heading-wrong", "TRAITS", "header_field", "other_header", null, 8),
    annotation("traits-wrong", badTraits, "header_field", "challenge", null, 9),
    annotation("actions", "ACTIONS", "section_heading", null, "actions", 10),
    annotation("multiattack", "Multiattack. The utterance uses Manifest Fiend.", "feature", null, "actions", 11),
  ];

  const acRange = span("Armor Class 19 (natural armor)");
  const hpRange = span("Hit Points 180 (19d10 + 76)");
  const crRange = span("Challenge 12 (8,400 XP)");
  const document: LosslessStatblockDocument = {
    formatVersion: "lossless-statblock-v1",
    rawSource,
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
      name: {
        text: "UTTERANCE OF DAMNATION",
        provenance: "model_evidence",
        source: { annotationId: "n", ...span("UTTERANCE OF DAMNATION"), evidence: "UTTERANCE OF DAMNATION" },
      },
      sizeTypeAlignment: {
        text: "Medium humanoid (any), chaotic evil",
        provenance: "model_evidence",
        source: {
          annotationId: "sta",
          ...span("Medium humanoid (any), chaotic evil"),
          evidence: "Medium humanoid (any), chaotic evil",
        },
      },
      armorClass: {
        value: 19,
        provenance: "model_evidence",
        source: { annotationId: "ac", ...acRange, evidence: "Armor Class 19 (natural armor)" },
      },
      initiative: null,
      hitPoints: {
        value: 180,
        provenance: "model_evidence",
        source: { annotationId: "hp", ...hpRange, evidence: "Hit Points 180 (19d10 + 76)" },
      },
      challenge: {
        value: 12,
        provenance: "model_evidence",
        source: { annotationId: "cr", ...crRange, evidence: "Challenge 12 (8,400 XP)" },
      },
      abilityEvidence: null,
      savingThrowEvidence: null,
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

  const editable = compileToEditableStatblock(document, { parserStructure: "mixed" });
  const body = editable.body.map((node) => node.text.replace(/\*+/gu, "")).join("\n");
  assert.match(body, /TRAITS/u);
  assert.match(body, /Fiendish Slaves\. Allied fiends can carry the spell origin\./u);
  assert.match(body, /Spellcasting\. The utterance is an 18th-level spellcaster\./u);
  assert.match(body, /At will: fireball, hex, hold monster/u);
  assert.match(body, /ACTIONS/u);
  assert.equal(
    editable.header.secondaryRows.find((row) => row.field === "challenge")?.text.replace(/\*+/gu, ""),
    "Challenge Rating 12 (8,400 XP)",
  );
  assert.equal(
    editable.header.evidence?.some(
      (item) => item.fields.includes("challenge") && item.text === "Challenge 12 (8,400 XP)",
    ),
    true,
  );
});

test("unproven header semantics stay in the default source stream instead of gaining omission authority", () => {
  const document = fixture();
  document.structuredHeader.abilities = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  document.structuredHeader.savingThrows = [];
  document.structuredHeader.abilityEvidence = null;
  document.structuredHeader.savingThrowEvidence = null;

  const editable = compileToEditableStatblock(document);
  const body = editable.body.map((node) => node.text.replace(/\*+/gu, "")).join("\n");
  assert.match(body, /STR 14 \(\+2\) DEX 18 \(\+4\)/u);
  assert.match(body, /Saving Throws DEX \+7, WIS \+4/u);
});

test("missing parser ownership cannot make raw source content disappear at the product boundary", () => {
  const document = fixture();
  document.annotations = document.annotations.filter((annotation) => annotation.id !== "saves");
  document.blocks = document.blocks.filter((block) => block.annotationId !== "saves");
  document.structuredHeader.savingThrows = [];
  document.structuredHeader.savingThrowEvidence = null;

  const editable = compileToEditableStatblock(document);
  const body = editable.body.map((node) => node.text.replace(/\*+/gu, "")).join("\n");
  assert.match(body, /Saving Throws DEX \+7, WIS \+4/u);
});

test("copied annotation text is never a product text-authority path", () => {
  const document = fixture();
  const bite = document.annotations.find((annotation) => annotation.id === "bite")!;
  bite.text = "HALLUCINATED REWRITE THAT IS NOT IN SOURCE";

  const editable = compileToEditableStatblock(document);
  const body = editable.body.map((node) => node.text.replace(/\*+/gu, "")).join("\n");
  assert.match(body, /Bite\. Melee Weapon Attack: \+7 to hit\./u);
  assert.equal(body.includes("HALLUCINATED REWRITE"), false);
});

test("combined CR/PB source row renders one standardized Challenge Rating plus one generated PB", () => {
  const document = fixture();
  replaceAnnotationSource(document, "hp", "CR 30 (XP 155,000; PB +9)");
  const cr = document.annotations.find((annotation) => annotation.id === "hp")!;
  cr.field = "challenge";
  cr.text = "CR 30 (XP 155,000; PB +9)";
  document.structuredHeader.hitPoints = null;
  document.structuredHeader.challenge = {
    value: 30,
    provenance: "model_evidence",
    source: { annotationId: cr.id, start: cr.source.start, end: cr.source.end, evidence: cr.text },
  };
  document.structuredHeader.proficiencyBonus = {
    value: 9,
    printed: true,
    challengeRating: 30,
    provenance: "model_evidence",
    source: { annotationId: cr.id, start: cr.source.start, end: cr.source.end, evidence: cr.text },
  };

  const editable = compileToEditableStatblock(document);
  const challengeRows = editable.header.secondaryRows.filter((row) => row.field === "challenge");
  const pbRows = editable.header.secondaryRows.filter((row) => row.field === "proficiency_bonus");

  assert.equal(challengeRows.length, 1);
  assert.equal(challengeRows[0]?.text, "**Challenge Rating** 30 (XP 155,000; PB +9)");
  assert.equal(pbRows.length, 1);
  assert.equal(pbRows[0]?.text, "**Proficiency Bonus** +9");
  assert.equal(editable.header.evidence?.filter((item) => item.text === "CR 30 (XP 155,000; PB +9)").length, 1);
  assert.equal(
    editable.body.some((node) => node.text.includes("CR 30")),
    false,
  );
});

test("exact challenge evidence never widens to a bad semantic annotation that also owns body prose", () => {
  const document = fixture();
  const replacement =
    "Challenge 23 (50,000 XP)\nReckless Follow-Through. At the start of their turn, the target suffers.";
  replaceAnnotationSource(document, "hp", replacement);
  const bad = document.annotations.find((annotation) => annotation.id === "hp")!;
  bad.field = "challenge";
  bad.text = replacement;
  const challengeText = "Challenge 23 (50,000 XP)";
  const challengeStart = bad.source.start;
  document.structuredHeader.hitPoints = null;
  document.structuredHeader.challenge = {
    value: 23,
    provenance: "model_evidence",
    source: {
      annotationId: bad.id,
      start: challengeStart,
      end: challengeStart + challengeText.length,
      evidence: challengeText,
    },
  };

  const editable = compileToEditableStatblock(document, { parserStructure: "mixed" });
  assert.equal(
    editable.header.evidence?.some((item) => item.fields.includes("challenge") && item.text === challengeText),
    true,
  );
  assert.equal(
    editable.header.evidence?.some((item) => item.text.includes("Reckless Follow-Through")),
    false,
  );
  assert.equal(
    editable.body.some((node) => node.text.includes("Reckless Follow-Through")),
    true,
  );
});

test("printed initiative on a shared AC row renders from its grounded signed value onward", () => {
  const document = fixture();
  const shared = "AC 17 Initiative +7 (17)";
  replaceAnnotationSource(document, "ac", shared);
  const armor = document.annotations.find((annotation) => annotation.id === "ac")!;
  document.structuredHeader.armorClass = {
    value: 17,
    provenance: "model_evidence",
    source: { annotationId: "ac", start: armor.source.start, end: armor.source.end, evidence: shared },
  };
  document.structuredHeader.initiative = {
    value: 7,
    provenance: "model_evidence",
    source: { annotationId: "ac", start: armor.source.start, end: armor.source.end, evidence: shared },
  };

  const editable = compileToEditableStatblock(document);
  assert.equal(
    editable.header.primaryRows.find((row) => row.field === "armor_class")?.text,
    "**Armor Class** 17 Initiative +7 (17)",
  );
  assert.equal(editable.header.primaryRows.find((row) => row.field === "initiative")?.text, "**Initiative** +7 (17)");
});

test("shared-row initiative uses the first signed token matching the proven modifier", () => {
  const document = fixture();
  const shared = "AC 18 (+2 against something) Initiative +2 (12)";
  replaceAnnotationSource(document, "ac", shared);
  const armor = document.annotations.find((annotation) => annotation.id === "ac")!;
  document.structuredHeader.armorClass = {
    value: 18,
    provenance: "model_evidence",
    source: { annotationId: "ac", start: armor.source.start, end: armor.source.end, evidence: shared },
  };
  document.structuredHeader.initiative = {
    value: 2,
    provenance: "model_evidence",
    source: { annotationId: "ac", start: armor.source.start, end: armor.source.end, evidence: shared },
  };

  const editable = compileToEditableStatblock(document);
  assert.equal(
    editable.header.primaryRows.find((row) => row.field === "initiative")?.text,
    "**Initiative** +2 against something) Initiative +2 (12)",
  );
  assert.deepEqual(editable.facts.initiative, { modifier: 2, provenance: "printed" });
});
