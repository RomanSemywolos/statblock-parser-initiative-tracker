import assert from "node:assert/strict";
import test from "node:test";

import { prepareCandidateLattice, singlelineBodyNormalizationCandidates } from "./candidateLattice.js";
import { createLosslessSourceMap } from "./losslessSource.js";

test("candidate lattice preparation preserves base candidates and adds boundary evidence", () => {
  const source = [
    "Creature",
    "Armor Class 17",
    "Hit Points 45 (6d8 + 18)",
    "Actions",
    "Bite. Melee Weapon Attack.",
  ].join("\n");
  const prepared = prepareCandidateLattice(source, createLosslessSourceMap(source), "auto");

  assert.ok(prepared.baseCandidates.length > 0);
  assert.ok(prepared.candidates.length >= prepared.baseCandidates.length);
  assert.ok(prepared.candidates.every((candidate) => candidate.boundary !== undefined));
  assert.equal(prepared.routing.selectedMode, "multiline");
});

test("candidate lattice preparation honors explicit parser mode", () => {
  const source = "Creature Armor Class 17 Hit Points 45 Actions Bite. Text.";
  const prepared = prepareCandidateLattice(source, createLosslessSourceMap(source), "generic");

  assert.equal(prepared.routing.selectedMode, "generic");
  assert.equal(prepared.routing.requestedMode, "generic");
});

test("header lattice is independent of forced parser mode for the same source", () => {
  const source = [
    "Существо",
    "Большой монстр, нейтральный",
    "Класс Доспеха 18",
    "Хиты 100",
    "Скорость 30 фт.",
    "Действия",
    "Удар. Текст.",
  ].join("\n");
  const map = createLosslessSourceMap(source);
  const multiline = prepareCandidateLattice(source, map, "multiline");
  const generic = prepareCandidateLattice(source, map, "generic");

  assert.deepEqual(
    multiline.headerCandidates.map((candidate) => candidate.start),
    generic.headerCandidates.map((candidate) => candidate.start),
  );
});

test("singleline BODY lattice exposes only structural/mixed proposals and keeps source-shaped rule starts", () => {
  const source =
    "Demogorgon Huge Fiend (Demon), Chaotic Evil Armor Class 22 Hit Points 406 Speed 50 ft. STR 29 (+9) DEX 14 (+2) CON 26 (+8) INT 20 (+5) WIS 17 (+3) CHA 25 (+7) Traits Magic Resistance. Text. Actions Multiattack. Text.";
  const prepared = prepareCandidateLattice(source, createLosslessSourceMap(source), "singleline");
  const body = singlelineBodyNormalizationCandidates(prepared);
  const bodyStarts = new Set(body.map((candidate) => candidate.start));
  const auditByStart = new Map((prepared.singlelineAudit?.entries ?? []).map((entry) => [entry.start, entry] as const));

  assert.ok(body.length < prepared.candidates.length);
  for (const candidate of body) {
    const audit = auditByStart.get(candidate.start);
    assert.ok(audit);
    assert.ok(
      audit.role !== "address_only" || audit.origins.includes("composite_title_refinement"),
      `unexpected address-only BODY coordinate ${candidate.preview}`,
    );
  }
  for (const text of ["Traits", "Magic Resistance.", "Actions", "Multiattack."]) {
    const start = source.indexOf(text);
    assert.notEqual(start, -1);
    assert.equal(bodyStarts.has(start), true, `missing BODY coordinate for ${text}`);
  }
  // Address-only metadata coordinates are not shown to the BODY model even if
  // more than one address mechanism happened to reach them.
  assert.equal(bodyStarts.has(source.indexOf("50 ft.")), false);
});
