import { findDiceExpressions } from "./dice.js";

export type ProtectedMechanicKind = "dice" | "dc" | "signed_bonus" | "frequency" | "number";

export type ProtectedMechanic = {
  token: string;
  source: string;
  kind: ProtectedMechanicKind;
  start: number;
  end: number;
};

export type ProtectedTranslationText = {
  source: string;
  protectedText: string;
  mechanics: ProtectedMechanic[];
};

export type MechanicsValidationIssue = {
  kind: "missing" | "added" | "changed_order" | "unrestored_token";
  mechanic: ProtectedMechanicKind | "token";
  source?: string;
  target?: string;
  message: string;
};

export type MechanicsValidationResult = {
  ok: boolean;
  issues: MechanicsValidationIssue[];
};

type Range = { start: number; end: number; source: string; kind: ProtectedMechanicKind; priority: number };

const DC = /(?<![\p{L}\p{N}_])(?:DC|СК)\s*(\d+)(?!\d)/giu;
const FREQUENCY = /(?<![\p{L}\p{N}_])(\d+)\s*\/\s*(?:day|week|month|year|день|тиждень|місяць|рік)(?![\p{L}\p{N}_])/giu;
const SIGNED = /(?<![\p{L}\p{N}_\d])(?:[+\-−–—])\s*\d+(?!\d)/gu;
const NUMBER = /(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)?(?![\p{L}\p{N}_])/gu;
const ORDINAL = /(?<![\p{L}\p{N}_])(\d+)(?:st|nd|rd|th)(?![\p{L}\p{N}_])/giu;
const TOKEN = /⟦MECH_[A-Z]+⟧/gu;

function alphaId(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function regexRanges(source: string, expression: RegExp, kind: ProtectedMechanicKind, priority: number): Range[] {
  expression.lastIndex = 0;
  return [...source.matchAll(expression)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    source: match[0],
    kind,
    priority,
  }));
}

function dcRanges(source: string): Range[] {
  DC.lastIndex = 0;
  return [...source.matchAll(DC)].map((match) => {
    const wholeStart = match.index ?? 0;
    const digits = match[1];
    const relative = match[0].lastIndexOf(digits);
    return {
      start: wholeStart + relative,
      end: wholeStart + relative + digits.length,
      source: digits,
      kind: "dc" as const,
      priority: 90,
    };
  });
}

function ordinalRanges(source: string): Range[] {
  ORDINAL.lastIndex = 0;
  return [...source.matchAll(ORDINAL)].map((match) => {
    const wholeStart = match.index ?? 0;
    const digits = match[1];
    const relative = match[0].indexOf(digits);
    return {
      start: wholeStart + relative,
      end: wholeStart + relative + digits.length,
      source: digits,
      kind: "number" as const,
      priority: 85,
    };
  });
}

function frequencyRanges(source: string): Range[] {
  FREQUENCY.lastIndex = 0;
  return [...source.matchAll(FREQUENCY)].map((match) => {
    const wholeStart = match.index ?? 0;
    const digits = match[1];
    const relative = match[0].indexOf(digits);
    return {
      start: wholeStart + relative,
      end: wholeStart + relative + digits.length,
      source: digits,
      kind: "frequency" as const,
      priority: 80,
    };
  });
}

function collectRanges(source: string): Range[] {
  const ranges: Range[] = [
    ...findDiceExpressions(source).map((match) => ({
      start: match.start,
      end: match.end,
      source: match.source,
      kind: "dice" as const,
      priority: 100,
    })),
    ...dcRanges(source),
    ...frequencyRanges(source),
    ...ordinalRanges(source),
    ...regexRanges(source, SIGNED, "signed_bonus", 70),
    ...regexRanges(source, NUMBER, "number", 10),
  ].sort((a, b) => a.start - b.start || b.priority - a.priority || b.end - a.end);

  const accepted: Range[] = [];
  for (const candidate of ranges) {
    if (accepted.some((range) => candidate.start < range.end && candidate.end > range.start)) continue;
    accepted.push(candidate);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

export function protectTranslationMechanics(source: string): ProtectedTranslationText {
  const ranges = collectRanges(source);
  const mechanics: ProtectedMechanic[] = [];
  let cursor = 0;
  let protectedText = "";
  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    const token = `⟦MECH_${alphaId(index)}⟧`;
    protectedText += source.slice(cursor, range.start) + token;
    mechanics.push({ token, source: range.source, kind: range.kind, start: range.start, end: range.end });
    cursor = range.end;
  }
  protectedText += source.slice(cursor);
  return { source, protectedText, mechanics };
}

export function restoreTranslationMechanics(text: string, protectedValue: ProtectedTranslationText): string {
  let restored = text;
  for (const mechanic of protectedValue.mechanics) restored = restored.split(mechanic.token).join(mechanic.source);
  return restored;
}

function signature(source: string): Array<{ kind: ProtectedMechanicKind; source: string }> {
  return collectRanges(source).map(({ kind, source: value }) => ({
    kind,
    source: value.replace(/[−–—]/gu, "-").replace(/\s+/gu, ""),
  }));
}

export function validateTranslationMechanics(source: string, target: string): MechanicsValidationResult {
  const issues: MechanicsValidationIssue[] = [];
  if (TOKEN.test(target)) {
    issues.push({
      kind: "unrestored_token",
      mechanic: "token",
      message: "Protected mechanic token remains in translated text.",
    });
  }
  TOKEN.lastIndex = 0;
  const left = signature(source);
  const right = signature(target);
  const key = (item: { kind: ProtectedMechanicKind; source: string }) => `${item.kind}:${item.source}`;
  const counts = (items: typeof left) => {
    const map = new Map<string, number>();
    for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
    return map;
  };
  const lc = counts(left);
  const rc = counts(right);
  for (const [entry, count] of lc) {
    const delta = count - (rc.get(entry) ?? 0);
    for (let i = 0; i < delta; i += 1)
      issues.push({
        kind: "missing",
        mechanic: entry.split(":", 1)[0] as ProtectedMechanicKind,
        source: entry.slice(entry.indexOf(":") + 1),
        message: `Mechanic from source is missing after translation: ${entry}`,
      });
  }
  for (const [entry, count] of rc) {
    const delta = count - (lc.get(entry) ?? 0);
    for (let i = 0; i < delta; i += 1)
      issues.push({
        kind: "added",
        mechanic: entry.split(":", 1)[0] as ProtectedMechanicKind,
        target: entry.slice(entry.indexOf(":") + 1),
        message: `Translation introduced a mechanic not present in source: ${entry}`,
      });
  }
  if (issues.length === 0 && left.map(key).join("|") !== right.map(key).join("|")) {
    issues.push({
      kind: "changed_order",
      mechanic: "number",
      message: "Protected mechanics were preserved but their source order changed.",
    });
  }
  return { ok: issues.length === 0, issues };
}
