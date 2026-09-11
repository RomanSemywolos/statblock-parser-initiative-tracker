import assert from "node:assert/strict";
import test from "node:test";
import {
  d20WithModifier,
  findDiceExpressions,
  findD20Modifiers,
  findLimitedUseExpressions,
  findRechargeExpressions,
  normalizeDiceExpression,
  parseDiceExpression,
  rollDice,
  rollDiceText,
} from "./dice.js";

test("parseDiceExpression accepts common latin forms", () => {
  assert.deepEqual(parseDiceExpression("d20"), { count: 1, sides: 20, modifier: 0 });
  assert.deepEqual(parseDiceExpression("1d20 + 3"), { count: 1, sides: 20, modifier: 3 });
  assert.deepEqual(parseDiceExpression("3d6-2"), { count: 3, sides: 6, modifier: -2 });
});

test("parseDiceExpression accepts Ukrainian keyboard к notation", () => {
  assert.deepEqual(parseDiceExpression("1к20+8"), { count: 1, sides: 20, modifier: 8 });
  assert.equal(normalizeDiceExpression(" 2К10 - 1 "), "2d10-1");
});

test("parseDiceExpression rejects invalid expressions", () => {
  assert.equal(parseDiceExpression("0d20"), null);
  assert.equal(parseDiceExpression("2d1"), null);
  assert.equal(parseDiceExpression("3d6 + foo"), null);
  assert.equal(parseDiceExpression("attack 3d6"), null);
});

test("findDiceExpressions finds multiple rolls without rewriting prose", () => {
  const source = "Hit: 22 (4d10) necrotic plus 18 (4d8 + 2) poison; then 1к20+8.";
  assert.deepEqual(
    findDiceExpressions(source).map((entry) => [entry.source, entry.normalized]),
    [
      ["4d10", "4d10"],
      ["4d8 + 2", "4d8+2"],
      ["1к20+8", "1d20+8"],
    ],
  );
});

test("findDiceExpressions ignores dice-looking text embedded in identifiers", () => {
  assert.deepEqual(
    findDiceExpressions("abc3d6xyz and d20").map((entry) => entry.normalized),
    ["1d20"],
  );
});

test("rollDice exposes individual dice and modifier", () => {
  const values = [0, 0.49, 0.999];
  let cursor = 0;
  const result = rollDice({ count: 3, sides: 6, modifier: 4 }, () => values[cursor++]!);
  assert.deepEqual(result.rolls, [1, 3, 6]);
  assert.equal(result.total, 14);
  assert.equal(result.normalized, "3d6+4");
});

test("rollDiceText returns null for invalid text", () => {
  assert.equal(rollDiceText("not dice"), null);
});

test("d20WithModifier produces canonical ability/save roll", () => {
  assert.deepEqual(d20WithModifier(-2), { count: 1, sides: 20, modifier: -2 });
});

test("findD20Modifiers finds signed bonuses but not dice modifiers or numeric ranges", () => {
  assert.deepEqual(findD20Modifiers("Melee Weapon Attack: +12 to hit. Damage 2d8 + 6. Recharge 5–6."), [
    { start: 21, end: 24, source: "+12", modifier: 12 },
  ]);
});

test("findD20Modifiers supports negative and spaced modifiers", () => {
  assert.deepEqual(
    findD20Modifiers("Penalty -2; save + 7.").map((match) => match.modifier),
    [-2, 7],
  );
});

test("findLimitedUseExpressions finds source-backed parenthesized counters", () => {
  assert.deepEqual(
    findLimitedUseExpressions("Legendary Resistance (3/Day). Щит (1/день). Not 2/Day.").map((match) => [
      match.source,
      match.maximum,
      match.period,
    ]),
    [
      ["(3/Day)", 3, "Day"],
      ["(1/день)", 1, "день"],
    ],
  );
});

test("findRechargeExpressions recognizes canonical recharge ranges as d6 rolls", () => {
  const matches = findRechargeExpressions("Breath Weapon (Recharge 4-6). Tail (Recharge 5–6).");
  assert.deepEqual(
    matches.map((match) => ({
      source: match.source,
      minimum: match.minimum,
      maximum: match.maximum,
      expression: match.expression,
    })),
    [
      { source: "(Recharge 4-6)", minimum: 4, maximum: 6, expression: { count: 1, sides: 6, modifier: 0 } },
      { source: "(Recharge 5–6)", minimum: 5, maximum: 6, expression: { count: 1, sides: 6, modifier: 0 } },
    ],
  );
});

test("findRechargeExpressions accepts configured translated labels", () => {
  const matches = findRechargeExpressions("(Перезарядка 5-6)", ["Перезарядка"]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.minimum, 5);
});

test("findRechargeExpressions recognizes Ukrainian recharge labels by default", () => {
  const matches = findRechargeExpressions("(Перезарядка 5–6)");
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.minimum, 5);
  assert.equal(matches[0]?.maximum, 6);
});
