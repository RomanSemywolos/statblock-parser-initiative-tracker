import assert from "node:assert/strict";
import test from "node:test";

import type { ModelHealth, ModelProvider, StructuredModelRequest, StructuredModelResult } from "./modelProvider.js";
import { createProductParseJobRunner } from "./productParseJobRunner.js";

test("product parse job runner returns only editable product result for empty source", async () => {
  let called = false;
  const provider: ModelProvider = {
    id: "test",
    displayName: "Test",
    providerType: "test",
    model: "unused",
    async generateStructured(_request: StructuredModelRequest): Promise<StructuredModelResult> {
      called = true;
      throw new Error("empty source must not call model");
    },
    async healthCheck(): Promise<ModelHealth> {
      return { ok: true };
    },
  };

  const runner = createProductParseJobRunner({
    provider,
    parserVersion: "test-parser",
  });
  const result = await runner("", "job-1", "generic");

  assert.equal(called, false);
  assert.equal(result.statblockId, "job-1");
  assert.equal(result.parserVersion, "test-parser");
  assert.equal(result.parserMode, "generic");
  assert.equal(result.rawSource, "");
  assert.equal(result.editableDocument.formatVersion, "editable-statblock-v2");
  assert.deepEqual(result.editableDocument.body, []);
  assert.deepEqual(result.editableDocument.header.name, { id: "header-name", field: "name", text: "" });
  assert.equal("annotations" in result.editableDocument, false);
});
