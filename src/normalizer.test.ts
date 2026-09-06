import test from "node:test";
import assert from "node:assert/strict";

import { normalizePresentationText } from "./normalizer.js";

test("joins arbitrary copied line wrapping without changing any non-whitespace token", () => {
  const source = "Saving\nThrows\r\nDEX\t+10,\nCON\n+13";
  const normalized = normalizePresentationText(source);

  assert.equal(normalized, "Saving Throws DEX +10, CON +13");
  assert.deepEqual(normalized.match(/[^\s]+/gu), source.match(/[^\s]+/gu));
});
