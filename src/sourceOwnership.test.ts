import assert from "node:assert/strict";
import test from "node:test";

import type { CompiledAnnotation, LosslessStatblockDocument, StructuredHeader } from "./domain.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import { assertValidSourceOwnershipMap, resolveAcceptedHeaderOwnership } from "./sourceOwnership.js";

function annotation(
  raw: string,
  id: string,
  role: CompiledAnnotation["role"],
  field: CompiledAnnotation["field"],
  text: string,
): CompiledAnnotation {
  const start = raw.indexOf(text);
  assert.notEqual(start, -1);
  return {
    id,
    candidateIndex: 0,
    provenance: "model_span",
    role,
    field,
    section: null,
    source: { startUnitId: "unit-0", endUnitId: "unit-0", start, end: start + text.length },
    text,
  };
}

function blankHeader(): StructuredHeader {
  return {
    abilities: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
    savingThrows: [],
    proficiencyBonus: null,
  };
}

function documentFixture(): LosslessStatblockDocument {
  const rawSource = "Test Creature AC 17 Speed 30 ft. Traits Keen Sight. The creature sees well.";
  const acStart = rawSource.indexOf("AC 17");
  const annotations = [
    annotation(rawSource, "name", "header_field", "name", "Test Creature"),
    annotation(rawSource, "ac", "header_field", "armor_class", "AC 17"),
    annotation(rawSource, "speed", "header_field", "speed", "Speed 30 ft."),
    annotation(rawSource, "traits", "section_heading", null, "Traits"),
    annotation(rawSource, "feature", "feature", null, "Keen Sight. The creature sees well."),
  ];

  return {
    formatVersion: "lossless-statblock-v1",
    rawSource,
    sourceMap: createLosslessSourceMap(rawSource),
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
      ...blankHeader(),
      armorClass: {
        value: 17,
        provenance: "model_evidence",
        source: { annotationId: "ac", start: acStart, end: acStart + 5, evidence: "AC 17" },
      },
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
      returnedCandidateCount: 5,
      suppressedDuplicateCandidateCount: 0,
      acceptedAnnotationCount: 5,
      acceptedModelAnnotationCount: 5,
      deterministicAnnotationCount: 0,
      rejectedCandidateCount: 0,
    },
    integrity: { sourceMapValid: true, blockPartitionValid: true, reconstructsRawSource: true },
    issues: [],
  };
}

test("ownership contains accepted header annotations but never body annotations", () => {
  const document = documentFixture();
  const ownership = resolveAcceptedHeaderOwnership(document);
  const ownedText = ownership.ranges.map((range) => document.rawSource.slice(range.start, range.end)).join("|");

  assert.match(ownedText, /Test Creature/u);
  assert.match(ownedText, /AC 17/u);
  assert.match(ownedText, /Speed 30 ft\./u);
  assert.doesNotMatch(ownedText, /Traits/u);
  assert.doesNotMatch(ownedText, /Keen Sight/u);
});

test("structured evidence and semantic ownership share one normalized authoritative map", () => {
  const document = documentFixture();
  const ownership = resolveAcceptedHeaderOwnership(document);
  const acStart = document.rawSource.indexOf("AC 17");
  const acRange = ownership.ranges.find((range) => range.start === acStart && range.end === acStart + 5);

  assert.ok(acRange);
  assert.deepEqual(new Set(acRange.owners.map((owner) => owner.channel)), new Set(["header", "header_evidence"]));
  assert.ok(acRange.owners.some((owner) => owner.provenance === "accepted_header_annotation"));
  assert.ok(acRange.owners.some((owner) => owner.provenance === "structured_header_fact"));
});

test("malformed or stale structured fact coordinates cannot create ownership", () => {
  const document = documentFixture();
  document.structuredHeader.challenge = {
    value: 30,
    provenance: "model_evidence",
    source: { annotationId: "bad", start: 0, end: 4, evidence: "NOPE" },
  };

  const ownership = resolveAcceptedHeaderOwnership(document);
  assert.equal(
    ownership.ranges.some((range) => range.owners.some((owner) => owner.field === "challenge")),
    false,
  );
});

test("ownership invariant rejects overlap and accepts exact implicit-remainder partition", () => {
  const raw = "abcdefghij";
  assert.doesNotThrow(() =>
    assertValidSourceOwnershipMap(raw, {
      rawLength: raw.length,
      ranges: [
        {
          start: 1,
          end: 3,
          owners: [{ channel: "header", provenance: "accepted_header_annotation", annotationId: "a", field: "name" }],
        },
        {
          start: 6,
          end: 8,
          owners: [
            {
              channel: "header_evidence",
              provenance: "structured_header_fact",
              annotationId: "b",
              field: "armor_class",
            },
          ],
        },
      ],
    }),
  );

  assert.throws(
    () =>
      assertValidSourceOwnershipMap(raw, {
        rawLength: raw.length,
        ranges: [
          {
            start: 1,
            end: 5,
            owners: [{ channel: "header", provenance: "accepted_header_annotation", annotationId: "a", field: "name" }],
          },
          {
            start: 4,
            end: 8,
            owners: [
              { channel: "header", provenance: "accepted_header_annotation", annotationId: "b", field: "other_header" },
            ],
          },
        ],
      }),
    /ordered and non-overlapping/u,
  );
});
