import test from "node:test";
import assert from "node:assert/strict";

import { createLosslessSourceMap } from "./losslessSource.js";
import { createSinglelineHeaderAddressSpace } from "./singlelineHeaderAddressSpace.js";

test("singleline Header address space exposes every content-unit start and no structural semantics", () => {
  const source = "Creature Huge outsider, neutral AC 18 Speed 30 ft. Strange Title. Rule text 1/day.";
  const sourceMap = createLosslessSourceMap(source);
  const content = sourceMap.units.filter((unit) => unit.kind === "content");
  const candidates = createSinglelineHeaderAddressSpace(source, sourceMap);

  assert.equal(candidates.length, content.length);
  assert.deepEqual(
    candidates.map((candidate) => candidate.start),
    content.map((unit) => unit.start),
  );
  assert.deepEqual(
    candidates.map((candidate) => candidate.startUnitId),
    content.map((unit) => unit.id),
  );
  assert.deepEqual(candidates[0]?.reasons, ["document_start"]);
  assert.ok(candidates.slice(1).every((candidate) => candidate.reasons.length === 0));
  assert.ok(candidates.every((candidate) => candidate.boundary === undefined));

  const strange = candidates.find((candidate) => candidate.start === source.indexOf("Strange"));
  const numeric = candidates.find((candidate) => candidate.start === source.indexOf("1/day"));
  assert.ok(strange);
  assert.ok(numeric);
});

test("singleline Header address space keeps exact late labels addressable without a header/body boundary guess", () => {
  const filler = Array.from({ length: 220 }, (_, index) => `word${index}`).join(" ");
  const source = `Creature Large outsider AC 18 ${filler} Challenge 12 Proficiency Bonus +4 Trait.`;
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSinglelineHeaderAddressSpace(source, sourceMap);

  for (const text of ["Challenge", "Proficiency", "Bonus", "+4"]) {
    const offset = source.indexOf(text);
    assert.notEqual(offset, -1);
    assert.ok(
      candidates.some((candidate) => candidate.start === offset),
      `missing exact address for ${text}`,
    );
  }
});
