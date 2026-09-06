import test from "node:test";
import assert from "node:assert/strict";

import { OllamaInvalidJsonError } from "./ollamaClient.js";

import { reconstructBlocks } from "./annotationCompiler.js";
import { applyCallerCompletionLimit, bodyStartsCompletionBudget } from "./bodyCompletionBudget.js";

import { createLosslessSourceMap } from "./losslessSource.js";
import { prepareCandidateLattice, singlelineBodyNormalizationCandidates } from "./candidateLattice.js";
import type { StructuredModelRequest } from "./modelProvider.js";

import { analyzeStatblock } from "./pipeline.js";
import { renderNormalizedStatblock } from "./renderer.js";

function successfulModelResult(parsedContent: unknown, elapsedSeconds = 0.5) {
  return {
    rawContent: JSON.stringify(parsedContent),
    parsedContent,
    elapsedSeconds,
  };
}

function universalHeaderCandidates(source: string) {
  const sourceMap = createLosslessSourceMap(source);
  return prepareCandidateLattice(source, sourceMap, "generic").headerCandidates;
}

function isVerificationRequest(request: StructuredModelRequest): boolean {
  return request.task === "header";
}

test("multiline header-locator failure is non-critical and deterministic BODY still preserves exact source", async () => {
  const source = "Arasta\r\nArmor Class 19\r\nActions\r\nBite. Text.";
  const sourceMap = createLosslessSourceMap(source);
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    callModel: async () => {
      throw new Error("simulated outage");
    },
  });

  assert.equal(result.document.model.succeeded, false);
  assert.equal(result.document.structuredHeader.armorClass, null);
  assert.ok(
    result.document.annotations.some(
      (annotation) => annotation.role === "feature" && annotation.text.startsWith("Bite."),
    ),
  );
  assert.ok(result.document.issues.some((issue) => issue.code === "essential_verification_failed"));
  assert.equal(reconstructBlocks(result.document.blocks), source);
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("normalizes arbitrary line wrapping only in presentation while the document remains byte-exact", async () => {
  const feature = "Flying\nSword.\nMelee or Ranged Attack Roll:\n+15, reach 10 ft.";
  const source = `Solar\nActions\n${feature}`;
  const sourceMap = createLosslessSourceMap(source);
  const headerCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hid = (text: string): string => {
    const index = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return `C${String(index).padStart(3, "0")}`;
  };
  const mid = (text: string): number => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return index;
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      if (isVerificationRequest(request))
        return successfulModelResult({
          essentialFacts: [{ k: "n", s: hid("Solar"), e: hid("Solar") }],
          abilityLabels: [],
        });
      return successfulModelResult({
        starts: [
          { s: `C${String(mid("Actions")).padStart(3, "0")}` },
          { s: `C${String(mid("Flying")).padStart(3, "0")}` },
        ],
      });
    },
  });

  assert.match(
    renderNormalizedStatblock(result.document),
    /Flying Sword\. Melee or Ranged Attack Roll: \+15, reach 10 ft\./u,
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
  assert.equal(result.document.rawSource, source);
});

test("invalid JSON is preserved for diagnostics while source import succeeds", async () => {
  const source = "Solar Actions Flying Sword. Text.";

  const invalidJson = '{"header":[';

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: async () => {
      throw new OllamaInvalidJsonError("invalid JSON", invalidJson, 1.25, "length");
    },
  });

  assert.equal(result.rawModelContent, invalidJson);
  assert.equal(reconstructBlocks(result.document.blocks), source);
  assert.equal(result.document.model.elapsedSeconds, 2.5);
});

test("singleline ownership prompt exposes a neutral inline coordinate overlay", async () => {
  const source = "Solar Large Celestial Armor Class 21 Speed 40 ft. Actions Flying Sword. Hit: 22 damage.";
  const sourceMap = createLosslessSourceMap(source);
  const preparedSingleline = prepareCandidateLattice(source, sourceMap, "singleline");
  const headerCandidates = preparedSingleline.headerCandidates;
  const singlelineCandidates = singlelineBodyNormalizationCandidates(preparedSingleline);
  const headerId = (text: string): string => {
    const index = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing singleline Header coordinate ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };
  const sId = (text: string): number => {
    const index = singlelineCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return index;
  };
  const capturedPrompts: string[] = [];
  const capturedSchemas: unknown[] = [];

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "singleline",
    callModel: async (request) => {
      capturedPrompts.push(request.userPrompt);
      capturedSchemas.push(request.jsonSchema);
      assert.equal(request.temperature, 0);
      if (isVerificationRequest(request)) {
        return successfulModelResult({
          identity: [
            { k: "n", s: headerId("Solar"), e: headerId("Solar") },
            { k: "sta", s: headerId("Large"), e: headerId("Celestial") },
          ],
          fields: [{ k: "ac", s: headerId("Armor"), e: headerId("21") }],
          abilityLabels: [],
        });
      }
      return successfulModelResult({
        starts: [{ s: sId("Speed 40 ft.") }, { s: sId("Actions") }, { s: sId("Flying Sword.") }],
      });
    },
  });

  assert.equal(capturedPrompts.length, 2);
  assert.match(capturedPrompts[0], /ANNOTATED SOURCE START[\s\S]*C000=Solar[\s\S]*ANNOTATED SOURCE END/u);
  assert.match(capturedPrompts[0], /C\d{3}=Armor/u);
  assert.doesNotMatch(capturedPrompts[0], /SINGLELINE HEADER STRUCTURAL PROPOSALS|EXACT ADDRESS COORDINATES/u);
  assert.match(capturedPrompts[1], /BODY SOURCE VIEW START/u);
  assert.match(capturedPrompts[1], /BODY CANDIDATES START[\s\S]*C\d+/u);
  assert.match(capturedPrompts[1], /BODY STRUCTURAL CLASSES START/u);
  assert.match(capturedPrompts[1], /class=\d+/u);
  assert.doesNotMatch(capturedPrompts.join("\n"), /unit-\d+/u);
  assert.equal(JSON.stringify(capturedSchemas).includes("oneOf"), false);
  assert.equal(result.document.model.requestCount, 2);
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("singleline Header claims cannot author replacement text and unsafe evidence is rejected", async () => {
  const source = "Arasta Armor Class 19 Actions Bite. Hit: 20 piercing damage.";
  const sourceMap = createLosslessSourceMap(source);
  const preparedSingleline = prepareCandidateLattice(source, sourceMap, "singleline");
  const headerCandidates = preparedSingleline.headerCandidates;
  const singlelineCandidates = singlelineBodyNormalizationCandidates(preparedSingleline);
  const headerId = (text: string): string => {
    const index = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing singleline Header coordinate ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };
  const sId = (text: string): number => {
    const index = singlelineCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return index;
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "singleline",
    callModel: async (request) => {
      if (isVerificationRequest(request)) {
        // Deliberately claim a real BODY word as the AC semantic label.
        // Grounding can find the quote, but compact numeric shape must reject it.
        return successfulModelResult({
          identity: [{ k: "n", s: headerId("Arasta"), e: headerId("Arasta") }],
          fields: [{ k: "ac", s: headerId("Actions"), e: headerId("Actions") }],
          abilityLabels: [],
        });
      }
      return successfulModelResult({
        starts: [{ s: sId("Armor Class 19") }, { s: sId("Actions") }, { s: sId("Bite.") }],
      });
    },
  });

  assert.equal(result.document.structuredHeader.armorClass, null);
  assert.equal(reconstructBlocks(result.document.blocks), source);
  assert.equal(
    result.document.blocks.some((block) => block.text.includes("Armor Class 19")),
    true,
  );
  assert.equal(
    result.document.blocks.some((block) => block.text.includes("Armor Class 20")),
    false,
  );
});

test("mixed BODY preserves tables and complete continuation paragraphs exactly without promoting incomplete abilities to Header", async () => {
  const table = "Mod\tSave\r\nSTR\t26\t+8\t+8\r\nDEX\t22\t+6\t+6";
  const feature = "Web. First paragraph.\r\n\r\nThis continuation is part of the same feature.";
  const source = `Solar\r\n${table}\r\nActions\r\n${feature}`;
  const sourceMap = createLosslessSourceMap(source);
  const headerCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hid = (text: string): string => {
    const index = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return `C${String(index).padStart(3, "0")}`;
  };
  const mid = (text: string): number => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing mixed candidate ${text}`);
    return index;
  };
  const id = (index: number): string => `C${String(index).padStart(3, "0")}`;

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      if (isVerificationRequest(request))
        return successfulModelResult({ essentialFacts: [{ k: "n", s: hid("Solar"), e: hid("Solar") }] });
      assert.match(request.systemPrompt, /MIXED BODY TO MULTILINE NORMALIZATION MODE/u);
      return successfulModelResult({
        starts: [{ s: id(mid("Mod")) }, { s: id(mid("Actions")) }, { s: id(mid("Web.")) }],
      });
    },
  });

  assert.equal(result.document.structuredHeader.name?.text, "Solar");
  assert.equal(result.document.structuredHeader.abilityEvidence, null);
  assert.equal(
    result.document.annotations.some((annotation) => annotation.field === "ability_scores"),
    false,
  );
  assert.equal(
    result.document.annotations.find(
      (annotation) => annotation.role === "feature" && annotation.text.startsWith("Web."),
    )?.text,
    feature,
  );
  assert.ok(result.document.blocks.some((block) => block.text.includes(table)));
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("mixed BODY missing line start coarsens one normalized multiline row without creating gaps or overlaps", async () => {
  const source = [
    "Arasta",
    "Traits",
    "First Trait. Text.",
    "Second Trait. Text.",
    "Third Trait. Text.",
    "Actions",
    "Bite. Text.",
  ].join("\n\n");
  const sourceMap = createLosslessSourceMap(source);
  const headerCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hName = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf("Arasta"));
  assert.notEqual(hName, -1);
  const at = (text: string): number => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing mixed candidate ${text}`);
    return index;
  };
  const id = (index: number): string => `C${String(index).padStart(3, "0")}`;

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      if (isVerificationRequest(request))
        return successfulModelResult({ essentialFacts: [{ k: "n", s: id(hName), e: id(hName) }] });
      return successfulModelResult({
        starts: [
          { s: id(at("Traits")) },
          { s: id(at("First Trait.")) },
          // Deliberately omit Second Trait as a boundary. The deterministic
          // partition must keep its source inside the preceding ordinary block.
          { s: id(at("Third Trait.")) },
          { s: id(at("Actions")) },
          { s: id(at("Bite.")) },
        ],
      });
    },
  });

  const first = result.document.annotations.find((annotation) => annotation.text.includes("First Trait. Text."));
  assert.ok(first?.text.includes("Second Trait. Text."));
  assert.equal(
    result.document.blocks.some((block) => block.kind === "unclassified" && block.text.includes("Second Trait. Text.")),
    false,
  );
  assert.equal(
    result.document.issues.some((currentIssue) => currentIssue.code === "candidate_structural_overlap_rejected"),
    false,
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("mixed source-proven ALL-CAPS row keeps its following physical prose on a separate logical line", async () => {
  const source = [
    "Creature",
    "LEGENDARY ACTIONS",
    "The creature can take 3 legendary actions, choosing from the options below.",
    "Attack. The creature attacks.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const headerCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hName = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf("Creature"));
  assert.notEqual(hName, -1);
  const id = (text: string): string => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing mixed candidate ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      if (isVerificationRequest(request))
        return successfulModelResult({
          essentialFacts: [
            { k: "n", s: `C${String(hName).padStart(3, "0")}`, e: `C${String(hName).padStart(3, "0")}` },
          ],
        });
      // Deliberately omit the explanatory paragraph. Source-proven physical
      // geometry must keep it separate from the ALL-CAPS row anyway.
      return successfulModelResult({ starts: [{ s: id("LEGENDARY ACTIONS") }, { s: id("Attack.") }] });
    },
  });

  const heading = result.document.annotations.find((annotation) => annotation.role === "section_heading");
  assert.equal(heading?.text.trim(), "LEGENDARY ACTIONS");
  assert.ok(result.document.blocks.some((block) => block.text.includes("The creature can take 3 legendary actions")));
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("mixed source-proven title-case standalone row keeps its following physical prose separate when model omits it", async () => {
  const source = [
    "Creature",
    "Legendary Actions",
    "The creature can take 3 legendary actions, choosing from the options below.",
    "Attack. The creature attacks.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const headerCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hName = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf("Creature"));
  assert.notEqual(hName, -1);
  const id = (text: string): string => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing mixed candidate ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      if (isVerificationRequest(request))
        return successfulModelResult({
          essentialFacts: [
            { k: "n", s: `C${String(hName).padStart(3, "0")}`, e: `C${String(hName).padStart(3, "0")}` },
          ],
        });
      return successfulModelResult({ starts: [{ s: id("Attack.") }] });
    },
  });

  const heading = result.document.annotations.find((annotation) => annotation.role === "section_heading");
  assert.equal(heading?.text.trim(), "Legendary Actions");
  assert.ok(result.document.blocks.some((block) => block.text.includes("The creature can take 3 legendary actions")));
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("singleline missing line start coarsens geometry without losing the omitted source", async () => {
  const source = "Arasta Traits First. Text. Missing. Text. Actions Bite. Text.";
  const sourceMap = createLosslessSourceMap(source);
  const preparedSingleline = prepareCandidateLattice(source, sourceMap, "singleline");
  const headerCandidates = preparedSingleline.headerCandidates;
  const singlelineCandidates = singlelineBodyNormalizationCandidates(preparedSingleline);
  const headerId = (text: string): string => {
    const index = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing singleline Header coordinate ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };
  const sId = (text: string): number => {
    const index = singlelineCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing singleline candidate ${text}`);
    return index;
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "singleline",
    callModel: async (request) => {
      if (isVerificationRequest(request))
        return successfulModelResult({
          identity: [{ k: "n", s: headerId("Arasta"), e: headerId("Arasta") }],
          fieldStarts: [],
          abilityLabels: [],
        });
      return successfulModelResult({
        starts: [
          { s: sId("Traits") },
          { s: sId("First.") },
          // Deliberately omit Missing. It must remain inside the preceding
          // normalized line rather than disappear or become a second semantic pass.
          { s: sId("Actions") },
          { s: sId("Bite.") },
        ],
      });
    },
  });

  assert.equal(reconstructBlocks(result.document.blocks), source);
  assert.equal(
    result.document.blocks.some((block) => block.text.includes("Missing. Text.")),
    true,
  );
  assert.equal(
    result.parserRouting.signals.some((signal) => signal.code === "singleline_body_multiline_normalized"),
    true,
  );
});

test("empty source skips the model and remains exactly empty", async () => {
  let called = false;

  const result = await analyzeStatblock({
    rawSource: "",
    sourceMap: createLosslessSourceMap(""),
    model: "test-model",
    callModel: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });

  assert.equal(called, false);
  assert.equal(result.document.model.attempted, false);
  assert.equal(result.document.blocks.length, 0);
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("multiline fixed-header locator plus deterministic BODY runs end to end without model-generated source quotes", async () => {
  const source = [
    "Creature",
    "Medium fiend, neutral evil",
    "Armor Class 18",
    "Hit Points 100",
    "STR DEX CON INT WIS CHA",
    "20 (+5) 14 (+2) 18 (+4) 12 (+1) 16 (+3) 10 (+0)",
    "Actions",
    "Bite. First line. While bitten, the target is grappled.",
    "Claw. Text.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = universalHeaderCandidates(source);
  const cid = (text: string): string => {
    const index = candidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing candidate ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };
  const calls: StructuredModelRequest[] = [];
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "multiline",
    callModel: async (request) => {
      calls.push(request);
      assert.ok(isVerificationRequest(request));
      return successfulModelResult({
        essentialFacts: [
          { k: "n", s: cid("Creature"), e: cid("Creature") },
          { k: "sta", s: cid("Medium fiend"), e: cid("Medium fiend") },
          { k: "ac", s: cid("Armor Class"), e: cid("Armor Class") },
          { k: "hp", s: cid("Hit Points"), e: cid("Hit Points") },
          { k: "ab", s: cid("STR DEX"), e: cid("20 (+5)") },
        ],
        abilityLabels: [
          { a: "str", q: "STR" },
          { a: "dex", q: "DEX" },
          { a: "con", q: "CON" },
          { a: "int", q: "INT" },
          { a: "wis", q: "WIS" },
          { a: "cha", q: "CHA" },
        ],
      });
    },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.systemPrompt ?? "", /FIXED-HEADER CARD-FACT VERIFICATION MODE/u);
  assert.equal(result.document.structuredHeader.abilities.str?.score, 20);
  const actions = result.document.annotations.filter((annotation) => annotation.role === "feature");
  assert.equal(actions.length, 2);
  assert.match(actions[0].text, /While bitten, the target is grappled\./u);
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("multiline fixed-header contract leaves non-contract metadata in BODY without losing it", async () => {
  const source = [
    "Creature",
    "Medium fiend, neutral evil",
    "Armor Class 18",
    "Aether Index 7",
    "Actions",
    "Bite. Text.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = universalHeaderCandidates(source);
  const cid = (text: string): string => {
    const index = candidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return `C${String(index).padStart(3, "0")}`;
  };
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "multiline",
    callModel: async () =>
      successfulModelResult({
        essentialFacts: [
          { k: "n", s: cid("Creature"), e: cid("Creature") },
          { k: "sta", s: cid("Medium fiend"), e: cid("Medium fiend") },
          { k: "ac", s: cid("Armor Class"), e: cid("Armor Class") },
        ],
      }),
  });

  assert.equal(
    result.document.annotations.some((annotation) => annotation.field === "armor_class"),
    true,
  );
  assert.equal(
    result.document.annotations.some(
      (annotation) => annotation.role === "header_field" && annotation.text.startsWith("Aether Index"),
    ),
    false,
  );
  assert.equal(
    result.document.blocks.some((block) => block.text.includes("Aether Index 7")),
    true,
  );
  assert.equal(
    result.document.annotations.some(
      (annotation) => annotation.role === "feature" && annotation.text.startsWith("Bite."),
    ),
    true,
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("mixed uses exactly two model tasks: fixed Header locator then ownership-complement BODY parser", async () => {
  const source = [
    "Creature",
    "Medium fiend, neutral evil",
    "Armor Class 18",
    "Hit Points 100",
    "Speed 40 ft.",
    "Actions",
    "Bite. Hit: 10 damage.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const headerCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hid = (text: string): string => {
    const index = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return `C${String(index).padStart(3, "0")}`;
  };
  const mid = (text: string): number => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return index;
  };
  const calls: StructuredModelRequest[] = [];

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      calls.push(request);
      if (isVerificationRequest(request))
        return successfulModelResult(
          {
            essentialFacts: [
              { k: "n", s: hid("Creature"), e: hid("Creature") },
              { k: "sta", s: hid("Medium fiend"), e: hid("Medium fiend") },
              { k: "ac", s: hid("Armor Class"), e: hid("Armor Class") },
              { k: "hp", s: hid("Hit Points"), e: hid("Hit Points") },
            ],
          },
          0.1,
        );
      assert.match(request.systemPrompt, /MIXED BODY TO MULTILINE NORMALIZATION MODE/u);
      assert.match(request.systemPrompt, /ONLY task is to restore the logical line starts/u);
      assert.match(request.systemPrompt, /Do not classify anything/u);
      assert.match(request.systemPrompt, /same\s+deterministic BODY parser used for already-multiline input/iu);
      assert.match(request.userPrompt, /BODY SOURCE VIEW/u);
      assert.match(request.userPrompt, /BODY CANDIDATES/u);
      assert.match(request.userPrompt, /HEADER GAP/u);
      assert.doesNotMatch(request.userPrompt, /Also return abilityLabels/u);
      assert.doesNotMatch(request.userPrompt, /For h spans/u);
      assert.doesNotMatch(request.userPrompt, /Cover every meaningful candidate exactly once/u);
      return successfulModelResult(
        {
          starts: [
            { s: `C${String(mid("Speed")).padStart(3, "0")}` },
            { s: `C${String(mid("Actions")).padStart(3, "0")}` },
            { s: `C${String(mid("Bite.")).padStart(3, "0")}` },
          ],
        },
        0.2,
      );
    },
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(Object.keys((calls[0].jsonSchema as any).properties), ["essentialFacts", "abilityLabels"]);
  assert.deepEqual(Object.keys((calls[1].jsonSchema as any).properties), ["starts"]);
  const bodyStartSchema = (calls[1].jsonSchema as any).properties.starts.items.properties.s;
  assert.equal(bodyStartSchema.type, "string");
  assert.equal(Array.isArray(bodyStartSchema.enum), true);
  assert.match(calls[1].userPrompt, /evidence=/u);
  assert.doesNotMatch(calls[1].userPrompt, /BODY STRUCTURAL CLASSES START/u);
  assert.match(calls[1].userPrompt, /Bite\. Hit: 10 damage\./u);
  const armorCandidateId = `C${String(mid("Armor Class")).padStart(3, "0")}`;
  assert.equal(calls[1].userPrompt.includes(`${armorCandidateId} [`), false);
  assert.equal(calls[1].userPrompt.includes("Armor Class 18"), false);
  assert.equal(calls[1].userPrompt.includes("Hit Points 100"), false);
  assert.equal(result.essentialVerification?.status, "completed");
  assert.equal(result.bodyStructure?.status, "completed");
  assert.equal(result.document.model.requestCount, 2);
  assert.equal(result.document.structuredHeader.armorClass?.value, 18);
  assert.equal(
    result.document.annotations.some(
      (annotation) => annotation.role === "feature" && annotation.text.startsWith("Bite."),
    ),
    true,
  );
  assert.equal(
    result.document.annotations.some((annotation) => annotation.text.includes("Speed 40 ft.")),
    true,
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("failed Header card-fact locator cannot erase deterministic BODY or source", async () => {
  const source = "Creature\nArmor Class 18\nActions\nBite. Text.";
  const sourceMap = createLosslessSourceMap(source);
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "multiline",
    callModel: async () => {
      throw new Error("verification unavailable");
    },
  });

  assert.equal(result.essentialVerification?.status, "failed");
  assert.equal(result.document.structuredHeader.armorClass, null);
  assert.equal(
    result.document.annotations.some(
      (annotation) => annotation.role === "feature" && annotation.text.startsWith("Bite."),
    ),
    true,
  );
  assert.ok(result.document.issues.some((issue) => issue.code === "essential_verification_failed"));
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("mixed BODY provider failure falls back to source-proven physical rows instead of collapsing the remainder", async () => {
  const source = ["Creature", "Armor Class 18", "Actions", "Bite. Text.", "Claw. Text."].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = universalHeaderCandidates(source);
  const cid = (text: string): string => {
    const index = candidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return `C${String(index).padStart(3, "0")}`;
  };
  let calls = 0;
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      calls += 1;
      if (isVerificationRequest(request))
        return successfulModelResult({
          essentialFacts: [
            { k: "n", s: cid("Creature"), e: cid("Creature") },
            { k: "ac", s: cid("Armor Class"), e: cid("Armor Class") },
          ],
          abilityLabels: [],
        });
      throw new Error("provider request too large");
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.bodyStructure?.status, "failed");
  assert.ok(result.parserRouting.signals.some((signal) => signal.code === "mixed_body_physical_fallback"));
  assert.ok(
    result.document.annotations.some(
      (annotation) => annotation.role === "feature" && annotation.text.startsWith("Bite."),
    ),
  );
  assert.ok(
    result.document.annotations.some(
      (annotation) => annotation.role === "feature" && annotation.text.startsWith("Claw."),
    ),
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("multiline and mixed share the ownership-first Header locator while only mixed adds one BODY call", async () => {
  const source = [
    "Страж",
    "Большой конструкт, нейтральный",
    "Класс Доспеха 18",
    "Хиты 100",
    "Скорость 30 фт.",
    "Действия",
    "Удар. Цель получает урон.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = universalHeaderCandidates(source);
  const cid = (text: string): string => {
    const index = candidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return `C${String(index).padStart(3, "0")}`;
  };

  const multilineCalls: StructuredModelRequest[] = [];
  const multiline = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "multiline",
    callModel: async (request) => {
      multilineCalls.push(request);
      return successfulModelResult({
        essentialFacts: [
          { k: "n", s: cid("Страж"), e: cid("Страж") },
          { k: "sta", s: cid("Большой конструкт"), e: cid("Большой конструкт") },
          { k: "ac", s: cid("Класс Доспеха"), e: cid("Класс Доспеха") },
          { k: "hp", s: cid("Хиты"), e: cid("Хиты") },
        ],
      });
    },
  });
  assert.equal(multilineCalls.length, 1);
  assert.match(multilineCalls[0]?.systemPrompt ?? "", /FIXED-HEADER CARD-FACT VERIFICATION MODE/u);
  assert.equal(multiline.bodyStructure?.status, "not_run");
  assert.equal(multiline.document.structuredHeader.armorClass?.value, 18);
  assert.equal(
    multiline.document.blocks.some((block) => block.text.includes("Скорость 30 фт.")),
    true,
  );

  const genericCalls: StructuredModelRequest[] = [];
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const mid = (text: string): number => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return index;
  };
  const generic = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      genericCalls.push(request);
      if (isVerificationRequest(request))
        return successfulModelResult({
          essentialFacts: [
            { k: "n", s: cid("Страж"), e: cid("Страж") },
            { k: "sta", s: cid("Большой конструкт"), e: cid("Большой конструкт") },
            { k: "ac", s: cid("Класс Доспеха"), e: cid("Класс Доспеха") },
            { k: "hp", s: cid("Хиты"), e: cid("Хиты") },
          ],
        });
      return successfulModelResult({
        starts: [
          { s: `C${String(mid("Скорость")).padStart(3, "0")}` },
          { s: `C${String(mid("Действия")).padStart(3, "0")}` },
          { s: `C${String(mid("Удар.")).padStart(3, "0")}` },
        ],
      });
    },
  });
  assert.equal(genericCalls.length, 2);
  assert.match(genericCalls[0]?.systemPrompt ?? "", /FIXED-HEADER CARD-FACT VERIFICATION MODE/u);
  assert.match(genericCalls[1]?.systemPrompt ?? "", /MIXED BODY TO MULTILINE NORMALIZATION MODE/u);
  assert.equal(generic.document.structuredHeader.armorClass?.value, 18);
  assert.equal(
    generic.document.blocks.some((block) => block.text.includes("Скорость 30 фт.")),
    true,
  );
});

test("multiline repairs a verifier-truncated localized ability region without consuming the following save row", async () => {
  const source = [
    "Гитония [Hythonia]",
    "Большой монстр, законно-злой",
    "Класс Доспеха 17",
    "Хиты 199",
    "Сил",
    "21 (+5)",
    "Лов",
    "17 (+3)",
    "Тел",
    "19 (+4)",
    "Инт",
    "14 (+2)",
    "Мдр",
    "16 (+3)",
    "Хар",
    "18 (+4)",
    "Спасброски Сил +11, Тел +10, Хар +10",
    "Бонус мастерства +6",
    "Действия",
    "Когти. Цель получает урон.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = universalHeaderCandidates(source);
  const cid = (text: string): string => {
    const index = candidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing candidate for ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "multiline",
    callModel: async () =>
      successfulModelResult({
        essentialFacts: [
          { k: "n", s: cid("Гитония"), e: cid("Гитония") },
          { k: "sta", s: cid("Большой монстр"), e: cid("Большой монстр") },
          { k: "ac", s: cid("Класс Доспеха"), e: cid("Класс Доспеха") },
          { k: "hp", s: cid("Хиты"), e: cid("Хиты") },
          // Weak-model off-by-one: the semantic region ends on the final label,
          // exactly as in the 2.74.133 Hythonia report.
          { k: "ab", s: cid("Сил"), e: cid("Хар") },
          { k: "sv", s: cid("Спасброски"), e: cid("Спасброски") },
          { k: "pb", s: cid("Бонус мастерства"), e: cid("Бонус мастерства") },
        ],
        abilityLabels: [
          { a: "str", q: "Сил" },
          { a: "dex", q: "Лов" },
          { a: "con", q: "Тел" },
          { a: "int", q: "Инт" },
          { a: "wis", q: "Мдр" },
          { a: "cha", q: "Хар" },
        ],
      }),
  });

  assert.deepEqual(
    Object.entries(result.document.structuredHeader.abilities).map(([ability, fact]) => [ability, fact?.score ?? null]),
    [
      ["str", 21],
      ["dex", 17],
      ["con", 19],
      ["int", 14],
      ["wis", 16],
      ["cha", 18],
    ],
  );
  assert.equal(result.document.structuredHeader.abilityEvidence?.evidence.endsWith("18 (+4)"), true);
  assert.equal(result.document.structuredHeader.abilityEvidence?.evidence.includes("Спасброски"), false);
  assert.deepEqual(
    result.document.structuredHeader.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["str", 11],
      ["con", 10],
      ["cha", 10],
    ],
  );
  assert.ok(result.document.issues.some((issue) => issue.code === "verified_ability_region_constraint_extended"));
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("singleline ownership-first path normalizes BODY to multiline with one starts-only model call", async () => {
  const source =
    "Creature Medium fiend, neutral evil Armor Class 18 Speed 40 ft. Traits Keen Senses. Text. Actions Bite. Text.";
  const sourceMap = createLosslessSourceMap(source);
  const preparedSingleline = prepareCandidateLattice(source, sourceMap, "singleline");
  const singlelineCandidates = singlelineBodyNormalizationCandidates(preparedSingleline);
  const headerCandidates = preparedSingleline.headerCandidates;
  const headerId = (text: string): string => {
    const offset = source.indexOf(text);
    const index = headerCandidates.findIndex((candidate) => candidate.start === offset);
    assert.notEqual(index, -1, `Missing singleline Header coordinate for ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };
  const sId = (text: string): number => {
    const offset = source.indexOf(text);
    const index = singlelineCandidates.findIndex((candidate) => candidate.start === offset);
    assert.notEqual(index, -1, `Missing singleline candidate for ${text}`);
    return index;
  };
  const calls: StructuredModelRequest[] = [];

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    callModel: async (request) => {
      calls.push(request);
      if (isVerificationRequest(request)) {
        assert.match(request.systemPrompt, /FIXED-HEADER COORDINATE MODE/u);
        assert.match(request.systemPrompt, /COMPLETE compact printed field/u);
        assert.match(request.userPrompt, /ANNOTATED SOURCE START/u);
        assert.doesNotMatch(request.userPrompt, /STRUCTURAL PROPOSALS|EXACT ADDRESS COORDINATES/u);
        return successfulModelResult(
          {
            identity: [
              { k: "n", s: headerId("Creature"), e: headerId("Creature") },
              { k: "sta", s: headerId("Medium"), e: headerId("evil") },
            ],
            fields: [{ k: "ac", s: headerId("Armor"), e: headerId("18") }],
            abilityLabels: [],
          },
          0.01,
        );
      }
      assert.match(request.systemPrompt, /SINGLELINE BODY TO MULTILINE NORMALIZATION MODE/u);
      assert.equal(request.task, "body");
      assert.ok((request.numPredict ?? 0) >= 128);
      assert.match(request.userPrompt, /BODY SOURCE VIEW START/u);
      assert.match(request.userPrompt, /Speed 40 ft\./u);
      assert.match(request.userPrompt, /Traits/u);
      assert.match(request.userPrompt, /Keen/u);
      assert.match(request.userPrompt, /Actions/u);
      assert.match(request.userPrompt, /Bite/u);
      assert.doesNotMatch(request.systemPrompt, /STRUCTURAL-ROLE MODE/u);
      return successfulModelResult(
        {
          starts: [
            { s: sId("Speed 40 ft.") },
            { s: sId("Traits") },
            { s: sId("Keen Senses.") },
            { s: sId("Actions") },
            { s: sId("Bite.") },
          ],
        },
        0.01,
      );
    },
  });

  assert.equal(reconstructBlocks(result.document.blocks), source);
  assert.ok(result.parserRouting.signals.some((signal) => signal.code === "singleline_body_multiline_normalized"));
  assert.ok(result.parserRouting.signals.some((signal) => signal.code === "singleline_header_ownership_complement"));
  assert.equal(calls.length, 2);
  assert.equal(
    calls.filter((request) => /SINGLELINE BODY TO MULTILINE NORMALIZATION MODE/u.test(request.systemPrompt)).length,
    1,
  );
  assert.equal(
    calls.filter((request) => /PRE-SEGMENTED[\s\S]*STRUCTURAL-ROLE MODE/u.test(request.systemPrompt)).length,
    0,
  );
  assert.equal(result.bodyStructure?.classificationRequest, undefined);
  assert.equal(
    result.document.annotations.some((annotation) => annotation.role === "section_heading"),
    true,
  );
});

test("mixed Header facts may occur after BODY-like remainder without creating a global cutoff", async () => {
  const source = ["Creature", "Speed 40 ft.", "Trait One. Text.", "Armor Class 18", "Actions", "Bite. Text."].join(
    "\n",
  );
  const sourceMap = createLosslessSourceMap(source);
  const headerCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hid = (text: string): string => {
    const index = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return `C${String(index).padStart(3, "0")}`;
  };
  const mid = (text: string): string => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return `C${String(index).padStart(3, "0")}`;
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      if (isVerificationRequest(request))
        return successfulModelResult({
          essentialFacts: [
            { k: "n", s: hid("Creature"), e: hid("Creature") },
            { k: "ac", s: hid("Armor Class"), e: hid("Armor Class") },
          ],
        });
      return successfulModelResult({
        starts: [{ s: mid("Speed") }, { s: mid("Trait One.") }, { s: mid("Actions") }, { s: mid("Bite.") }],
      });
    },
  });

  assert.equal(result.document.structuredHeader.armorClass?.value, 18);
  assert.equal(
    result.document.annotations.some(
      (annotation) => annotation.role === "feature" && annotation.text.startsWith("Trait One."),
    ),
    true,
  );
  assert.equal(
    result.document.annotations.some(
      (annotation) => annotation.role === "feature" && annotation.text.startsWith("Bite."),
    ),
    true,
  );
  assert.match(
    result.parserRouting.signals.find((signal) => signal.code === "mixed_header_ownership_complement")?.detail ?? "",
    /No bodyStart/u,
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("mixed BODY boundary schema makes crossing accepted Header ownership impossible", async () => {
  const source = ["Creature", "Speed 40 ft.", "Armor Class 18", "Actions", "Bite. Text."].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const headerCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hid = (text: string): string => {
    const index = headerCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return `C${String(index).padStart(3, "0")}`;
  };
  const indexAt = (text: string): number => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1);
    return index;
  };
  const id = (index: number): string => `C${String(index).padStart(3, "0")}`;

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      if (isVerificationRequest(request))
        return successfulModelResult({
          essentialFacts: [
            { k: "n", s: hid("Creature"), e: hid("Creature") },
            { k: "ac", s: hid("Armor Class"), e: hid("Armor Class") },
          ],
        });
      const startSchema = (request.jsonSchema as any).properties.starts.items.properties.s;
      assert.equal(request.task, "body");
      assert.ok((request.numPredict ?? 0) >= 128);
      assert.equal(startSchema.type, "string");
      assert.equal(Array.isArray(startSchema.enum), true);
      assert.equal(request.numPredict, bodyStartsCompletionBudget(startSchema.enum));
      assert.equal(request.userPrompt.includes(`${id(indexAt("Armor Class"))} [`), false);
      return successfulModelResult({
        starts: [
          { s: id(indexAt("Speed")) },
          { s: id(indexAt("Armor Class")) }, // forbidden Header-owned index: deterministic parser must ignore it
          { s: id(indexAt("Actions")) },
          { s: id(indexAt("Bite.")) },
        ],
      });
    },
  });

  assert.equal(result.document.structuredHeader.armorClass?.value, 18);
  assert.equal(
    result.document.annotations.some(
      (annotation) => annotation.text.includes("Speed 40 ft.") && annotation.text.includes("Armor Class 18"),
    ),
    false,
  );
  assert.equal(
    result.document.annotations.some((annotation) => annotation.text.includes("Speed 40 ft.")),
    true,
  );
  assert.equal(
    result.document.issues.some((issue) => issue.code === "candidate_structural_overlap_rejected"),
    false,
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("BODY completion budget scales with exact legal start addresses and respects an explicit smaller caller limit", () => {
  const numericSmall = bodyStartsCompletionBudget([0, 1, 2]);
  const mixedStringLarge = bodyStartsCompletionBudget(
    Array.from({ length: 300 }, (_, index) => `C${String(index).padStart(3, "0")}`),
  );
  assert.ok(numericSmall >= 128);
  assert.ok(mixedStringLarge > 768);
  assert.ok(mixedStringLarge > numericSmall);
  assert.equal(applyCallerCompletionLimit(mixedStringLarge, 512), 512);
  assert.equal(applyCallerCompletionLimit(mixedStringLarge), mixedStringLarge);
});

test("multiline recovers localized abilities and adjacent saves from model label mappings even when verifier omits ab and sv", async () => {
  const source = [
    "Астральный Дредноут",
    "Громадный Монстр (титан), без мировоззрения",
    "Класс Доспеха 20 (природный доспех)",
    "Хиты 297 (17к20 + 119)",
    "Скорость 15 футов, летая 80 футов (парит)",
    "Сил 28 (+9) Лов 7 (-2) Тел 25 (+7) Инт 5 (-3) Мдр 14 (+2)",
    "Хар 18 (+4)",
    "Спасброски Лов +5, Мдр +9",
    "Опасность 21 (33 000 опыта)",
    "Бонус мастерства +7",
    "Действия",
    "Укус. Текст.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = universalHeaderCandidates(source);
  const cid = (text: string): string => {
    const index = candidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing candidate ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "multiline",
    callModel: async () =>
      successfulModelResult({
        essentialFacts: [
          { k: "n", s: cid("Астральный"), e: cid("Астральный") },
          { k: "sta", s: cid("Громадный"), e: cid("Громадный") },
          { k: "ac", s: cid("Класс Доспеха"), e: cid("Класс Доспеха") },
          { k: "hp", s: cid("Хиты"), e: cid("Хиты") },
          { k: "cr", s: cid("Опасность"), e: cid("Опасность") },
          { k: "pb", s: cid("Бонус мастерства"), e: cid("Бонус мастерства") },
        ],
        abilityLabels: [
          { a: "str", q: "Сил" },
          { a: "dex", q: "Лов" },
          { a: "con", q: "Тел" },
          { a: "int", q: "Инт" },
          { a: "wis", q: "Мдр" },
          { a: "cha", q: "Хар" },
        ],
      }),
  });

  assert.deepEqual(
    Object.entries(result.document.structuredHeader.abilities).map(([ability, fact]) => [ability, fact?.score ?? null]),
    [
      ["str", 28],
      ["dex", 7],
      ["con", 25],
      ["int", 5],
      ["wis", 14],
      ["cha", 18],
    ],
  );
  assert.deepEqual(
    result.document.structuredHeader.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["dex", 5],
      ["wis", 9],
    ],
  );
  assert.equal(result.document.structuredHeader.savingThrowEvidence?.evidence, "Спасброски Лов +5, Мдр +9");
  assert.ok(result.document.issues.some((issue) => issue.code === "model_guided_ability_region_proven"));
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("candidate-coordinate ability labels are resolved to exact printed labels without English semantic fallback", async () => {
  const source = [
    "Creature",
    "Medium fiend, neutral evil",
    "Armor Class 18",
    "Hit Points 100",
    "STR",
    "20 (+5)",
    "DEX",
    "14 (+2)",
    "CON",
    "18 (+4)",
    "INT",
    "12 (+1)",
    "WIS",
    "16 (+3)",
    "CHA",
    "10 (+0)",
    "Saving Throws DEX +6, WIS +7",
    "Actions",
    "Bite. Text.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = universalHeaderCandidates(source);
  const cid = (text: string): string => {
    const index = candidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing candidate ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "multiline",
    callModel: async () =>
      successfulModelResult({
        essentialFacts: [
          { k: "n", s: cid("Creature"), e: cid("Creature") },
          { k: "sta", s: cid("Medium fiend"), e: cid("Medium fiend") },
          { k: "ac", s: cid("Armor Class"), e: cid("Armor Class") },
          { k: "hp", s: cid("Hit Points"), e: cid("Hit Points") },
        ],
        abilityLabels: [
          { a: "str", q: cid("STR") },
          { a: "dex", q: cid("DEX") },
          { a: "con", q: cid("CON") },
          { a: "int", q: cid("INT") },
          { a: "wis", q: cid("WIS") },
          { a: "cha", q: cid("CHA") },
        ],
      }),
  });
  assert.equal(result.document.structuredHeader.abilities.str?.score, 20);
  assert.equal(result.document.structuredHeader.abilities.cha?.score, 10);
  assert.deepEqual(
    result.document.structuredHeader.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["dex", 6],
      ["wis", 7],
    ],
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("candidate-coordinate ability labels may point at the immediately following numeric cell without losing localized identity", async () => {
  const source = [
    "Колыбель Огненного Отпрыска",
    "Громадный элементаль, законно-злой",
    "Класс Доспеха 18",
    "Хиты 300",
    "Сил",
    "28 (+9)",
    "Лов",
    "14 (+2)",
    "Тел",
    "26 (+8)",
    "Инт",
    "18 (+4)",
    "Мдр",
    "20 (+5)",
    "Хар",
    "22 (+6)",
    "Спасброски Лов +8, Мдр +11",
    "Действия",
    "Удар. Текст.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = universalHeaderCandidates(source);
  const cid = (text: string): string => {
    const index = candidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing candidate ${text}`);
    return `C${String(index).padStart(3, "0")}`;
  };
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "multiline",
    callModel: async () =>
      successfulModelResult({
        essentialFacts: [
          { k: "n", s: cid("Колыбель"), e: cid("Колыбель") },
          { k: "sta", s: cid("Громадный"), e: cid("Громадный") },
          { k: "ac", s: cid("Класс Доспеха"), e: cid("Класс Доспеха") },
          { k: "hp", s: cid("Хиты"), e: cid("Хиты") },
        ],
        abilityLabels: [
          { a: "str", q: cid("28 (+9)") },
          { a: "dex", q: cid("14 (+2)") },
          { a: "con", q: cid("26 (+8)") },
          { a: "int", q: cid("18 (+4)") },
          { a: "wis", q: cid("20 (+5)") },
          { a: "cha", q: cid("22 (+6)") },
        ],
      }),
  });

  assert.deepEqual(
    Object.entries(result.document.structuredHeader.abilities).map(([ability, fact]) => [ability, fact?.score ?? null]),
    [
      ["str", 28],
      ["dex", 14],
      ["con", 26],
      ["int", 18],
      ["wis", 20],
      ["cha", 22],
    ],
  );
  assert.deepEqual(
    result.document.structuredHeader.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["dex", 8],
      ["wis", 11],
    ],
  );
  assert.ok(result.document.issues.some((issue) => issue.code === "model_guided_ability_region_proven"));
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("mixed pipeline adds ownership-aware compact-row evidence only after Header ownership is accepted", async () => {
  const source = [
    "Creature",
    "Damage Resistances psychic",
    "Condition Immunities charmed, frightened",
    "Languages —",
    "Challenge 13",
    "Feature. Text.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const verificationCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hid = (text: string): string => {
    const index = verificationCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, text);
    return `C${String(index).padStart(3, "0")}`;
  };
  const mid = (text: string): string => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, text);
    return `C${String(index).padStart(3, "0")}`;
  };
  let bodyPrompt = "";

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      if (isVerificationRequest(request)) {
        // The overlay does not exist yet in this Header request. Header ownership
        // must be accepted first from the ordinary whole-source lattice.
        assert.doesNotMatch(request.userPrompt, /header_interleaved_compact_row/u);
        return successfulModelResult({
          essentialFacts: [
            { k: "n", s: hid("Creature"), e: hid("Creature") },
            { k: "cr", s: hid("Challenge 13"), e: hid("Challenge 13") },
          ],
          abilityLabels: [],
        });
      }
      bodyPrompt = request.userPrompt;
      return successfulModelResult({
        starts: [
          { s: mid("Damage Resistances psychic") },
          { s: mid("Condition Immunities charmed, frightened") },
          { s: mid("Languages —") },
          { s: mid("Feature. Text.") },
        ],
      });
    },
  });

  assert.match(bodyPrompt, /Damage Resistances psychic[\s\S]*header_interleaved_compact_row/u);
  assert.match(bodyPrompt, /Condition Immunities charmed, frightened[\s\S]*header_interleaved_compact_row/u);
  assert.match(bodyPrompt, /Languages —[\s\S]*header_interleaved_compact_row/u);
  assert.doesNotMatch(bodyPrompt, /Feature\. Text\.[^\n]*header_interleaved_compact_row/u);
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("mixed hard geometry preserves one-word standalone section row when model omits it", async () => {
  const source = ["Creature", "Actions", "Multiattack. The creature makes two attacks."].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const verificationCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hid = (text: string): string => {
    const index = verificationCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, text);
    return `C${String(index).padStart(3, "0")}`;
  };
  const mid = (text: string): string => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, text);
    return `C${String(index).padStart(3, "0")}`;
  };
  let bodyPrompt = "";

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      if (isVerificationRequest(request)) {
        return successfulModelResult({
          essentialFacts: [{ k: "n", s: hid("Creature"), e: hid("Creature") }],
          abilityLabels: [],
        });
      }
      bodyPrompt = request.userPrompt;
      // Deliberately omit `Actions`; the contextual hard-geometry safeguard owns
      // only this already printed standalone line boundary.
      return successfulModelResult({ starts: [{ s: mid("Multiattack.") }] });
    },
  });

  assert.doesNotMatch(bodyPrompt, /contextual_standalone_heading_row/u);
  const heading = result.document.annotations.find((annotation) => annotation.role === "section_heading");
  assert.equal(heading?.text.trim(), "Actions");
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("mixed pipeline ignores model starts on comma-wrapped ownership-interleaved metadata continuations", async () => {
  const source = [
    "Creature",
    "Condition Immunities Blinded, Charmed,",
    "Exhaustion, Frightened,",
    "Poisoned",
    "Challenge 13",
    "Feature. Text.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const verificationCandidates = universalHeaderCandidates(source);
  const mixedCandidates = prepareCandidateLattice(source, sourceMap, "generic").candidates;
  const hid = (text: string): string => {
    const index = verificationCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, text);
    return `C${String(index).padStart(3, "0")}`;
  };
  const mid = (text: string): string => {
    const index = mixedCandidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, text);
    return `C${String(index).padStart(3, "0")}`;
  };
  let bodyPrompt = "";

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "generic",
    callModel: async (request) => {
      if (isVerificationRequest(request)) {
        return successfulModelResult({
          essentialFacts: [
            { k: "n", s: hid("Creature"), e: hid("Creature") },
            { k: "cr", s: hid("Challenge 13"), e: hid("Challenge 13") },
          ],
          abilityLabels: [],
        });
      }
      bodyPrompt = request.userPrompt;
      // Deliberately disagree with the deterministic separator evidence and ask
      // for starts on both visually wrapped metadata continuation lines.
      return successfulModelResult({
        starts: [
          { s: mid("Condition Immunities Blinded, Charmed,") },
          { s: mid("Exhaustion, Frightened,") },
          { s: mid("Poisoned") },
          { s: mid("Feature. Text.") },
        ],
      });
    },
  });

  // The model still sees the exact same candidate coordinates/evidence; this is
  // a post-parse deterministic veto, not a transport or prompt rewrite.
  assert.match(bodyPrompt, /Exhaustion, Frightened,/u);
  assert.match(bodyPrompt, /Poisoned/u);
  const continuationStarts = new Set([source.indexOf("Exhaustion, Frightened,"), source.indexOf("Poisoned")]);
  assert.equal(
    result.document.annotations.some((annotation) => continuationStarts.has(annotation.source.start)),
    false,
  );
  assert.ok(
    result.parserRouting.signals.some((signal) => signal.code === "mixed_body_metadata_separator_continuation_veto"),
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});
