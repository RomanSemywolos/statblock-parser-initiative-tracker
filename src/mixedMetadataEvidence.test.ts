import assert from "node:assert/strict";
import test from "node:test";
import { attachBoundaryEvidence } from "./boundaryEvidence.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import { enrichGenericCandidates, createSourceCandidates } from "./sourceCandidates.js";
import {
  hardInterleavedMixedMetadataContinuationIndexes,
  strengthenInterleavedMixedMetadataEvidence,
} from "./mixedMetadataEvidence.js";
import type { SourceOwnershipMap } from "./sourceOwnership.js";

function ownershipForLines(source: string, lines: readonly string[]): SourceOwnershipMap {
  const ranges = lines
    .map((line) => {
      const start = source.indexOf(line);
      assert.ok(start >= 0, line);
      return {
        start,
        end: start + line.length,
        owners: [
          {
            channel: "header" as const,
            provenance: "accepted_header_annotation" as const,
            annotationId: `test-${start}`,
            field: null,
          },
        ],
      };
    })
    .sort((left, right) => left.start - right.start);
  return { rawLength: source.length, ranges };
}

function prepared(source: string) {
  const map = createLosslessSourceMap(source);
  return attachBoundaryEvidence(
    source,
    map,
    enrichGenericCandidates(source, map, createSourceCandidates(source, map)),
    "generic",
  );
}

test("mixed metadata evidence is restored inside exact gaps between accepted Header ownership islands", () => {
  const source = [
    "Creature",
    "Armor 17",
    "Skills Deception +12, Perception +9,",
    "Persuasion +12, Stealth +13",
    "Damage Resistances psychic",
    "Damage Resistances psychic",
    "Damage Immunities bludgeoning, piercing, and",
    "Slashing from Nonmagical Attacks",
    "Condition Immunities charmed, frightened, poisoned",
    "Senses truesight 60 ft., passive Perception 19",
    "Languages Elvish, Sylvan, Undercommon",
    "Challenge 13",
    "Feature. Prose.",
  ].join("\n");
  const ownership = ownershipForLines(source, ["Creature", "Armor 17", "Challenge 13"]);
  const candidates = strengthenInterleavedMixedMetadataEvidence(source, prepared(source), ownership);
  const at = (text: string) => candidates.find((candidate) => candidate.start === source.indexOf(text));

  for (const text of [
    "Skills Deception +12, Perception +9,",
    "Damage Resistances psychic",
    "Damage Immunities bludgeoning, piercing, and",
    "Condition Immunities charmed, frightened, poisoned",
    "Senses truesight 60 ft., passive Perception 19",
    "Languages Elvish, Sylvan, Undercommon",
  ]) {
    const candidate = at(text);
    assert.ok(candidate, text);
    assert.equal(candidate.boundary?.scope, "top_level", text);
    assert.equal(candidate.boundary?.strength, "strong", text);
    assert.equal(candidate.boundary?.evidence.includes("header_interleaved_compact_row"), true, text);
  }

  const skills = at("Skills Deception +12, Perception +9,");
  assert.ok(skills);
  assert.equal(skills.boundary?.evidence.includes("compact_metadata"), true);

  const wrappedSkills = at("Persuasion +12, Stealth +13");
  assert.ok(wrappedSkills);
  assert.equal(wrappedSkills.boundary?.strength, "weak");
  assert.equal(wrappedSkills.boundary?.continuationStrength, "strong");

  const slashing = at("Slashing from Nonmagical Attacks");
  assert.ok(slashing);
  assert.equal(slashing.boundary?.strength, "weak");
  assert.notEqual(slashing.boundary?.continuationStrength, "strong");

  const bodyFeature = at("Feature. Prose.");
  assert.ok(bodyFeature);
  assert.equal(bodyFeature.boundary?.evidence.includes("header_interleaved_compact_row"), false);
});

test("candidate punctuation inside one promoted interleaved physical row gets only soft continuation evidence", () => {
  const source = [
    "Creature",
    "Armor 17",
    "Damage Resistances Cold, Fire, Lightning. Attacks made",
    "without advantage",
    "Challenge 13",
    "Feature. Prose.",
  ].join("\n");
  const ownership = ownershipForLines(source, ["Creature", "Armor 17", "Challenge 13"]);
  const candidates = strengthenInterleavedMixedMetadataEvidence(source, prepared(source), ownership);
  const lineStart = candidates.find((candidate) => candidate.start === source.indexOf("Damage Resistances"));
  const inner = candidates.find((candidate) => candidate.start === source.indexOf("Attacks made"));

  assert.ok(lineStart && inner);
  assert.equal(lineStart.boundary?.strength, "strong");
  assert.equal(lineStart.boundary?.evidence.includes("header_interleaved_compact_row"), true);
  assert.equal(inner.boundary?.continuationStrength, "soft");
  assert.equal(inner.boundary?.continuationEvidence.includes("same_physical_interleaved_row"), true);
});

test("interleaved metadata evidence never turns a trailing-comma continuation back into a strong row", () => {
  const source = [
    "Creature",
    "Armor 17",
    "Skills Acrobatics +13, Athletics +11, Perception +17,",
    "Stealth +19, Survival +11",
    "Challenge 19",
    "Feature. Prose.",
  ].join("\n");
  const ownership = ownershipForLines(source, ["Creature", "Armor 17", "Challenge 19"]);
  const candidates = strengthenInterleavedMixedMetadataEvidence(source, prepared(source), ownership);
  const stealth = candidates.find((candidate) => candidate.start === source.indexOf("Stealth +19"));
  assert.ok(stealth);
  assert.equal(stealth.boundary?.strength, "weak");
  assert.equal(stealth.boundary?.continuationStrength, "strong");
  assert.equal(stealth.boundary?.evidence.includes("header_interleaved_compact_row"), false);
});

test("mixed metadata hard continuation veto follows comma-wrapped rows only inside an ownership-rooted chain", () => {
  const source = [
    "Creature",
    "Armor 17",
    "Condition Immunities Blinded, Charmed,",
    "Exhaustion, Frightened, Grappled,",
    "Petrified, Poisoned",
    "Senses Truesight 120 ft., Passive Perception 22",
    "Challenge 13",
    "Feature. Alpha, Beta,",
    "Gamma",
  ].join("\n");
  const ownership = ownershipForLines(source, ["Creature", "Armor 17", "Challenge 13"]);
  const candidates = strengthenInterleavedMixedMetadataEvidence(source, prepared(source), ownership);
  const hard = new Set(hardInterleavedMixedMetadataContinuationIndexes(source, candidates, ownership));
  const indexOf = (text: string): number => {
    const index = candidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, text);
    return index;
  };

  assert.equal(hard.has(indexOf("Exhaustion, Frightened, Grappled,")), true);
  assert.equal(hard.has(indexOf("Petrified, Poisoned")), true);
  assert.equal(hard.has(indexOf("Senses Truesight 120 ft., Passive Perception 22")), false);
  // The same comma shape after the last accepted Header island is ordinary BODY
  // and remains model-owned.
  assert.equal(hard.has(indexOf("Gamma")), false);
});

test("mixed metadata hard continuation veto does not turn colon continuations into mandatory joins", () => {
  const source = ["Creature", "Armor 17", "Compact Label:", "Independent Row", "Challenge 13"].join("\n");
  const ownership = ownershipForLines(source, ["Creature", "Armor 17", "Challenge 13"]);
  const candidates = strengthenInterleavedMixedMetadataEvidence(source, prepared(source), ownership);
  const hard = hardInterleavedMixedMetadataContinuationIndexes(source, candidates, ownership);
  const independent = candidates.findIndex((candidate) => candidate.start === source.indexOf("Independent Row"));
  assert.notEqual(independent, -1);
  assert.equal(hard.includes(independent), false);
});
