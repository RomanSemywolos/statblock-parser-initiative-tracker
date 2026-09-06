import test from "node:test";
import assert from "node:assert/strict";

import {
  createEssentialFactsGenerationJsonSchema,
  createMixedBodyBoundaryGenerationJsonSchema,
  createNumericBodyLineStartsGenerationJsonSchema,
  parseCandidateEssentialFactsResponse,
  parseCandidateModelResponse,
  parseMixedBodyBoundaryResponse,
  parseNumericBodyLineStartsResponse,
} from "./modelSchema.js";

function record(value: unknown): Record<string, any> {
  assert.ok(value !== null && typeof value === "object");
  return value as Record<string, any>;
}

test("mixed BODY schema exposes only allowed direct Cxxx start IDs", () => {
  const schema = record(createMixedBodyBoundaryGenerationJsonSchema(5, [0, 2, 4]));
  const enumValues = schema.properties.starts.items.properties.s.enum;
  assert.deepEqual(enumValues, ["C000", "C002", "C004"]);
  assert.equal(schema.properties.starts.maxItems, 3);
});

test("singleline numeric BODY schema keeps bounded integer starts", () => {
  const schema = record(createNumericBodyLineStartsGenerationJsonSchema(6, [0, 3, 5]));
  const start = schema.properties.starts.items.properties.s;
  assert.equal(start.type, "integer");
  assert.equal(start.minimum, 0);
  assert.equal(start.maximum, 5);
  assert.equal(schema.properties.starts.maxItems, 3);
});

test("mixed BODY parser accepts allowed Cxxx starts, sorts them, and rejects foreign coordinates", () => {
  const parsed = parseMixedBodyBoundaryResponse(
    { starts: [{ s: "C004" }, { s: "C001" }, { s: "C004" }, { s: "C009" }] },
    6,
    [1, 4],
  );
  assert.deepEqual(parsed.starts, [1, 4]);
  assert.equal(parsed.returnedCandidateCount, 2);
  assert.equal(parsed.issues.length, 2);
});

test("numeric BODY parser accepts only BODY-owned indexes", () => {
  const parsed = parseNumericBodyLineStartsResponse(
    { starts: [{ s: 5 }, { s: 2 }, { s: 2 }, { s: 8 }] },
    6,
    [2, 5],
    "singleline BODY multiline-normalization",
  );
  assert.deepEqual(parsed.starts, [2, 5]);
  assert.equal(parsed.issues.length, 2);
});

test("fixed Header schema is closed to nine card-critical fact kinds and candidate IDs", () => {
  const schema = record(createEssentialFactsGenerationJsonSchema(3));
  const fact = schema.properties.essentialFacts.items.properties;
  assert.deepEqual(fact.k.enum, ["n", "sta", "ac", "init", "hp", "ab", "sv", "cr", "pb"]);
  assert.deepEqual(fact.s.enum, ["C000", "C001", "C002"]);
  assert.deepEqual(fact.e.enum, ["C000", "C001", "C002"]);
  assert.deepEqual(schema.required, ["essentialFacts", "abilityLabels"]);
});

test("fixed Header parser grounds facts and normalizes compact ability-label hints", () => {
  const parsed = parseCandidateEssentialFactsResponse(
    {
      essentialFacts: [
        { k: "n", s: "C000", e: "C000" },
        { k: "ac", s: "C002", e: "C002" },
      ],
      abilityLabels: [
        { a: "str", q: "STR" },
        { a: "dex", q: "DEX" },
      ],
    },
    4,
  );
  assert.deepEqual(parsed.essentialFacts, [
    { kind: "name", startCandidate: 0, endCandidate: 0 },
    { kind: "armor_class", startCandidate: 2, endCandidate: 2 },
  ]);
  assert.deepEqual(parsed.abilityLabels, [
    { ability: "str", labelQuote: "STR" },
    { ability: "dex", labelQuote: "DEX" },
  ]);
  assert.deepEqual(parsed.issues, []);
});

test("fixed Header parser rejects duplicate kinds and out-of-range spans independently", () => {
  const parsed = parseCandidateEssentialFactsResponse(
    {
      essentialFacts: [
        { k: "ac", s: "C001", e: "C001" },
        { k: "ac", s: "C002", e: "C002" },
        { k: "hp", s: "C003", e: "C099" },
      ],
      abilityLabels: [],
    },
    4,
  );
  assert.deepEqual(parsed.essentialFacts, [{ kind: "armor_class", startCandidate: 1, endCandidate: 1 }]);
  assert.equal(parsed.issues.length, 2);
});

test("candidate response parser maps active sparse structural codes", () => {
  const parsed = parseCandidateModelResponse(
    {
      blocks: [
        { k: "n", s: "C000", e: "C000" },
        { k: "sta", s: "C001", e: "C001" },
        { k: "h", f: "spd", s: "C002", e: "C002" },
        { k: "sh", v: "a", s: "C003", e: "C003" },
        { k: "f", s: "C004", e: "C005" },
      ],
    },
    6,
  );
  assert.deepEqual(
    parsed.runs.map((run) => [run.classification, run.field]),
    [
      ["name", null],
      ["size_type_alignment", null],
      ["header_field", "speed"],
      ["actions_heading", null],
      ["feature", null],
    ],
  );
  assert.equal(parsed.issues.length, 0);
});

test("section-heading identity survives without invented semantic subtype", () => {
  const parsed = parseCandidateModelResponse({ blocks: [{ k: "sh", s: "C001", e: "C001" }] }, 3);
  assert.equal(parsed.runs[0]?.classification, "unknown_section_heading");
  assert.match(parsed.issues[0]?.message ?? "", /without inventing section semantics/i);
});

test("candidate response parser rejects malformed and out-of-range spans without losing valid neighbors", () => {
  const parsed = parseCandidateModelResponse(
    {
      blocks: [
        { k: "f", s: "C000", e: "C000" },
        { k: "f", s: "C004", e: "C004" },
        { k: "f", s: "C002", e: "C001" },
        { k: "wat", s: "C001", e: "C001" },
      ],
    },
    3,
  );
  assert.deepEqual(
    parsed.runs.map((run) => [run.startCandidate, run.endCandidate]),
    [[0, 0]],
  );
  assert.equal(parsed.issues.length, 3);
});

test("empty candidate response remains a valid deterministic fallback envelope", () => {
  const parsed = parseCandidateModelResponse({ blocks: [] }, 7);
  assert.deepEqual(parsed.runs, []);
  assert.deepEqual(parsed.issues, []);
});
