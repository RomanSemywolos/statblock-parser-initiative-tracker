import assert from "node:assert/strict";
import test from "node:test";

import { prepareCandidateLattice } from "./candidateLattice.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import { auditSinglelineCandidateLattice } from "./singlelineCandidateAudit.js";

function audit(source: string) {
  const sourceMap = createLosslessSourceMap(source);
  const prepared = prepareCandidateLattice(source, sourceMap, "singleline");
  return {
    prepared,
    result: auditSinglelineCandidateLattice(
      source,
      sourceMap,
      prepared.baseCandidates,
      prepared.candidates,
      prepared.singlelineStructure ?? undefined,
    ),
  };
}

test("singleline candidate audit is observational and preserves the prepared lattice", () => {
  const source =
    "Creature Large outsider Armor Class 17 Hit Points 45 Actions Bite. Melee attack. Tail. Another attack.";
  const sourceMap = createLosslessSourceMap(source);
  const prepared = prepareCandidateLattice(source, sourceMap, "singleline");
  const before = prepared.candidates.map((candidate) => ({
    id: candidate.id,
    start: candidate.start,
    preview: candidate.preview,
    reasons: [...candidate.reasons],
    boundary: candidate.boundary === undefined ? null : structuredClone(candidate.boundary),
  }));

  const result = auditSinglelineCandidateLattice(source, sourceMap, prepared.baseCandidates, prepared.candidates);

  assert.equal(result.candidateCount, prepared.candidates.length);
  assert.deepEqual(
    prepared.candidates.map((candidate) => ({
      id: candidate.id,
      start: candidate.start,
      preview: candidate.preview,
      reasons: [...candidate.reasons],
      boundary: candidate.boundary === undefined ? null : structuredClone(candidate.boundary),
    })),
    before,
  );
});

test("singleline candidate audit separates dense addressability from structural starts", () => {
  const source = [
    "Creature",
    "Large outsider",
    "Armor Class 17",
    "Hit Points 45",
    "STR 18 (+4) DEX 14 (+2) CON 16 (+3) INT 10 (+0) WIS 12 (+1) CHA 8 (-1)",
    "Traits",
    "First Rule. This is ordinary prose. Second Rule. More prose.",
  ].join(" ");
  const { prepared, result } = audit(source);

  assert.equal(prepared.routing.selectedMode, "singleline");
  assert.ok(result.addressOnlyCandidateCount > 0);
  assert.ok(result.structuralCandidateCount + result.mixedCandidateCount > 0);
  assert.ok(result.byOrigin.dense_prefix_address > 0);
  assert.ok(result.byOrigin.named_title_anchor > 0);

  const named = result.entries.filter((entry) => entry.origins.includes("named_title_anchor"));
  assert.ok(named.some((entry) => /Traits/u.test(entry.preview)));
  assert.ok(named.some((entry) => /Second/u.test(entry.preview)));
});

test("singleline candidate audit records confirmed numbered markers as internal structure", () => {
  const source = "Creature Feature. Choose one: 1. Alpha. Text. 2. Beta. Text. Next Rule. Text.";
  const { result } = audit(source);

  const listEntries = result.entries.filter((entry) => entry.origins.includes("list_marker_internal"));
  assert.equal(listEntries.length, 2);
  assert.ok(listEntries.every((entry) => entry.role === "mixed" || entry.role === "structural"));
});

test("singleline audit promotes compact collapsed rule titles but not numeric metadata", () => {
  const source =
    "Creature Armor Class 17 Speed 30 ft. Actions Multiattack. The creature attacks. Gouging Toss. The target falls.";
  const { result } = audit(source);

  const multiattack = result.entries.find((candidate) => candidate.start === source.indexOf("Multiattack."));
  assert.ok(multiattack);
  // `Actions Multiattack.` is a source-proven composite. The internal exact
  // coordinate stays address-only rather than being mislabeled structural.
  assert.ok(multiattack.origins.includes("composite_title_refinement"));

  const gouging = result.entries.find((candidate) => candidate.start === source.indexOf("Gouging Toss."));
  assert.ok(gouging);
  assert.ok(gouging.origins.includes("collapsed_named_title_shape"));
  assert.notEqual(gouging.role, "address_only");

  const speedStart = source.indexOf("Speed 30 ft.");
  const speed = result.entries.find((candidate) => candidate.start === speedStart);
  if (speed !== undefined) {
    assert.equal(speed.origins.includes("collapsed_named_title_shape"), false);
  }
});
