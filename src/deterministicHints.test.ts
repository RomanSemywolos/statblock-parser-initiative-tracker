import assert from "node:assert/strict";
import test from "node:test";

import { createDeterministicHints, structuralHints, verificationHints } from "./deterministicHints.js";
import type { SourceCandidate } from "./sourceCandidates.js";

function candidatesFromPieces(pieces: string[]): { raw: string; candidates: SourceCandidate[] } {
  let raw = "";
  const candidates: SourceCandidate[] = [];
  for (let index = 0; index < pieces.length; index += 1) {
    const start = raw.length;
    raw += pieces[index];
    candidates.push({
      id: `candidate-${index}`,
      start,
      startUnitId: `unit-${index}`,
      preview: pieces[index],
      reasons: index === 0 ? ["document_start"] : ["line_start"],
    });
  }
  return { raw, candidates };
}

test("deterministic structural hints do not require English identity vocabulary", () => {
  const { raw, candidates } = candidatesFromPieces([
    "Существо\n",
    "Громадный монстр (титан), без мировоззрения\n",
    "Класс Доспеха 20\n",
  ]);
  const hints = createDeterministicHints(raw, candidates);
  assert.equal(
    hints.some((hint) => hint.kind === "named_rule_continuation" || hint.kind === "labeled_continuation"),
    false,
  );
});

test("named rule followed by prose emits relationship evidence", () => {
  const { raw, candidates } = candidatesFromPieces([
    "Magic Resistance.\n",
    "The nabassu has advantage on saving throws against spells and other magical effects.\n",
  ]);
  const hints = createDeterministicHints(raw, candidates);
  assert.ok(
    hints.some(
      (hint) => hint.kind === "named_rule_continuation" && hint.candidates[0] === 0 && hint.candidates[1] === 1,
    ),
  );
});

test("compact labelled row after a named rule emits vocabulary-free continuation evidence", () => {
  const { raw, candidates } = candidatesFromPieces([
    "Grasping Claws. The creature makes an attack.\n",
    "Outcome: 6 points of damage.\n",
  ]);
  const hints = createDeterministicHints(raw, candidates);
  const hint = hints.find(
    (current) => current.kind === "labeled_continuation" && current.candidates[0] === 0 && current.candidates[1] === 1,
  );
  assert.ok(hint);
  assert.ok(hint.evidence.includes("compact_labeled_continuation_shape"));
});

test("compact labelled row across a paragraph break is not continuation evidence", () => {
  const { raw, candidates } = candidatesFromPieces([
    "Grasping Claws. The creature makes an attack.\n\n",
    "Outcome: 6 points of damage.\n",
  ]);
  candidates[1]!.reasons.push("paragraph_start");
  const hints = createDeterministicHints(raw, candidates);
  assert.equal(
    hints.some((current) => current.kind === "labeled_continuation"),
    false,
  );
});

test("verification does not receive language-specific structural identity hints", () => {
  const { raw, candidates } = candidatesFromPieces([
    "Сопротивление магии.\n",
    "Существо получает преимущество на спасброски.\n",
  ]);
  const hints = createDeterministicHints(raw, candidates);
  assert.deepEqual(verificationHints(hints), []);
  assert.equal(
    structuralHints(hints).some((hint) => (hint as { kind: string }).kind === "identity_shape"),
    false,
  );
});

test("mixed normalization adds ALL-CAPS standalone shape as advisory evidence only", async () => {
  const { createMixedNormalizationHints, mixedNormalizationHints } = await import("./deterministicHints.js");
  const { raw, candidates } = candidatesFromPieces(["ACTIONS\n", "Bite. The creature attacks.\n"]);
  const base = createDeterministicHints(raw, candidates);
  const mixed = createMixedNormalizationHints(raw, candidates);
  assert.equal(
    base.some((hint) => hint.kind === "all_caps_standalone"),
    false,
  );
  assert.ok(
    mixed.some(
      (hint) => hint.kind === "all_caps_standalone" && hint.candidates.length === 1 && hint.candidates[0] === 0,
    ),
  );
  assert.ok(mixedNormalizationHints(mixed).some((hint) => hint.kind === "all_caps_standalone"));
});

test("mixed normalization adds conservative title-case standalone heading evidence without promoting ordinary prose", async () => {
  const { createMixedNormalizationHints, mixedNormalizationHints } = await import("./deterministicHints.js");
  const { raw, candidates } = candidatesFromPieces([
    "Legendary Actions\n",
    "The creature moves\n",
    "Attack. The creature attacks.\n",
  ]);
  const mixed = createMixedNormalizationHints(raw, candidates);
  assert.ok(
    mixed.some(
      (hint) => hint.kind === "standalone_heading_row" && hint.candidates.length === 1 && hint.candidates[0] === 0,
    ),
  );
  assert.equal(
    mixed.some((hint) => hint.kind === "standalone_heading_row" && hint.candidates[0] === 1),
    false,
  );
  assert.ok(mixedNormalizationHints(mixed).some((hint) => hint.kind === "standalone_heading_row"));
});

test("mixed hard geometry recognizes one-word standalone heading before a peer rule without exposing it to the model", async () => {
  const { createMixedNormalizationHints, mixedNormalizationHints } = await import("./deterministicHints.js");
  const { raw, candidates } = candidatesFromPieces(["Actions\n", "Multiattack. The creature attacks.\n"]);
  candidates[0]!.reasons.push("standalone_block_start");
  candidates[1]!.reasons.push("named_block_start");
  const mixed = createMixedNormalizationHints(raw, candidates);
  const hard = mixed.find((hint) => hint.kind === "contextual_standalone_heading_row");
  assert.ok(hard);
  assert.deepEqual(hard.candidates, [0]);
  assert.equal(
    mixedNormalizationHints(mixed).some((hint) => hint.kind === "contextual_standalone_heading_row"),
    false,
  );
});

test("mixed hard geometry recognizes sentence-case standalone heading across explanatory rows", async () => {
  const { createMixedNormalizationHints } = await import("./deterministicHints.js");
  const { raw, candidates } = candidatesFromPieces([
    "Previous list item;\n",
    "Легендарные действия\n",
    "Существо может совершить 3 легендарных действия.\n",
    "Коготь. Существо атакует.\n",
  ]);
  candidates[1]!.reasons.push("standalone_block_start");
  candidates[1]!.boundary = {
    scope: "unknown",
    strength: "weak",
    evidence: ["physical_line"],
    continuationStrength: "strong",
    continuationEvidence: ["previous_line_trailing_separator"],
  };
  candidates[3]!.reasons.push("named_block_start");
  const mixed = createMixedNormalizationHints(raw, candidates);
  assert.ok(mixed.some((hint) => hint.kind === "contextual_standalone_heading_row" && hint.candidates[0] === 1));
});

test("mixed contextual standalone heading safeguard rejects wrapped metadata tails", async () => {
  const { createMixedNormalizationHints } = await import("./deterministicHints.js");
  const { raw, candidates } = candidatesFromPieces([
    "Damage Immunities Poison; Bludgeoning, Piercing, and\n",
    "Slashing from Nonmagical Attacks\n",
    "Condition Immunities Charmed, Frightened\n",
    "Feature. Text.\n",
  ]);
  candidates[1]!.reasons.push("standalone_block_start");
  candidates[2]!.boundary = {
    scope: "top_level",
    strength: "strong",
    evidence: ["physical_line", "compact_metadata", "header_interleaved_compact_row"],
    continuationStrength: "none",
    continuationEvidence: [],
  };
  candidates[3]!.reasons.push("named_block_start");
  const mixed = createMixedNormalizationHints(raw, candidates);
  assert.equal(
    mixed.some((hint) => hint.kind === "contextual_standalone_heading_row" && hint.candidates[0] === 1),
    false,
  );
});

test("mixed contextual standalone heading safeguard rejects adjacent wrapped title rows", async () => {
  const { createMixedNormalizationHints } = await import("./deterministicHints.js");
  const { raw, candidates } = candidatesFromPieces([
    "Actions\n",
    "Flying\n",
    "Sword.\n",
    "Melee or Ranged Attack Roll: +15.\n",
  ]);
  candidates[0]!.reasons.push("standalone_block_start");
  candidates[1]!.reasons.push("standalone_block_start");
  candidates[2]!.reasons.push("named_block_start");
  const mixed = createMixedNormalizationHints(raw, candidates);
  assert.ok(mixed.some((hint) => hint.kind === "contextual_standalone_heading_row" && hint.candidates[0] === 0));
  assert.equal(
    mixed.some((hint) => hint.kind === "contextual_standalone_heading_row" && hint.candidates[0] === 1),
    false,
  );
});
