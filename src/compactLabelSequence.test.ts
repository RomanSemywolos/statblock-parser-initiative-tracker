import assert from "node:assert/strict";
import test from "node:test";

import { sequentialInlineCompactLabelStarts } from "./compactLabelSequence.js";

test("introduced compact label proof crosses exactly one physical newline after the introducing colon", () => {
  const source =
    "Spellcasting intro:\nCantrips (at will): alpha, beta 1st level (4 slots): gamma 2nd level (3 slots): delta";
  const starts = sequentialInlineCompactLabelStarts(source);
  assert.equal(starts.has(source.indexOf("Cantrips")), true);
  assert.equal(starts.has(source.indexOf("1st level")), true);
});

test("introduced compact label proof does not cross a blank paragraph after the introducing colon", () => {
  const source =
    "Spellcasting intro:\n\nCantrips (at will): alpha, beta 1st level (4 slots): gamma 2nd level (3 slots): delta";
  const starts = sequentialInlineCompactLabelStarts(source);
  assert.equal(starts.has(source.indexOf("Cantrips")), false);
});
