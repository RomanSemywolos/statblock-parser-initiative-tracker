import test from "node:test";
import assert from "node:assert/strict";

import { createLosslessSourceMap } from "./losslessSource.js";
import { prepareCandidateLattice, singlelineBodyNormalizationCandidates } from "./candidateLattice.js";
import {
  ESSENTIAL_FACTS_SYSTEM_PROMPT,
  MIXED_OWNERSHIP_BODY_SYSTEM_PROMPT,
  SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT,
  SINGLELINE_OWNERSHIP_BODY_SYSTEM_PROMPT,
  createEssentialFactsUserPrompt,
  createMixedOwnershipBodyUserPrompt,
  createSinglelineEssentialFactsUserPrompt,
  createSinglelineOwnershipBodyUserPrompt,
} from "./prompt.js";

test("fixed Header verifier keeps source-grounded closed-contract semantics", () => {
  const source = [
    "Aspect of Tiamat",
    "Gargantuan Dragon (Chromatic), Chaotic Evil",
    "Armor Class 23",
    "Hit Points 574",
    "Speed 60 ft.",
    "Actions",
    "Bite. Text.",
  ].join("\n");
  const prepared = prepareCandidateLattice(source, createLosslessSourceMap(source), "multiline");
  const prompt = createEssentialFactsUserPrompt(source, prepared.headerCandidates, []);

  assert.match(ESSENTIAL_FACTS_SYSTEM_PROMPT, /FIXED-HEADER CARD-FACT VERIFICATION MODE/u);
  assert.match(ESSENTIAL_FACTS_SYSTEM_PROMPT, /closed fixed-header contract/i);
  assert.match(ESSENTIAL_FACTS_SYSTEM_PROMPT, /Do not return body segmentation/u);
  assert.match(prompt, /SOURCE EXCERPT START/u);
  assert.match(prompt, /STRUCTURAL PROPOSALS START/u);
  assert.match(prompt, /Aspect of Tiamat/u);
  assert.match(prompt, /Return only the card-critical grounded spans/u);
});

test("singleline Header verifier uses one inline coordinate overlay, scalar fact spans, and ability-label anchors", () => {
  const source =
    "Aspect of Tiamat Gargantuan Dragon (Chromatic), Chaotic Evil Armor Class 23 Hit Points 574 STR 30 (+10) DEX 14 (+2) CON 30 (+10) INT 21 (+5) WIS 20 (+5) CHA 26 (+8) Traits Rule. Text.";
  const prepared = prepareCandidateLattice(source, createLosslessSourceMap(source), "singleline");
  const prompt = createSinglelineEssentialFactsUserPrompt(source, prepared.headerCandidates);

  assert.match(SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT, /FIXED-HEADER COORDINATE MODE/u);
  assert.match(SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT, /COMPLETE compact printed field/u);
  assert.match(SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT, /"fields"/u);
  assert.match(SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT, /do NOT return an ability[\s\S]*region span/u);
  assert.match(SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT, /EXAMPLE 3 — 2024-style/u);
  assert.match(SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT, /whole printed alignment phrase/u);
  assert.doesNotMatch(SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT, /"ab"/u);
  assert.match(prompt, /ANNOTATED SOURCE START/u);
  assert.match(prompt, /C000=Aspect/u);
  assert.match(prompt, /C001=of/u);
  assert.doesNotMatch(prompt, /STRUCTURAL PROPOSALS|EXACT ADDRESS COORDINATES/u);
  assert.doesNotMatch(SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT, /exact source quote|verbatim anchor/i);
});

test("mixed normalization prompt is whole-BODY geometry-only with direct Cxxx starts", () => {
  const source = ["Creature", "Armor Class 18", "ACTIONS", "Bite. The creature attacks,", "and then moves."].join("\n");
  const prepared = prepareCandidateLattice(source, createLosslessSourceMap(source), "generic");
  const prompt = createMixedOwnershipBodyUserPrompt(source, prepared.candidates, [], []);

  assert.match(MIXED_OWNERSHIP_BODY_SYSTEM_PROMPT, /MIXED BODY TO MULTILINE NORMALIZATION MODE/u);
  assert.match(MIXED_OWNERSHIP_BODY_SYSTEM_PROMPT, /ONLY task is to restore the logical line starts/i);
  assert.match(MIXED_OWNERSHIP_BODY_SYSTEM_PROMPT, /no English statblock[\s\S]*vocabulary is required/u);
  assert.doesNotMatch(MIXED_OWNERSHIP_BODY_SYSTEM_PROMPT, /"k"\s*:/u);
  assert.doesNotMatch(prompt, /class=\d+/u);
  assert.match(prompt, /evidence=/u);
  assert.match(prompt, /continuationEvidence=/u);
  assert.match(MIXED_OWNERSHIP_BODY_SYSTEM_PROMPT, /\{"starts":\[\{"s":"Cxxx"\}/u);
});

test("singleline BODY prompt remains starts-only and uses the reduced BODY lattice", () => {
  const source =
    "Creature Large outsider Armor Class 17 Hit Points 45 STR 18 (+4) DEX 14 (+2) CON 16 (+3) INT 10 (+0) WIS 12 (+1) CHA 8 (-1) Traits First Rule. Text. Actions Multiattack. Text.";
  const prepared = prepareCandidateLattice(source, createLosslessSourceMap(source), "singleline");
  const bodyCandidates = singlelineBodyNormalizationCandidates(prepared);
  const roles = new Map(prepared.singlelineAudit?.entries.map((entry) => [entry.start, entry.role] as const) ?? []);
  const synthetic = new Map(
    prepared.singlelineStructure?.entries.map((entry) => [entry.start, entry.role] as const) ?? [],
  );
  const prompt = createSinglelineOwnershipBodyUserPrompt(source, bodyCandidates, [], [], roles, synthetic);

  assert.match(SINGLELINE_OWNERSHIP_BODY_SYSTEM_PROMPT, /SINGLELINE BODY TO MULTILINE NORMALIZATION MODE/u);
  assert.match(SINGLELINE_OWNERSHIP_BODY_SYSTEM_PROMPT, /starts/u);
  assert.doesNotMatch(SINGLELINE_OWNERSHIP_BODY_SYSTEM_PROMPT, /return .*section|return .*feature/i);
  assert.match(prompt, /C\d{3}/u);
  assert.match(prompt, /class=\d+/u);
  assert.match(prompt, /BODY STRUCTURAL CLASSES START/u);
  assert.match(SINGLELINE_OWNERSHIP_BODY_SYSTEM_PROMPT, /\{"starts":\[\{"s":N/u);
  assert.match(SINGLELINE_OWNERSHIP_BODY_SYSTEM_PROMPT, /integer suffix/u);
});
