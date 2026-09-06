import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLosslessSourceMap } from "./losslessSource.js";
import type { ParserMode } from "./parserRouting.js";
import type { StructuredModelRequest } from "./modelProvider.js";
import { analyzeStatblock } from "./pipeline.js";

function successfulModelResult(parsedContent: unknown) {
  return {
    rawContent: JSON.stringify(parsedContent),
    parsedContent,
    elapsedSeconds: 0.01,
  };
}

const legacyPipelineMarkers = [
  "headerWindowSizes",
  "bodyStartOffset",
  "UNIVERSAL_BOUNDED_HEADER_SCAN_SYSTEM_PROMPT",
  "RICH_BODY_ONLY_CANDIDATE_STRUCTURE_SYSTEM_PROMPT",
  "RICH_SINGLELINE_BODY_ONLY_CANDIDATE_STRUCTURE_SYSTEM_PROMPT",
  "SINGLELINE_TRANSITION_SYSTEM_PROMPT",
  "SINGLELINE_BOUNDARY_SYSTEM_PROMPT",
  "SINGLELINE_BLOCK_CLASSIFICATION_SYSTEM_PROMPT",
] as const;

test("pipeline source contains only the canonical ownership-first active architecture", () => {
  const source = readFileSync("src/pipeline.ts", "utf8");

  for (const marker of legacyPipelineMarkers) {
    assert.equal(
      source.includes(marker),
      false,
      `Legacy pipeline marker must not return to active pipeline.ts: ${marker}`,
    );
  }

  assert.match(source, /same closed fixed-Header semantic contract/u);
  assert.match(source, /No active path[\s\S]{0,120}bodyStart[\s\S]{0,120}semantic BODY generation/u);
});

test("every resolved parser mode stays on the canonical model-task set", async () => {
  const cases: Array<{
    mode: Exclude<ParserMode, "auto">;
    source: string;
    expectedCalls: number;
    bodyPrompt: RegExp | null;
  }> = [
    {
      mode: "multiline",
      source: "Creature\nActions\nBite. Text.",
      expectedCalls: 1,
      bodyPrompt: null,
    },
    {
      mode: "generic",
      source: "Creature\nActions Bite. Text.",
      expectedCalls: 2,
      bodyPrompt: /MIXED BODY TO MULTILINE NORMALIZATION MODE/u,
    },
    {
      mode: "singleline",
      source: "Creature Actions Bite. Text.",
      expectedCalls: 2,
      bodyPrompt: /SINGLELINE BODY TO MULTILINE NORMALIZATION MODE/u,
    },
  ];

  for (const current of cases) {
    const calls: StructuredModelRequest[] = [];
    await analyzeStatblock({
      rawSource: current.source,
      sourceMap: createLosslessSourceMap(current.source),
      model: "test-model",
      parserMode: current.mode,
      callModel: async (request) => {
        calls.push(request);
        if (/FIXED-HEADER COORDINATE MODE/u.test(request.systemPrompt)) {
          return successfulModelResult({ identity: [], fields: [], abilityLabels: [] });
        }
        if (/FIXED-HEADER CARD-FACT VERIFICATION MODE/u.test(request.systemPrompt)) {
          return successfulModelResult({ essentialFacts: [], abilityLabels: [] });
        }
        return successfulModelResult({ starts: [] });
      },
    });

    assert.equal(
      calls.length,
      current.expectedCalls,
      `${current.mode} must not fall through to another parser architecture`,
    );
    if (current.mode === "singleline") {
      assert.match(calls[0]?.systemPrompt ?? "", /FIXED-HEADER COORDINATE MODE/u);
      assert.match(calls[0]?.systemPrompt ?? "", /COMPLETE compact printed field/u);
      assert.match(calls[0]?.userPrompt ?? "", /ANNOTATED SOURCE START/u);
      assert.match(calls[0]?.userPrompt ?? "", /C000=Creature/u);
      assert.doesNotMatch(calls[0]?.userPrompt ?? "", /STRUCTURAL PROPOSALS|EXACT ADDRESS COORDINATES/u);
      const headerSchema = calls[0]?.jsonSchema as any;
      assert.ok(headerSchema?.properties?.identity);
      assert.ok(headerSchema?.properties?.fields);
      assert.equal(headerSchema?.properties?.fieldLabels, undefined);
      assert.equal(headerSchema?.properties?.identity?.items?.properties?.s?.type, "string");
      assert.equal(Array.isArray(headerSchema?.properties?.identity?.items?.properties?.s?.enum), false);
      assert.equal(headerSchema?.properties?.identity?.items?.properties?.s?.pattern, "^C[0-9]+$");
      assert.equal(headerSchema?.properties?.fields?.items?.properties?.k?.enum?.includes("ab"), false);
      assert.equal(headerSchema?.properties?.essentialFacts, undefined);
    } else {
      assert.match(calls[0]?.systemPrompt ?? "", /FIXED-HEADER CARD-FACT VERIFICATION MODE/u);
      const productionStartSchema = (calls[0]?.jsonSchema as any)?.properties?.essentialFacts?.items?.properties?.s;
      assert.ok(
        Array.isArray(productionStartSchema?.enum),
        `${current.mode} authoritative Header schema remains the established candidate enum`,
      );
    }
    if (current.bodyPrompt === null) {
      assert.equal(
        calls.length,
        1,
        "multiline must make one authoritative Header call and no diagnostic shadow/BODY call",
      );
    } else {
      assert.match(calls[1]?.systemPrompt ?? "", current.bodyPrompt);
      const bodyStartSchema = (calls[1]?.jsonSchema as any)?.properties?.starts?.items?.properties?.s;
      if (current.mode === "singleline") {
        assert.equal(bodyStartSchema?.type, "integer");
      } else {
        assert.equal(bodyStartSchema?.type, "string");
        assert.equal(Array.isArray(bodyStartSchema?.enum), true);
      }
    }

    for (const request of calls) {
      for (const marker of legacyPipelineMarkers.slice(2)) {
        assert.equal(
          request.systemPrompt.includes(marker),
          false,
          `${current.mode} must not invoke legacy task ${marker}`,
        );
      }
    }
  }
});

test("canonical mode failure paths do not fall back into legacy model tasks", async () => {
  for (const mode of ["multiline", "generic", "singleline"] as const) {
    const source = mode === "singleline" ? "Creature Actions Bite. Text." : "Creature\nActions Bite. Text.";
    const calls: StructuredModelRequest[] = [];

    await analyzeStatblock({
      rawSource: source,
      sourceMap: createLosslessSourceMap(source),
      model: "test-model",
      parserMode: mode,
      callModel: async (request) => {
        calls.push(request);
        throw new Error("simulated model outage");
      },
    });

    assert.equal(calls.length, mode === "multiline" ? 1 : 2);
    for (const request of calls) {
      for (const marker of legacyPipelineMarkers.slice(2)) {
        assert.equal(
          request.systemPrompt.includes(marker),
          false,
          `${mode} failure path must not fall back to ${marker}`,
        );
      }
    }
  }
});

test("active parser path has no deterministic English semantic profile", () => {
  const activeSources = [
    "src/candidateLattice.ts",
    "src/candidateTransport.ts",
    "src/headerFacts.ts",
    "src/abilityTableResolver.ts",
    "src/multilineDeterministic.ts",
  ].map((path) => [path, readFileSync(path, "utf8")] as const);

  for (const [path, source] of activeSources) {
    assert.equal(
      source.includes("englishCandidateEvidence"),
      false,
      `${path} must not import English candidate evidence`,
    );
    assert.equal(source.includes("headerLexicon"), false, `${path} must not use an English header lexicon`);
  }

  const latticeSource = readFileSync("src/candidateLattice.ts", "utf8");
  assert.equal(latticeSource.includes("CandidateStructuralEvidence"), false);
  assert.equal(latticeSource.includes("headerAnchors"), false);
  assert.equal(latticeSource.includes("abilityTableAnchors"), false);

  const factsSource = readFileSync("src/headerFacts.ts", "utf8");
  const abilityResolverSource = readFileSync("src/abilityTableResolver.ts", "utf8");
  assert.equal(/\\b\(STR\|DEX\|CON\|INT\|WIS\|CHA\)\\b/u.test(factsSource), false);
  assert.equal(/\\b\(STR\|DEX\|CON\|INT\|WIS\|CHA\)\\b/u.test(abilityResolverSource), false);
});

test("retired multiline bodyStart planner is absent from the active deterministic module", () => {
  const source = readFileSync("src/multilineDeterministic.ts", "utf8");
  assert.equal(source.includes("createMultilineBodyPlan"), false);
  assert.equal(source.includes("bodyStartCandidate"), false);
  assert.equal(source.includes("body_start_candidate="), false);
});

test("retired deterministic language-profile boundary machinery is absent from the active parser", () => {
  const activeSources = [
    "src/candidateLattice.ts",
    "src/sourceCandidates.ts",
    "src/boundaryEvidence.ts",
    "src/candidateTransport.ts",
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  assert.equal(activeSources.includes("profile_header_anchor"), false);
  assert.equal(activeSources.includes("profile_header_internal"), false);
  assert.equal(activeSources.includes("CandidateStructuralEvidence"), false);
});
test("final production Header path makes no diagnostic shadow call", async () => {
  const source = "Creature\nArmor Class 18\nActions\nBite. Text.";
  const calls: StructuredModelRequest[] = [];
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    parserMode: "multiline",
    callModel: async (request) => {
      calls.push(request);
      return successfulModelResult({
        essentialFacts: [
          { k: "n", s: "C000", e: "C000" },
          { k: "ac", s: "C001", e: "C001" },
        ],
        abilityLabels: [],
      });
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(result.essentialVerification?.shadowComparison, null);
  assert.equal(result.document.structuredHeader.armorClass?.value, 18);
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});
