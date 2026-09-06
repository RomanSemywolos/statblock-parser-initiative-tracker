import assert from "node:assert/strict";
import test from "node:test";

import { parseForProduct } from "./productParser.js";

test("parseForProduct exposes only v2 editable product document on empty import", async () => {
  const result = await parseForProduct({ rawSource: "", model: "unused" });
  assert.equal(result.formatVersion, "editable-statblock-v2");
  assert.deepEqual(result.body, []);
  assert.equal(result.header.name?.text, "");
  assert.equal(result.header.subtitle, null);
  assert.equal(result.facts.name, null);
  assert.equal("annotations" in result, false);
  assert.equal("sourceMap" in result, false);
});
