import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBodyPresentationText, normalizePresentationText } from "./normalizer.js";

test("body presentation preserves meaningful source line geometry while header normalization stays compact", () => {
  const source = "Innate Spellcasting.  The creature casts:\nAt will: alpha, beta\n1/day each: gamma, delta";
  assert.equal(
    normalizeBodyPresentationText(source),
    "Innate Spellcasting. The creature casts:\nAt will: alpha, beta\n1/day each: gamma, delta",
  );
  assert.equal(
    normalizePresentationText(source),
    "Innate Spellcasting. The creature casts: At will: alpha, beta 1/day each: gamma, delta",
  );
});

test("blank source rows are canonicalized away in product body presentation without flattening real rows", () => {
  const source = "Innate Spellcasting. The creature casts:\n\nAt will: alpha\n\n\n3/day each: beta\n1/day each: gamma";
  assert.equal(
    normalizeBodyPresentationText(source),
    "Innate Spellcasting. The creature casts:\nAt will: alpha\n3/day each: beta\n1/day each: gamma",
  );
});

test("body presentation folds visual column wraps while preserving explicit internal rows", () => {
  const source = `Nexus of the Great Web. Lolth knows the location,
identity, and current hit points of any creature in
contact with a spider's web, and cannot be Surprised.`;
  assert.equal(
    normalizeBodyPresentationText(source),
    "Nexus of the Great Web. Lolth knows the location, identity, and current hit points of any creature in contact with a spider's web, and cannot be Surprised.",
  );

  const structured = `Innate Spellcasting. The creature casts:
At will: alpha, beta
3/day each: gamma
1/day each: delta`;
  assert.equal(
    normalizeBodyPresentationText(structured),
    "Innate Spellcasting. The creature casts:\nAt will: alpha, beta\n3/day each: gamma\n1/day each: delta",
  );
});

test("body presentation does not mistake a wrapped numeric tail for a list item", () => {
  const source = `Spider's Embrace. On a failed save, the creature is grappled (escape DC
23) and Lolth makes an attack against it.`;
  assert.equal(
    normalizeBodyPresentationText(source),
    "Spider's Embrace. On a failed save, the creature is grappled (escape DC 23) and Lolth makes an attack against it.",
  );
});

test("body presentation preserves only confirmed numbered or lettered list sequences", () => {
  const numbered = `Gaze. Choose an effect:\n1) First effect.\n2) Second effect.\n3) Third effect.`;
  assert.equal(
    normalizeBodyPresentationText(numbered),
    `Gaze. Choose an effect:\n1) First effect.\n2) Second effect.\n3) Third effect.`,
  );

  const lettered = `Choose one:\nA) Alpha.\nB) Beta.`;
  assert.equal(normalizeBodyPresentationText(lettered), `Choose one:\nA) Alpha.\nB) Beta.`);
});

test("mixed body presentation preserves introduced ordered-list rows across wrapped PDF continuations", () => {
  const source = `Heartcleaver. Attack text. On a critical hit, choose one effect at random:
1. Curse of Brutality. The target must succeed on a
DC 22 Charisma saving throw or be cursed. While
cursed, it cannot cast high-level spells.
2. Crush Bones. The target must succeed on a DC 25
Constitution saving throw or suffer disadvantage until
it completes a long rest.
3. Cleave Limb. The target must succeed on a DC 25
Constitution saving throw or lose a limb.
4. Bisect. The target must succeed on a DC 25
Constitution saving throw or die.`;

  assert.equal(
    normalizeBodyPresentationText(source),
    `Heartcleaver. Attack text. On a critical hit, choose one effect at random:
1. Curse of Brutality. The target must succeed on a DC 22 Charisma saving throw or be cursed. While cursed, it cannot cast high-level spells.
2. Crush Bones. The target must succeed on a DC 25 Constitution saving throw or suffer disadvantage until it completes a long rest.
3. Cleave Limb. The target must succeed on a DC 25 Constitution saving throw or lose a limb.
4. Bisect. The target must succeed on a DC 25 Constitution saving throw or die.`,
  );
});

test("mixed body presentation does not preserve unrelated numbered rows without an introduced sequence", () => {
  const source = `Feature. Ordinary prose continues:
1. First-looking row.
wrapped continuation
3. Unrelated later row.`;
  assert.equal(
    normalizeBodyPresentationText(source),
    "Feature. Ordinary prose continues: 1. First-looking row. wrapped continuation 3. Unrelated later row.",
  );
});
test("body presentation exposes confirmed inline numbered lists without changing lone numeric prose", () => {
  const inline =
    "Gaze. Choose one: 1. Beguiling Gaze. First effect. 2. Hypnotic Gaze. Second effect. 3. Insanity Gaze. Third effect.";
  assert.equal(
    normalizeBodyPresentationText(inline),
    "Gaze. Choose one:\n1. Beguiling Gaze. First effect.\n2. Hypnotic Gaze. Second effect.\n3. Insanity Gaze. Third effect.",
  );

  const lone = "On a result of 1. the creature moves normally.";
  assert.equal(normalizeBodyPresentationText(lone), lone);
});

test("body presentation exposes a collapsed compact spell-row sequence without spell vocabulary", () => {
  const innate =
    "Innate Spellcasting. Demogorgon casts the following spells, requiring no material components: At will: detect magic, major image 3/day each: dispel magic, fear, telekinesis 1/day each: feeblemind, project image";
  assert.equal(
    normalizeBodyPresentationText(innate),
    "Innate Spellcasting. Demogorgon casts the following spells, requiring no material components:\nAt will: detect magic, major image\n3/day each: dispel magic, fear, telekinesis\n1/day each: feeblemind, project image",
  );

  const slots =
    "Spellcasting. The mage has the following spells prepared: Cantrips (at will): fire bolt, light, mage hand 1st level (4 slots): detect magic, magic missile, shield 2nd level (3 slots): misty step, suggestion 3rd level (3 slots): counterspell, fireball";
  assert.equal(
    normalizeBodyPresentationText(slots),
    "Spellcasting. The mage has the following spells prepared:\nCantrips (at will): fire bolt, light, mage hand\n1st level (4 slots): detect magic, magic missile, shield\n2nd level (3 slots): misty step, suggestion\n3rd level (3 slots): counterspell, fireball",
  );
});

test("collapsed compact-row proof does not split ordinary Attack and Hit labels", () => {
  const attack = "Bite. Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 12 (2d6 + 5) piercing damage.";
  assert.equal(normalizeBodyPresentationText(attack), attack);
});

test("body presentation folds a lowercase prose fragment that merely happens to contain a colon", () => {
  const source = `Multiattack. The dragon uses its Dread Visage. It then makes
three attacks: one with its Bite or Tail, and two with its Claw.`;
  assert.equal(
    normalizeBodyPresentationText(source),
    "Multiattack. The dragon uses its Dread Visage. It then makes three attacks: one with its Bite or Tail, and two with its Claw.",
  );
});

test("multiline body presentation preserves every non-empty physical row and removes blank rows", () => {
  const source = `Feature. First paragraph starts here
and continues on another physical row.

Second paragraph starts here
and continues again.`;
  const normalized = normalizeBodyPresentationText(source, { preservePhysicalLines: true });
  assert.equal(
    normalized,
    "Feature. First paragraph starts here\nand continues on another physical row.\nSecond paragraph starts here\nand continues again.",
  );
  assert.equal(normalized.includes("\n\n"), false);
});

test("multiline body presentation never invents a split inside one physical row", () => {
  const source = "Gaze. Choose one: 1. First effect. 2. Second effect. 3. Third effect.";
  assert.equal(normalizeBodyPresentationText(source, { preservePhysicalLines: true }), source);
});

test("ordinary body presentation still folds paragraph-separated prose when multiline evidence is not trusted", () => {
  const source = `Feature. First paragraph starts here
and continues.

Second paragraph starts here.`;
  assert.equal(
    normalizeBodyPresentationText(source),
    "Feature. First paragraph starts here and continues. Second paragraph starts here.",
  );
});

test("mixed body presentation folds a lone compact continuation label once ownership is already shared", () => {
  const source = `Bite. Melee Weapon Attack: +16 to hit, reach 15 ft., one target.
Hit: 28 (3d12 + 9) piercing damage and 21 (6d6) force damage.`;
  assert.equal(
    normalizeBodyPresentationText(source),
    "Bite. Melee Weapon Attack: +16 to hit, reach 15 ft., one target. Hit: 28 (3d12 + 9) piercing damage and 21 (6d6) force damage.",
  );
});

test("mixed body presentation still preserves repeated compact labelled rows", () => {
  const source = `Spellcasting. The creature uses the following options:
At will: alpha, beta
3/day each: gamma
1/day each: delta`;
  assert.equal(
    normalizeBodyPresentationText(source),
    `Spellcasting. The creature uses the following options:\nAt will: alpha, beta\n3/day each: gamma\n1/day each: delta`,
  );
});

test("introduced compact label sequence includes the first row after one physical newline", () => {
  const source = `Spellcasting. The dreamer has the following spells prepared and can cast them without the need for material components:
Cantrips (at will): control flames, firebolt, mage hand, message,
vicious mockery
1st level (4 slots): bane, disguise self, hex, sleep, thunderwave
2nd level (3 slots): alter self, blur, invisibility`;
  assert.equal(
    normalizeBodyPresentationText(source),
    `Spellcasting. The dreamer has the following spells prepared and can cast them without the need for material components:
Cantrips (at will): control flames, firebolt, mage hand, message, vicious mockery
1st level (4 slots): bane, disguise self, hex, sleep, thunderwave
2nd level (3 slots): alter self, blur, invisibility`,
  );
});
