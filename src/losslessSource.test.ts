import test from "node:test";
import assert from "node:assert/strict";

import { createLosslessSourceMap, reconstructLosslessSource, validateLosslessSourceMap } from "./losslessSource.js";

test("preserves monolithic, tabular and Unicode source exactly", () => {
  const source = "Solar Large Celestial\r\nMod\tSave\r\nSTR\t26\t+8\nTraits Divine Awareness. 🕷️";

  const sourceMap = createLosslessSourceMap(source);

  assert.equal(reconstructLosslessSource(sourceMap), source);

  assert.equal(validateLosslessSourceMap(source, sourceMap), true);

  for (const unit of sourceMap.units) {
    assert.equal(source.slice(unit.start, unit.end), unit.text);
  }
});

test("reconstructs 500 deterministic arbitrary-format strings", () => {
  const alphabet = ["A", "z", "0", ".", "—", "’", "🕷️", " ", " ", "\t", "\n", "\r", "\r\n", "\u00a0"];

  let state = 0x51f15e;

  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state;
  };

  for (let caseIndex = 0; caseIndex < 500; caseIndex += 1) {
    const partCount = next() % 100;

    let source = "";

    for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
      source += alphabet[next() % alphabet.length];
    }

    const sourceMap = createLosslessSourceMap(source);

    assert.equal(reconstructLosslessSource(sourceMap), source, `case ${caseIndex}`);

    assert.equal(validateLosslessSourceMap(source, sourceMap), true, `case ${caseIndex}`);
  }
});

test("rejects changed source text, gaps, overlaps and renamed units", () => {
  const source = "Armor Class 19";

  const original = createLosslessSourceMap(source);

  const changedText = structuredClone(original);
  changedText.units[0].text = "Damage";

  const gap = structuredClone(original);
  gap.units.splice(1, 1);

  const overlap = structuredClone(original);
  overlap.units[1].start = 0;

  const renamed = structuredClone(original);
  renamed.units[0].id = "unit-999";

  for (const invalid of [changedText, gap, overlap, renamed]) {
    assert.equal(validateLosslessSourceMap(source, invalid), false);
  }
});
