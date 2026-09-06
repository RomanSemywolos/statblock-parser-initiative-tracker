import test from "node:test";
import assert from "node:assert/strict";

import { createLosslessSourceMap } from "./losslessSource.js";
import { prepareCandidateLattice } from "./candidateLattice.js";
import { analyzeStatblock } from "./pipeline.js";

const source = `Adult Black Dragon
Huge dragon, chaotic evil
Armor Class 19 (natural armor)
Hit Points 195 (17d12 + 85)
Speed 40 ft., fly 80 ft.
Saving Throws DEX +7, CON +10
Skills Perception +11
Senses blindsight 60 ft., passive Perception 21
Languages Common, Draconic
Challenge 14 (11,500 XP)
Amphibious. The dragon can breathe air and water.
Actions
Multiattack. The dragon makes three attacks.
Bite. Melee Weapon Attack: +11 to hit.
Legendary Actions
The dragon can take 3 legendary actions, choosing from the options below.
Detect. The dragon makes a Wisdom (Perception) check.`;

function id(index: number): string {
  return `C${String(index).padStart(3, "0")}`;
}

test("multiline pipeline uses one whole-source fixed-header locator and deterministic BODY", async () => {
  const sourceMap = createLosslessSourceMap(source);
  const candidates = prepareCandidateLattice(source, sourceMap, "generic").headerCandidates;
  const idFor = (text: string): string => {
    const index = candidates.findIndex((candidate) => candidate.start === source.indexOf(text));
    assert.notEqual(index, -1, `Missing candidate ${text}`);
    return id(index);
  };
  let calls = 0;

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap,
    model: "test-model",
    parserMode: "multiline",
    callModel: async (request) => {
      calls += 1;
      assert.match(request.systemPrompt, /FIXED-HEADER CARD-FACT VERIFICATION MODE/u);
      assert.match(request.userPrompt, /Amphibious\./u);
      const parsedContent = {
        essentialFacts: [
          { k: "n", s: idFor("Adult Black Dragon"), e: idFor("Adult Black Dragon") },
          { k: "sta", s: idFor("Huge dragon"), e: idFor("Huge dragon") },
          { k: "ac", s: idFor("Armor Class"), e: idFor("Armor Class") },
          { k: "hp", s: idFor("Hit Points"), e: idFor("Hit Points") },
          { k: "sv", s: idFor("Saving Throws"), e: idFor("Saving Throws") },
          { k: "cr", s: idFor("Challenge"), e: idFor("Challenge") },
        ],
      };
      return { rawContent: JSON.stringify(parsedContent), parsedContent, elapsedSeconds: 0.01 };
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.parserRouting.selectedMode, "multiline");
  assert.equal(result.bodyStructure?.status, "not_run");
  assert.ok(
    result.document.annotations.some(
      (annotation) =>
        annotation.role === "feature" &&
        source.slice(annotation.source.start, annotation.source.end).startsWith("Amphibious."),
    ),
  );
  const unknownHeadings = result.document.annotations.filter(
    (annotation) => annotation.role === "section_heading" && annotation.section === null,
  );
  assert.equal(unknownHeadings.length, 2);
  assert.ok(unknownHeadings.some((annotation) => annotation.text.trim() === "Actions"));
  assert.ok(unknownHeadings.some((annotation) => annotation.text.trim() === "Legendary Actions"));
  assert.equal(
    result.document.annotations.some(
      (annotation) => annotation.role === "section_heading" && annotation.section !== null,
    ),
    false,
  );
  assert.equal(result.document.model.requestCount, 1);
});
