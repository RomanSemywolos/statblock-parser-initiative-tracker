export type DiceExpression = {
  count: number;
  sides: number;
  modifier: number;
};

export type DiceExpressionMatch = {
  start: number;
  end: number;
  source: string;
  expression: DiceExpression;
  normalized: string;
};

export type D20ModifierMatch = {
  start: number;
  end: number;
  source: string;
  modifier: number;
};

export type RechargeExpressionMatch = {
  start: number;
  end: number;
  source: string;
  minimum: number;
  maximum: number;
  expression: DiceExpression;
};

export type LimitedUseExpressionMatch = {
  start: number;
  end: number;
  source: string;
  maximum: number;
  period: string;
};

export type DiceRollResult = {
  expression: DiceExpression;
  normalized: string;
  rolls: number[];
  modifier: number;
  total: number;
};

export type RandomSource = () => number;

const FULL_DICE_EXPRESSION = /^\s*(?:(\d+)\s*)?[dDкК]\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/u;
const INLINE_DICE_EXPRESSION = /(?<![\p{L}\p{N}_])(?:\d+\s*)?[dDкК]\s*\d+(?:\s*[+-]\s*\d+)?(?![\p{L}\p{N}_])/gu;

export function parseDiceExpression(source: string): DiceExpression | null {
  const match = FULL_DICE_EXPRESSION.exec(source);
  if (match === null) return null;

  const count = match[1] === undefined ? 1 : Number(match[1]);
  const sides = Number(match[2]);
  const magnitude = match[4] === undefined ? 0 : Number(match[4]);
  const modifier = match[3] === "-" ? -magnitude : magnitude;

  if (!Number.isSafeInteger(count) || count <= 0 || count > 1000) return null;
  if (!Number.isSafeInteger(sides) || sides <= 1 || sides > 1_000_000) return null;
  if (!Number.isSafeInteger(modifier)) return null;

  return { count, sides, modifier };
}

export function formatDiceExpression(expression: DiceExpression): string {
  const base = `${expression.count}d${expression.sides}`;
  if (expression.modifier === 0) return base;
  return `${base}${expression.modifier > 0 ? "+" : ""}${expression.modifier}`;
}

export function normalizeDiceExpression(source: string): string | null {
  const parsed = parseDiceExpression(source);
  return parsed === null ? null : formatDiceExpression(parsed);
}

function isWordLike(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}_]/u.test(character);
}

export function findDiceExpressions(source: string): DiceExpressionMatch[] {
  const matches: DiceExpressionMatch[] = [];
  INLINE_DICE_EXPRESSION.lastIndex = 0;

  for (const match of source.matchAll(INLINE_DICE_EXPRESSION)) {
    const matched = match[0];
    const start = match.index ?? 0;
    const end = start + matched.length;
    const before = start > 0 ? source[start - 1] : undefined;
    const after = end < source.length ? source[end] : undefined;

    // Avoid treating a dice-looking substring inside an identifier as a roll.
    if (isWordLike(before) || isWordLike(after)) continue;

    const expression = parseDiceExpression(matched);
    if (expression === null) continue;

    matches.push({
      start,
      end,
      source: matched,
      expression,
      normalized: formatDiceExpression(expression),
    });
  }

  return matches;
}

export function findRechargeExpressions(
  source: string,
  labels: readonly string[] = ["Recharge"],
): RechargeExpressionMatch[] {
  const matches: RechargeExpressionMatch[] = [];
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const expression = new RegExp(`\\(${escaped}\\s+([1-6])\\s*[-–—]\\s*([1-6])\\)`, "giu");

    for (const match of source.matchAll(expression)) {
      const minimum = Number(match[1]);
      const maximum = Number(match[2]);
      if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum > maximum) continue;
      const start = match.index ?? 0;
      const sourceText = match[0];
      matches.push({
        start,
        end: start + sourceText.length,
        source: sourceText,
        minimum,
        maximum,
        expression: { count: 1, sides: 6, modifier: 0 },
      });
    }
  }
  return matches.sort((left, right) => left.start - right.start || left.end - right.end);
}

/** Finds parenthesized limited-use markers such as `(3/Day)` or `(1/день)`. */
export function findLimitedUseExpressions(source: string): LimitedUseExpressionMatch[] {
  const matches: LimitedUseExpressionMatch[] = [];
  const expression = /\((\d+)\s*\/\s*([\p{L}\p{M}]+)\)/gu;

  for (const match of source.matchAll(expression)) {
    const maximum = Number(match[1]);
    if (!Number.isSafeInteger(maximum) || maximum <= 0 || maximum > 10_000) continue;
    const sourceText = match[0];
    const start = match.index ?? 0;
    matches.push({
      start,
      end: start + sourceText.length,
      source: sourceText,
      maximum,
      period: match[2]!,
    });
  }

  return matches;
}

export function findD20Modifiers(source: string): D20ModifierMatch[] {
  const diceRanges = findDiceExpressions(source).map((match) => [match.start, match.end] as const);
  const matches: D20ModifierMatch[] = [];
  const expression = /(?<![\p{L}\p{N}_])([+\-−–—])\s*(\d+)(?!\d)/gu;

  for (const match of source.matchAll(expression)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (diceRanges.some(([diceStart, diceEnd]) => start < diceEnd && end > diceStart)) continue;

    const before = start > 0 ? source[start - 1] : undefined;
    // Do not interpret the second half of a numeric range such as 5–6 as a d20 modifier.
    if (before !== undefined && /\d/u.test(before)) continue;

    const magnitude = Number(match[2]);
    if (!Number.isSafeInteger(magnitude)) continue;
    const modifier = match[1] === "+" ? magnitude : -magnitude;
    matches.push({ start, end, source: match[0], modifier });
  }

  return matches;
}

export function rollDice(expression: DiceExpression, random: RandomSource = Math.random): DiceRollResult {
  const rolls: number[] = [];
  let sum = 0;

  for (let index = 0; index < expression.count; index += 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error("Random source must return a finite number in [0, 1).");
    }
    const roll = Math.floor(value * expression.sides) + 1;
    rolls.push(roll);
    sum += roll;
  }

  return {
    expression: { ...expression },
    normalized: formatDiceExpression(expression),
    rolls,
    modifier: expression.modifier,
    total: sum + expression.modifier,
  };
}

export function rollDiceText(source: string, random: RandomSource = Math.random): DiceRollResult | null {
  const expression = parseDiceExpression(source);
  return expression === null ? null : rollDice(expression, random);
}

export function d20WithModifier(modifier: number): DiceExpression {
  if (!Number.isSafeInteger(modifier)) throw new Error("Modifier must be a safe integer.");
  return { count: 1, sides: 20, modifier };
}
