import assert from "node:assert/strict";
import test from "node:test";
import { applyExactGlossary, glossaryEntry } from "./translationGlossary.js";
import {
  protectTranslationMechanics,
  restoreTranslationMechanics,
  validateTranslationMechanics,
} from "./translationMechanics.js";
import { applyDndTranslationRules } from "./translationRules.js";
import { prepareEnglishForUkrainianTranslation } from "./translationPipeline.js";

test("glossary contains all 627 classified rows and uses Base Variant", async () => {
  const { TRANSLATION_GLOSSARY } = await import("./translationGlossary.js");
  assert.equal(TRANSLATION_GLOSSARY.length, 627);
  assert.equal(glossaryEntry("Stat Block")?.uk, "статблок");
});

test("mechanics protector uses opaque non-numeric tokens and restores exact mechanics", () => {
  const source = "DC 18 Dexterity saving throw, +7 to hit, Hit: 22 (4d10) fire damage.";
  const value = protectTranslationMechanics(source);
  assert.match(value.protectedText, /DC ⟦MECH_[A-Z]+⟧ Dexterity/u);
  assert.doesNotMatch(value.protectedText, /18|\+7|22|4d10/u);
  assert.equal(restoreTranslationMechanics(value.protectedText, value), source);
});

test("validator rejects changed dice, bonuses and DC values", () => {
  const result = validateTranslationMechanics(
    "DC 18; +7 to hit; 22 (4d10) damage",
    "СК 19; +8 до влучання; 22 (4d12) шкоди",
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.length >= 3);
});

test("safe glossary does not blindly inflect ordinary term lemmas", () => {
  assert.equal(applyExactGlossary("The creature has advantage."), "The creature has advantage.");
});

test("rule layer translates common statblock grammar around protected mechanics", () => {
  const protectedValue = protectTranslationMechanics(
    "Melee Weapon Attack: +7 to hit. Hit: 22 (4d10) fire damage. DC 18 Dexterity saving throw.",
  );
  const result = applyDndTranslationRules(protectedValue.protectedText);
  const restored = restoreTranslationMechanics(result.text, protectedValue);
  assert.match(restored, /Рукопашна атака зброєю:/u);
  assert.match(restored, /Влучання:/u);
  assert.match(restored, /ряткидок Спритності СК 18/u);
  assert.equal(validateTranslationMechanics(protectedValue.source, restored).ok, true);
});

test("M14.1-14.2 preparation leaves unresolved prose for future MT but preserves mechanics", () => {
  const result = prepareEnglishForUkrainianTranslation(
    "The target must succeed on a saving throw. On a failed save, it takes 10 (3d6) fire damage.",
  );
  assert.equal(result.validation.ok, true);
  assert.match(result.restoredText, /має успішно пройти ряткидок/u);
  assert.match(result.restoredText, /3d6/u);
});

test("frequency payload is protected while the Ukrainian frame is deterministic", () => {
  const result = prepareEnglishForUkrainianTranslation("Legendary Resistance (3/day).");
  assert.match(result.restoredText, /3\/день/u);
  assert.equal(result.validation.ok, true);
});

test("Recharge range keeps both values and translates only the frame", () => {
  const result = prepareEnglishForUkrainianTranslation("Breath Weapon (Recharge 5–6).");
  assert.match(result.restoredText, /Перезарядка 5–6/u);
  assert.equal(result.validation.ok, true);
});

test("partial deterministic translation does not replace context-sensitive one-word glossary atoms inside prose", () => {
  const result = prepareEnglishForUkrainianTranslation(
    "If this attack hits a creature in its lair, it can Grapple it near a wall using Telepathy.",
  );
  assert.match(result.restoredText, /attack hits/u);
  assert.match(result.restoredText, /lair/u);
  assert.match(result.restoredText, /Grapple/u);
  assert.match(result.restoredText, /wall/u);
  assert.match(result.restoredText, /Telepathy/u);
});

test("2024 save and attack labels plus distance frames translate parametrically", () => {
  const result = prepareEnglishForUkrainianTranslation(
    "Constitution Saving Throw: DC 14, one creature within 30 feet. Melee Attack Roll: +9, reach 15 ft. Failure: 10 (3d6) Psychic damage.",
  );
  assert.match(result.restoredText, /Ряткидок Статури: СК 14/u);
  assert.match(result.restoredText, /у межах 30 футів/u);
  assert.match(result.restoredText, /Кидок рукопашної атаки:/u);
  assert.match(result.restoredText, /досяжність 15 футів/u);
  assert.match(result.restoredText, /Провал:/u);
  assert.equal(result.validation.ok, true);
});

test("standard attack payload phrases and damage types translate without touching numbers", () => {
  const source =
    "Melee Weapon Attack: +16 to hit, reach 10 ft., one target. Hit: 17 (2d8 + 8) force damage plus 36 (8d8) fire damage. Grappled (escape DC 17).";
  const result = prepareEnglishForUkrainianTranslation(source);
  assert.match(result.restoredText, /\+16 до влучання/u);
  assert.match(result.restoredText, /досяжність 10 футів/u);
  assert.match(result.restoredText, /одна ціль/u);
  assert.match(result.restoredText, /17 \(2d8 \+ 8\) силової шкоди плюс 36 \(8d8\) шкоди вогнем/u);
  assert.match(result.restoredText, /СК 17 для втечі/u);
  assert.equal(result.validation.ok, true);
});

test("combined outcome label is translated before individual outcome labels", () => {
  const result = prepareEnglishForUkrainianTranslation("Failure or Success: the effect ends.");
  assert.match(result.restoredText, /^Провал або успіх:/u);
});

test("standard feet and area measurements translate around protected numbers", () => {
  const result = prepareEnglishForUkrainianTranslation(
    "A creature within 30 feet in a 60-foot-radius sphere is pushed 10 feet away from a 5-foot Emanation.",
  );
  assert.match(result.restoredText, /у межах 30 футів/u);
  assert.match(result.restoredText, /сфера радіусом 60 футів/u);
  assert.match(result.restoredText, /10 футів away/u);
  assert.match(result.restoredText, /5-футова еманація/u);
  assert.equal(result.validation.ok, true);
});

test("standard spellcasting notation and attack alternatives stay deterministic", () => {
  const cases = [
    ["Cantrips (at will): chill touch", "Заговори (без обмежень): chill touch"],
    ["1st level (4 slots): shield", "1 рівень (4 комірки): shield"],
    ["3/day each: disguise self", "3/день кожне: disguise self"],
    [
      "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 30/120 ft., one target.",
      "Рукопашна або далекобійна атака зброєю: +4 до влучання, досяжність 5 футів або дальність 30/120 футів, одна ціль.",
    ],
  ] as const;
  for (const [source, expected] of cases) {
    const result = prepareEnglishForUkrainianTranslation(source);
    assert.equal(result.restoredText, expected);
    assert.equal(result.validation.ok, true);
  }
});

test("standard area shapes translate as closed mechanical vocabulary", () => {
  const result = prepareEnglishForUkrainianTranslation(
    "a 30-foot cone, a 90-foot line, a 20-foot cube, a 60-foot-radius sphere, a 10-foot cylinder, and a 5-foot Emanation",
  );
  assert.match(result.restoredText, /30-футовий конус/u);
  assert.match(result.restoredText, /90-футова лінія/u);
  assert.match(result.restoredText, /20-футовий куб/u);
  assert.match(result.restoredText, /сфера радіусом 60 футів/u);
  assert.match(result.restoredText, /10-футовий циліндр/u);
  assert.match(result.restoredText, /5-футова еманація/u);
  assert.equal(result.validation.ok, true);
});

test("final deterministic cleanup avoids mixed half-damage prose and preserves full spell-attack phrase", () => {
  const outcome = prepareEnglishForUkrainianTranslation(
    "Success: Half damage. The creature otherwise takes only half damage from the effect.",
  );
  assert.match(outcome.restoredText, /^Успіх: Половина шкоди\./u);
  assert.match(outcome.restoredText, /takes only half damage/u);
  assert.doesNotMatch(outcome.restoredText, /takes only Половина шкоди/u);
  assert.equal(outcome.validation.ok, true);

  const spellAttack = prepareEnglishForUkrainianTranslation("+15 to hit with spell attacks");
  assert.equal(spellAttack.restoredText, "+15 для влучання атаками закляттями");
  assert.equal(spellAttack.validation.ok, true);
});

test("legendary action cost metadata translates after protected numbers are restored", () => {
  const cases = [
    ["Wing Attack (Costs 1 Action).", "Wing Attack (Коштує 1 дію)."],
    ["Wing Attack (Costs 2 Actions).", "Wing Attack (Коштує 2 дії)."],
    ["Vile Curse (Costs 5 Actions).", "Vile Curse (Коштує 5 дій)."],
  ] as const;
  for (const [source, expected] of cases) {
    const result = prepareEnglishForUkrainianTranslation(source);
    assert.equal(result.restoredText, expected);
    assert.equal(result.validation.ok, true);
  }
});
