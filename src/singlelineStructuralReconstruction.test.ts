import test from "node:test";
import assert from "node:assert/strict";

import { prepareCandidateLattice } from "./candidateLattice.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import type { SinglelineSyntheticEntry } from "./singlelineStructuralReconstruction.js";

function prepared(source: string) {
  return prepareCandidateLattice(source, createLosslessSourceMap(source), "singleline");
}

test("singleline reconstruction exposes compact collapsed heading-plus-rule leads without assigning semantics", () => {
  const source =
    "Creature Large outsider Armor 17 Traits First Rule. Text. Actions Multiattack. Text. Legendary Actions Tail. Text.";
  const result = prepared(source);
  assert.ok(result.singlelineStructure !== null);

  for (const heading of ["Traits", "Actions", "Legendary Actions"]) {
    const start = source.indexOf(heading);
    assert.notEqual(start, -1, heading);
    const entry: SinglelineSyntheticEntry | undefined = result.singlelineStructure.entries.find(
      (current) => current.start === start,
    );
    assert.ok(entry, `missing synthetic heading ${heading}`);
    assert.equal(entry.role, "top_level");
    assert.ok(entry.evidence.includes("composite_title_shape") || entry.evidence.includes("named_title_shape"));
  }
});

test("singleline reconstruction does not promote sentence-shaped prose as a composite structural lead", () => {
  const source = "Creature Alpha Rule. Text. The creature moves quickly Beta Rule. More text.";
  const result = prepared(source);
  assert.ok(result.singlelineStructure !== null);
  const proseStart = source.indexOf("The creature moves quickly");
  assert.notEqual(proseStart, -1);
  const entry: SinglelineSyntheticEntry | undefined = result.singlelineStructure.entries.find(
    (current) => current.start === proseStart,
  );
  assert.equal(entry?.evidence.includes("composite_title_shape") ?? false, false);
});

test("singleline reconstruction marks introduced ordered-list markers as internal hierarchy", () => {
  const source = "Creature Gaze. Choose one: 1. First Result. Text. 2. Second Result. Text. Next Rule. Text.";
  const result = prepared(source);
  assert.ok(result.singlelineStructure !== null);
  for (const marker of ["1.", "2."]) {
    const start = source.indexOf(marker);
    const entry: SinglelineSyntheticEntry | undefined = result.singlelineStructure.entries.find(
      (current) => current.start === start,
    );
    assert.ok(entry, marker);
    assert.equal(entry.role, "internal");
    assert.ok(entry.evidence.includes("introduced_list_sequence"));
  }
});

test("singleline reconstruction marks repeated collapsed colon rows as internal hierarchy", () => {
  const source = "Creature Arcane Rule. Options: At will: alpha 3/day each: beta 1/day each: gamma Next Rule. Text.";
  const result = prepared(source);
  assert.ok(result.singlelineStructure !== null);
  for (const label of ["At will:", "3/day each:", "1/day each:"]) {
    const start = source.indexOf(label);
    const entry: SinglelineSyntheticEntry | undefined = result.singlelineStructure.entries.find(
      (current) => current.start === start,
    );
    assert.ok(entry, label);
    assert.equal(entry.role, "internal");
    assert.ok(entry.evidence.includes("introduced_compact_label_sequence"));
  }
});

test("singleline reconstruction leaves the complete coordinate lattice unchanged", () => {
  const source =
    "Creature Large outsider Armor Class 17 Hit Points 45 Traits First Rule. Text. Actions Second Rule. Text.";
  const result = prepared(source);
  assert.ok(result.singlelineStructure !== null);
  assert.equal(result.candidates.length, result.singlelineAudit?.candidateCount);
  for (const entry of result.singlelineStructure.entries) {
    assert.equal(result.candidates[entry.candidateIndex]?.start, entry.start);
  }
});

test("singleline reconstruction exposes exact split addresses inside an unpunctuated heading plus section prose", () => {
  const source = "Creature First Rule. Text. Legendary Actions Arbiter can take two options. Tail. Text.";
  const result = prepared(source);
  assert.ok(result.singlelineStructure !== null);
  const headingStart = source.indexOf("Legendary");
  const actionsStart = source.indexOf("Actions");
  const proseStart = source.indexOf("Arbiter");
  for (const start of [headingStart, actionsStart, proseStart]) {
    assert.notEqual(start, -1);
    assert.ok(
      result.candidates.some((candidate) => candidate.start === start),
      `missing exact address ${start}`,
    );
  }
  const entry: SinglelineSyntheticEntry | undefined = result.singlelineStructure.entries.find(
    (current) => current.start === headingStart,
  );
  assert.ok(entry);
  assert.equal(entry.role, "top_level");
  assert.ok(entry.evidence.includes("leading_label_run_shape"));
  assert.equal(
    result.singlelineStructure.entries.some(
      (current) => current.start === actionsStart && current.evidence.includes("leading_label_run_shape"),
    ),
    false,
  );
});
