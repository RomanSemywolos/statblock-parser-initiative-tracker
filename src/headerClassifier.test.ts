import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyDeterministicHeaderField,
  findDeterministicHeaderLabel,
  looksLikeNamedFeatureLineStart,
  looksLikeStrongNamedFeature,
} from "./headerClassifier.js";

test("deterministic header classifier confirms canonical labelled fields instead of trusting model order", () => {
  assert.equal(classifyDeterministicHeaderField("Armor Class 18 (Natural Armor)"), "armor_class");
  assert.equal(classifyDeterministicHeaderField("Hit Points 542 (35d12 + 315)"), "hit_points");
  assert.equal(classifyDeterministicHeaderField("Damage Resistances Cold, Fire, Lightning"), "damage_resistances");
  assert.equal(classifyDeterministicHeaderField("Damage Immunities Poison; Bludgeoning"), "damage_immunities");
  assert.equal(classifyDeterministicHeaderField("Challenge 27 (105,000 XP)"), "challenge");
});

test("deterministic header classifier recognizes a complete horizontal ability table structurally", () => {
  const text = "STR DEX CON INT WIS CHA\n25 (+7) 27 (+8) 29 (+9) 25 (+7) 17 (+3) 25 (+7)";
  assert.equal(classifyDeterministicHeaderField(text), "ability_scores");
});

test("deterministic header classifier does not manufacture semantics for named-rule prose", () => {
  assert.equal(
    classifyDeterministicHeaderField("Magic Resistance. The creature has advantage on saving throws."),
    null,
  );
  assert.equal(
    classifyDeterministicHeaderField("Nexus of the Great Web. The creature knows every creature touching a web."),
    null,
  );
});

test("strong named-feature evidence is conservative and requires title plus substantial prose", () => {
  assert.equal(looksLikeStrongNamedFeature("Magic Resistance. The creature has advantage on saving throws."), true);
  assert.equal(
    looksLikeStrongNamedFeature(
      "Legendary Resistances (5/Day). If the creature fails a saving throw, it can succeed instead.",
    ),
    true,
  );
  assert.equal(looksLikeStrongNamedFeature("Movement 30 ft."), false);
  assert.equal(looksLikeStrongNamedFeature("Unknown Header Value"), false);
});

test("deterministic header label returns the exact printed alias rather than a canonical display name", () => {
  assert.equal(findDeterministicHeaderLabel("Resistances Cold, Fire, Lightning", "damage_resistances"), "Resistances");
  assert.equal(
    findDeterministicHeaderLabel("Damage Resistances Cold, Fire, Lightning", "damage_resistances"),
    "Damage Resistances",
  );
  assert.equal(findDeterministicHeaderLabel("Immunities Poison; Charmed", "damage_immunities"), "Immunities");
  assert.equal(findDeterministicHeaderLabel("AC 17", "armor_class"), "AC");
  assert.equal(findDeterministicHeaderLabel("AC 17", "hit_points"), null);
});

test("named feature title terminators are structurally equivalent", () => {
  assert.equal(
    looksLikeStrongNamedFeature("Tally Ho! The fieldian emits a rallying cry that empowers its allies."),
    true,
  );
  assert.equal(
    looksLikeStrongNamedFeature("Who Goes There? The guardian calls out and studies the intruder carefully."),
    true,
  );
  assert.equal(looksLikeNamedFeatureLineStart("Tally Ho! The fieldian emits a cry."), true);
  assert.equal(looksLikeNamedFeatureLineStart("Who Goes There? The guardian calls out."), true);
});

test("trusted line-start feature shape tolerates one missing post-terminator space without rewriting text", () => {
  assert.equal(looksLikeNamedFeatureLineStart("Tentacle Attack or Fling.The creature attacks."), true);
  assert.equal(looksLikeNamedFeatureLineStart("The creature attacks.It then moves."), false);
});
