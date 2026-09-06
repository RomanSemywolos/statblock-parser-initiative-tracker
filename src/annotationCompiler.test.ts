import test from "node:test";
import assert from "node:assert/strict";

import type { LosslessSourceMap, ModelRunSummary } from "./domain.js";

import type { ModelAnnotation, ParsedModelResponse } from "./modelSchema.js";

import { compileLosslessDocument, reconstructBlocks, validateBlockPartition } from "./annotationCompiler.js";

import { createLosslessSourceMap } from "./losslessSource.js";

import { renderNormalizedStatblock } from "./renderer.js";
import { compileToEditableStatblock } from "./editableCompiler.js";

function modelSummary(returnedCandidateCount: number): ModelRunSummary {
  return {
    model: "test-model",
    attempted: true,
    succeeded: true,
    elapsedSeconds: 1,
    requestCount: 1,
    succeededRequestCount: 1,
    partialRequestCount: 0,
    failedRequestCount: 0,
    returnedCandidateCount,
    suppressedDuplicateCandidateCount: 0,
    acceptedAnnotationCount: 0,
    acceptedModelAnnotationCount: 0,
    deterministicAnnotationCount: 0,
    rejectedCandidateCount: 0,
  };
}

function contentUnitId(sourceMap: LosslessSourceMap, text: string, occurrence = 0): string {
  const matches = sourceMap.units.filter((unit) => unit.kind === "content" && unit.text === text);

  const unit = matches[occurrence];

  assert.ok(unit, `Missing content unit ${JSON.stringify(text)} occurrence ${occurrence}.`);

  return unit.id;
}

function candidate(candidateIndex: number, annotation: ModelAnnotation): ParsedModelResponse["candidates"][number] {
  return {
    candidateIndex,
    annotation,
  };
}

test("assembles a collapsed one-line statblock from exact source spans", () => {
  const source =
    "Solar Large Celestial AC 21 Traits Divine Awareness. The solar knows if it hears a lie. Actions Flying Sword. Hit: 22 damage.";

  const sourceMap = createLosslessSourceMap(source);

  const candidates: ParsedModelResponse["candidates"] = [
    candidate(0, {
      role: "header_field",
      field: "name",
      startUnitId: contentUnitId(sourceMap, "Solar"),
      endUnitId: contentUnitId(sourceMap, "Solar"),
    }),
    candidate(1, {
      role: "header_field",
      field: "size_type_alignment",
      startUnitId: contentUnitId(sourceMap, "Large"),
      endUnitId: contentUnitId(sourceMap, "Celestial"),
    }),
    candidate(2, {
      role: "header_field",
      field: "armor_class",
      startUnitId: contentUnitId(sourceMap, "AC"),
      endUnitId: contentUnitId(sourceMap, "21"),
    }),
    candidate(3, {
      role: "section_heading",
      section: "traits",
      startUnitId: contentUnitId(sourceMap, "Traits"),
      endUnitId: contentUnitId(sourceMap, "Traits"),
    }),
    candidate(4, {
      role: "feature",
      section: "traits",
      startUnitId: contentUnitId(sourceMap, "Divine"),
      endUnitId: contentUnitId(sourceMap, "lie."),
    }),
    candidate(5, {
      role: "section_heading",
      section: "actions",
      startUnitId: contentUnitId(sourceMap, "Actions"),
      endUnitId: contentUnitId(sourceMap, "Actions"),
    }),
    candidate(6, {
      role: "feature",
      section: "actions",
      startUnitId: contentUnitId(sourceMap, "Flying"),
      endUnitId: contentUnitId(sourceMap, "damage."),
    }),
  ];

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates,
    model: modelSummary(candidates.length),
  });

  assert.equal(reconstructBlocks(document.blocks), source);
  assert.equal(validateBlockPartition(source, document.blocks), true);
  assert.equal(document.model.acceptedAnnotationCount, 7);
  assert.equal(document.model.rejectedCandidateCount, 0);
  assert.equal(document.blocks.filter((block) => block.kind === "unclassified").length, 0);

  assert.deepEqual(
    document.view.sections.map((section) => section.section),
    ["traits", "actions"],
  );

  const normalized = renderNormalizedStatblock(document);

  assert.match(normalized, /^Solar\nLarge Celestial\nAC 21\n\nTraits\n\nDivine Awareness\./u);

  for (const annotation of document.annotations) {
    assert.equal(source.slice(annotation.source.start, annotation.source.end), annotation.text);
  }
});

test("preserves a multiline ability table inside one exact annotation", () => {
  const source =
    "Solar\r\nLarge Celestial\r\nMod\tSave\r\nSTR\t26\t+8\t+8\r\nDEX\t22\t+6\t+6\r\nCHA\t30\t+10\t+10\r\nTraits\r\nDivine Awareness. Text.";

  const sourceMap = createLosslessSourceMap(source);

  const candidates = [
    candidate(0, {
      role: "header_field",
      field: "ability_scores",
      startUnitId: contentUnitId(sourceMap, "Mod"),
      endUnitId: contentUnitId(sourceMap, "+10", 1),
    }),
  ];

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates,
    model: modelSummary(1),
  });

  assert.equal(document.annotations[0].text, "Mod\tSave\r\nSTR\t26\t+8\t+8\r\nDEX\t22\t+6\t+6\r\nCHA\t30\t+10\t+10");
  assert.equal(reconstructBlocks(document.blocks), source);
  assert.equal(document.integrity.reconstructsRawSource, true);
  assert.equal(
    document.issues.some((currentIssue) => currentIssue.code === "multirow_header_field"),
    false,
  );
});

test("splits a grounded coarse header span when later lines begin independently proven fields", () => {
  const source = "Damage Resistances Cold\nDamage Immunities Fire";

  const sourceMap = createLosslessSourceMap(source);

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [
      candidate(0, {
        role: "header_field",
        field: "damage_resistances",
        startUnitId: contentUnitId(sourceMap, "Damage"),
        endUnitId: contentUnitId(sourceMap, "Fire"),
      }),
    ],
    model: modelSummary(1),
  });

  assert.equal(document.annotations.length, 2);
  assert.deepEqual(
    document.annotations.map((annotation) => annotation.field),
    ["damage_resistances", "damage_immunities"],
  );
  assert.deepEqual(
    document.annotations.map((annotation) => annotation.provenance),
    ["deterministic_header_split", "deterministic_header_split"],
  );
  assert.equal(document.view.header.fieldBlockIds.length, 2);
  assert.equal(document.view.header.contentBlockIds.length, 0);
  assert.equal(
    document.issues.some((currentIssue) => currentIssue.code === "multi_field_header_span_split"),
    true,
  );
  assert.equal(document.integrity.reconstructsRawSource, true);
});

test("splits multiple proven header fields even when they share one physical line", () => {
  const source = "AC 17 Initiative +7 (17) HP 150 (20d10 + 40)";
  const sourceMap = createLosslessSourceMap(source);
  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [
      candidate(0, {
        role: "header_field",
        field: "armor_class",
        startUnitId: contentUnitId(sourceMap, "AC"),
        endUnitId: contentUnitId(sourceMap, "40)"),
      }),
    ],
    model: modelSummary(1),
  });

  assert.deepEqual(
    document.annotations.map((annotation) => annotation.field),
    ["armor_class", "initiative", "hit_points"],
  );
  assert.deepEqual(
    document.annotations.map((annotation) => annotation.text),
    ["AC 17", "Initiative +7 (17)", "HP 150 (20d10 + 40)"],
  );
  assert.equal(document.integrity.reconstructsRawSource, true);
});

test("keeps a labelled header field specific when only its value wraps onto another line", () => {
  const source = "Damage Immunities Poison; Bludgeoning, Piercing, and\nSlashing from Nonmagical Attacks";
  const sourceMap = createLosslessSourceMap(source);
  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [
      candidate(0, {
        role: "header_field",
        field: "damage_immunities",
        startUnitId: contentUnitId(sourceMap, "Damage"),
        endUnitId: contentUnitId(sourceMap, "Attacks"),
      }),
    ],
    model: modelSummary(1),
  });

  assert.equal(document.annotations[0].role, "header_field");
  assert.equal(document.annotations[0].field, "damage_immunities");
  assert.equal(
    document.issues.some((currentIssue) => currentIssue.code === "multirow_header_field"),
    false,
  );
});

test("places deterministically reconciled section content in its own honest view bucket", () => {
  const source = "Traits\nSecond Trait. Text.";

  const sourceMap = createLosslessSourceMap(source);

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [
      candidate(0, {
        role: "section_heading",
        section: "traits",
        startUnitId: contentUnitId(sourceMap, "Traits"),
        endUnitId: contentUnitId(sourceMap, "Traits"),
      }),
      {
        ...candidate(1, {
          role: "section_content",
          section: "traits",
          startUnitId: contentUnitId(sourceMap, "Second"),
          endUnitId: contentUnitId(sourceMap, "Text."),
        }),
        provenance: "deterministic_section_ownership",
      },
    ],
    model: modelSummary(3),
  });

  assert.equal(document.annotations[1].provenance, "deterministic_section_ownership");
  assert.deepEqual(document.view.sections[0].contentBlockIds, [
    document.blocks.find((block) => block.annotationId === document.annotations[1].id)?.id,
  ]);
  assert.deepEqual(document.view.sections[0].featureBlockIds, []);
  assert.equal(document.integrity.reconstructsRawSource, true);
});

test("omitted source becomes explicit unclassified content", () => {
  const source = "Solar Unknown Header Material Traits Divine Awareness. Text.";

  const sourceMap = createLosslessSourceMap(source);

  const candidates = [
    candidate(0, {
      role: "header_field",
      field: "name",
      startUnitId: contentUnitId(sourceMap, "Solar"),
      endUnitId: contentUnitId(sourceMap, "Solar"),
    }),
  ];

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates,
    model: modelSummary(1),
  });

  const unclassified = document.blocks.filter((block) => block.kind === "unclassified");

  assert.equal(unclassified.length, 1);
  assert.ok(unclassified[0].text.includes("Unknown Header Material"));
  assert.equal(reconstructBlocks(document.blocks), source);
  assert.ok(renderNormalizedStatblock(document).includes("Unknown Header Material"));
});

test("rejects all conflicting overlaps instead of choosing a winner", () => {
  const source = "Solar Large Celestial";

  const sourceMap = createLosslessSourceMap(source);

  const candidates = [
    candidate(0, {
      role: "header_field",
      field: "name",
      startUnitId: contentUnitId(sourceMap, "Solar"),
      endUnitId: contentUnitId(sourceMap, "Large"),
    }),
    candidate(1, {
      role: "header_field",
      field: "size_type_alignment",
      startUnitId: contentUnitId(sourceMap, "Large"),
      endUnitId: contentUnitId(sourceMap, "Celestial"),
    }),
  ];

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates,
    model: modelSummary(2),
  });

  assert.equal(document.annotations.length, 0);
  assert.equal(document.model.rejectedCandidateCount, 2);
  assert.equal(document.issues.filter((currentIssue) => currentIssue.code === "overlapping_annotations").length, 2);
  assert.equal(document.blocks.length, 1);
  assert.equal(document.blocks[0].kind, "unclassified");
});

test("trims separator boundaries and rejects unknown, reversed and false heading ranges", () => {
  const source = "Solar Large Celestial Actions Bite. Text.";

  const sourceMap = createLosslessSourceMap(source);

  const candidates = [
    candidate(0, {
      role: "header_field",
      field: "name",
      startUnitId: "unit-9999",
      endUnitId: "unit-9999",
    }),
    candidate(1, {
      role: "header_field",
      field: "size_type_alignment",
      startUnitId: "unit-1",
      endUnitId: contentUnitId(sourceMap, "Large"),
    }),
    candidate(2, {
      role: "header_field",
      field: "size_type_alignment",
      startUnitId: contentUnitId(sourceMap, "Celestial"),
      endUnitId: contentUnitId(sourceMap, "Large"),
    }),
    candidate(3, {
      role: "section_heading",
      section: "traits",
      startUnitId: contentUnitId(sourceMap, "Actions"),
      endUnitId: contentUnitId(sourceMap, "Actions"),
    }),
  ];

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates,
    model: modelSummary(4),
  });

  assert.equal(document.annotations.length, 2);
  assert.equal(document.annotations[0].text, "Large");
  assert.equal(document.annotations[1].role, "section_heading");
  assert.equal(document.annotations[1].section, "traits");
  assert.deepEqual(
    new Set(document.issues.map((currentIssue) => currentIssue.code)),
    new Set(["unknown_source_unit", "separator_boundary_trimmed", "reversed_source_range"]),
  );
  assert.equal(reconstructBlocks(document.blocks), source);
});

test("deduplicates identical ownership without duplicating text", () => {
  const source = "Actions";

  const sourceMap = createLosslessSourceMap(source);

  const annotation: ModelAnnotation = {
    role: "section_heading",
    section: "actions",
    startUnitId: "unit-0",
    endUnitId: "unit-0",
  };

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [candidate(0, annotation), candidate(1, annotation)],
    model: modelSummary(2),
  });

  assert.equal(document.annotations.length, 1);
  assert.equal(document.model.rejectedCandidateCount, 1);
  assert.equal(document.issues[0].code, "duplicate_annotation");
  assert.equal(reconstructBlocks(document.blocks), source);
});

test("empty annotations preserve arbitrary input for 250 generated cases", () => {
  const fragments = ["A", "Traits", "\t", "\r\n", " ", "—", "🕷️"];

  for (let caseIndex = 0; caseIndex < 250; caseIndex += 1) {
    let source = "";

    for (let index = 0; index < caseIndex % 31; index += 1) {
      source += fragments[(caseIndex * 17 + index * 13) % fragments.length];
    }

    const sourceMap = createLosslessSourceMap(source);

    const document = compileLosslessDocument({
      rawSource: source,
      sourceMap,
      candidates: [],
      model: modelSummary(0),
    });

    assert.equal(reconstructBlocks(document.blocks), source, `case ${caseIndex}`);
    assert.equal(document.integrity.reconstructsRawSource, true, `case ${caseIndex}`);
  }
});

test("does not split a header label that appears inside an open bracketed value", () => {
  const source = "Challenge 23 (50,000\nXP)";
  const sourceMap = createLosslessSourceMap(source);
  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [
      candidate(0, {
        role: "header_field",
        field: "challenge",
        startUnitId: contentUnitId(sourceMap, "Challenge"),
        endUnitId: contentUnitId(sourceMap, "XP)"),
      }),
    ],
    model: modelSummary(1),
  });

  assert.equal(document.annotations.length, 1);
  assert.equal(document.annotations[0].field, "challenge");
  assert.equal(document.annotations[0].text, source);
  assert.equal(
    document.issues.some((currentIssue) => currentIssue.code === "multi_field_header_span_split"),
    false,
  );
  assert.equal(document.integrity.reconstructsRawSource, true);
});

test("direct structural ownership never re-splits a grounded span with an English lexicon", () => {
  const source = "AC 17 Initiative +7 (17)";
  const sourceMap = createLosslessSourceMap(source);
  const content = sourceMap.units.filter((unit) => unit.kind === "content");

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [
      candidate(0, {
        role: "header_field",
        field: "armor_class",
        startUnitId: content[0]!.id,
        endUnitId: content[content.length - 1]!.id,
      }),
    ],
    preserveStructuralOwnership: true,
    model: modelSummary(1),
  });

  const headers = document.annotations.filter((annotation) => annotation.role === "header_field");
  assert.equal(headers.length, 1);
  assert.equal(headers[0]?.field, "armor_class");
  assert.equal(headers[0]?.text, source);
  assert.equal(
    document.issues.some((current) => current.code === "multi_field_header_span_split"),
    false,
  );
  assert.equal(reconstructBlocks(document.blocks), source);
});

test("inline printed initiative survives strict ownership and suppresses DEX-derived initiative", () => {
  const source = [
    "AC 17 Initiative +7 (17)",
    "STR 10 (+0) DEX 9 (-1) CON 10 (+0) INT 10 (+0) WIS 10 (+0) CHA 10 (+0)",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const content = sourceMap.units.filter((unit) => unit.kind === "content");
  const abilityStart = content.find((unit) => unit.text === "STR")!;

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [
      candidate(0, {
        role: "header_field",
        field: "armor_class",
        startUnitId: content[0]!.id,
        endUnitId: content.find((unit) => unit.text === "17")!.id,
      }),
      candidate(1, {
        role: "header_field",
        field: "initiative",
        startUnitId: content.find((unit) => unit.text === "Initiative")!.id,
        endUnitId: content.find((unit) => unit.text === "(17)")!.id,
      }),
      candidate(2, {
        role: "header_field",
        field: "ability_scores",
        startUnitId: abilityStart.id,
        endUnitId: content[content.length - 1]!.id,
      }),
    ],
    preserveStructuralOwnership: true,
    model: modelSummary(2),
  });

  const editable = compileToEditableStatblock(document);
  const initiativeRows = editable.header.primaryRows.filter((row) => row.field === "initiative");
  assert.equal(initiativeRows.length, 1);
  assert.equal(initiativeRows[0]?.text, "**Initiative** +7 (17)");
  assert.deepEqual(editable.facts.initiative, { modifier: 7, provenance: "printed" });
});

test("direct structural ownership does not broaden grounded splitting across separate physical rows", () => {
  const source = "AC 17\nHP 150";
  const sourceMap = createLosslessSourceMap(source);
  const content = sourceMap.units.filter((unit) => unit.kind === "content");

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [
      candidate(0, {
        role: "header_field",
        field: "armor_class",
        startUnitId: content[0]!.id,
        endUnitId: content[content.length - 1]!.id,
      }),
    ],
    preserveStructuralOwnership: true,
    model: modelSummary(1),
  });

  assert.equal(document.annotations.length, 1);
  assert.equal(document.annotations[0]?.field, "armor_class");
  assert.equal(document.annotations[0]?.text, source);
  assert.equal(
    document.issues.some((issue) => issue.code === "multi_field_header_span_split"),
    false,
  );
  assert.equal(reconstructBlocks(document.blocks), source);
});

test("direct structural ownership does not expose an opt-in English header re-split escape hatch", () => {
  const source = "Armor Class 24 (natural armor) Hit Points 1,000 (87d10 + 522)";
  const sourceMap = createLosslessSourceMap(source);
  const content = sourceMap.units.filter((unit) => unit.kind === "content");

  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [
      candidate(0, {
        role: "header_field",
        field: "armor_class",
        startUnitId: content[0]!.id,
        endUnitId: content[content.length - 1]!.id,
      }),
    ],
    preserveStructuralOwnership: true,
    model: modelSummary(1),
  });

  assert.equal(document.annotations.length, 1);
  assert.equal(document.annotations[0]?.text, source);
  assert.equal(reconstructBlocks(document.blocks), source);
});

test("keeps a label-only Saving Throws first line specific when its value wraps", () => {
  const source = "Saving Throws\nDEX +7, CON +10";
  const sourceMap = createLosslessSourceMap(source);
  const document = compileLosslessDocument({
    rawSource: source,
    sourceMap,
    candidates: [
      candidate(0, {
        role: "header_field",
        field: "saving_throws",
        startUnitId: contentUnitId(sourceMap, "Saving"),
        endUnitId: contentUnitId(sourceMap, "+10"),
      }),
    ],
    model: modelSummary(1),
  });

  assert.equal(document.annotations[0]?.field, "saving_throws");
  assert.equal(
    document.issues.some((currentIssue) => currentIssue.code === "multirow_header_field"),
    false,
  );
  assert.equal(document.integrity.reconstructsRawSource, true);
});
