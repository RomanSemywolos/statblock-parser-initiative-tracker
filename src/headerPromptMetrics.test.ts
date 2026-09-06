import assert from "node:assert/strict";
import test from "node:test";

import { measureHeaderPromptRequest } from "./headerPromptMetrics.js";
import type { StructuredModelRequest } from "./modelProvider.js";
import type { SourceCandidate } from "./sourceCandidates.js";

function candidates(rawSource: string, starts: readonly number[]): SourceCandidate[] {
  return starts.map((start, index) => ({
    id: `candidate-${index}`,
    start,
    startUnitId: `unit-${index}`,
    preview: rawSource.slice(start, starts[index + 1] ?? rawSource.length),
    reasons: index === 0 ? ["document_start"] : ["line_start"],
  }));
}

function request(
  userPrompt: string,
  schema: unknown = { type: "string", enum: ["C000", "C001"] },
): StructuredModelRequest {
  return {
    model: "test",
    systemPrompt: "system C999",
    userPrompt,
    jsonSchema: schema,
  };
}

test("Header prompt metrics measure universal candidate and hint transport without changing request", () => {
  const userPrompt = `SOURCE EXCERPT START\nabc\nSOURCE EXCERPT END\n\nSTRUCTURAL PROPOSALS START\nC000: abc\nC001: def\nSTRUCTURAL PROPOSALS END\n\nSOURCE-SHAPE HINTS START\nC000 -> C001: shape\nSOURCE-SHAPE HINTS END`;
  const before = JSON.stringify(request(userPrompt));
  const metrics = measureHeaderPromptRequest(request(userPrompt), "abc", candidates("abc", [0, 1]));

  assert.equal(metrics.sourceCharacters, 3);
  assert.equal(metrics.candidateCount, 2);
  assert.ok(metrics.candidateTransportCharacters >= "\nC000: abc\nC001: def\n".length);
  assert.ok(metrics.hintTransportCharacters >= "\nC000 -> C001: shape\n".length);
  assert.equal(metrics.candidateIdOccurrencesInJsonSchema, 2);
  assert.equal(metrics.shadowOverlayValid, false);
  assert.equal(metrics.shadowCoordinateCount, null);
  assert.equal(metrics.shadowStructuralClassCount, null);
  assert.equal(metrics.shadowStructuralClassLegendCharacters, null);
  assert.equal(metrics.shadowSourceCharacters, null);
  assert.equal(metrics.coordinateTransportCharacterDelta, null);
  assert.equal(metrics.shadowRequestTextCharacters, null);
  assert.equal(metrics.shadowRequestSystemPromptCharacters, null);
  assert.equal(metrics.shadowRequestUserPromptCharacters, null);
  assert.equal(metrics.shadowRequestCandidateIdOccurrencesInJsonSchema, null);
  assert.equal(metrics.shadowRequestCandidateIdOccurrencesInUserPrompt, null);
  assert.equal(metrics.shadowRequestJsonSchemaCharacters, null);
  assert.equal(metrics.shadowRequestCharacterDelta, null);
  assert.equal(metrics.shadowRequestReductionRatio, null);
  assert.equal(JSON.stringify(request(userPrompt)), before);
});

test("Header prompt metrics add both singleline coordinate channels", () => {
  const userPrompt = `SINGLELINE HEADER STRUCTURAL PROPOSALS START\nC000: A\nSINGLELINE HEADER STRUCTURAL PROPOSALS END\nSINGLELINE HEADER EXACT ADDRESS COORDINATES START\nC001: B\nSINGLELINE HEADER EXACT ADDRESS COORDINATES END\nSOURCE-SHAPE HINTS START\n(none)\nSOURCE-SHAPE HINTS END`;
  const metrics = measureHeaderPromptRequest(request(userPrompt), "A B", candidates("A B", [0, 2]));

  assert.ok(metrics.candidateTransportCharacters >= "\nC000: A\n".length + "\nC001: B\n".length);
  assert.equal(metrics.candidateIdOccurrencesInUserPrompt, 2);
});

test("final Header prompt metrics retain historical shadow fields as null compatibility slots", () => {
  const userPrompt = `STRUCTURAL PROPOSALS START\nC000: A\nC001: B\nSTRUCTURAL PROPOSALS END`;
  const malformed = candidates("A B", [0, 2]);
  malformed[1] = { ...malformed[1]!, start: 0 };
  const metrics = measureHeaderPromptRequest(request(userPrompt), "A B", malformed);

  assert.equal(metrics.shadowOverlayValid, false);
  assert.equal(metrics.shadowSourceCharacters, null);
  assert.equal(metrics.shadowCoordinateMarkerCharacters, null);
  assert.equal(metrics.shadowStructuralClassLegendCharacters, null);
  assert.equal(metrics.coordinateTransportCharacterDelta, null);
  assert.equal(metrics.shadowRequestSystemPromptCharacters, null);
  assert.equal(metrics.shadowRequestUserPromptCharacters, null);
  assert.equal(metrics.shadowRequestCharacterDelta, null);
  assert.equal(metrics.shadowRequestTextCharacters, null);
  assert.ok(metrics.candidateTransportCharacters > 0);
});
