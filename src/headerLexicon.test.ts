import test from "node:test";
import assert from "node:assert/strict";

import {
  ENGLISH_HEADER_ALIASES,
  findEnglishHeaderLabelStarts,
  matchEnglishHeaderLabelAtStart,
} from "./headerLexicon.js";

test("central English header lexicon preserves canonical and compact source aliases", () => {
  assert.deepEqual(ENGLISH_HEADER_ALIASES.armor_class, ["Armor Class", "AC"]);
  assert.deepEqual(ENGLISH_HEADER_ALIASES.saving_throws, ["Saving Throws", "Saves"]);
  assert.deepEqual(ENGLISH_HEADER_ALIASES.damage_resistances, ["Damage Resistances", "Resistances"]);
  assert.deepEqual(ENGLISH_HEADER_ALIASES.challenge, ["Challenge Rating", "Challenge", "CR"]);
});

test("longest printed alias wins at one lexical start", () => {
  const matches = findEnglishHeaderLabelStarts("Challenge Rating 10 (XP 5,900; PB +4)");
  assert.equal(matches[0]?.field, "challenge");
  assert.equal(matches[0]?.printedLabel, "Challenge Rating");
  assert.equal(matches.filter((match) => match.offset === 0).length, 1);
});

test("expected-field matching returns exact printed source spelling", () => {
  assert.equal(matchEnglishHeaderLabelAtStart("Resistances Cold", "damage_resistances")?.printedLabel, "Resistances");
  assert.equal(matchEnglishHeaderLabelAtStart("AC 17", "armor_class")?.printedLabel, "AC");
  assert.equal(matchEnglishHeaderLabelAtStart("AC 17", "hit_points"), null);
});

test("header scans do not begin inside another Unicode word", () => {
  assert.deepEqual(findEnglishHeaderLabelStarts("fooSpeed 30 ft."), []);
  assert.deepEqual(findEnglishHeaderLabelStarts("швидкоSpeed 30 ft."), []);
});
