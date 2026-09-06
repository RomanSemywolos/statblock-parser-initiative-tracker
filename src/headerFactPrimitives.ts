import type {
  AbilityKey,
  CompiledAnnotation,
  HeaderFactSource,
  LosslessStatblockDocument,
  ParseIssue,
} from "./domain.js";

export type TextToken = { text: string; start: number; end: number };

export type AbilityLabel = {
  ability: AbilityKey;
  text: string;
  start: number;
  end: number;
  provenance: "canonical" | "model";
};

export type AbilityValue = {
  score: number;
  modifier: number;
  printedModifier: number | null;
  printedSave: number | null;
  start: number;
  end: number;
};

export const ABILITY_VALUE_PATTERN =
  /(?<!\d)(\d{1,3})(?!\d)(?:\s*(?:\(\s*([+\-−‒–—﹣－＋]\d{1,3})\s*\)|([+\-−‒–—﹣－＋]\d{1,3})))?(?:\s+([+\-−‒–—﹣－＋]\d{1,3}))?/gu;
export const CHALLENGE_VALUE_PATTERN = /(?<!\d)(\d+(?:\s*\/\s*\d+)?)(?!\d)/u;
export const PROFICIENCY_BONUS_VALUE_PATTERN = /([+\-−‒–—﹣－＋]\d{1,3})/u;

export function issue(
  code: string,
  severity: ParseIssue["severity"],
  message: string,
  details: Record<string, unknown> = {},
): ParseIssue {
  return { code, severity, message, candidateIndex: null, details };
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonusForChallenge(challengeRating: number): number | null {
  if (!Number.isFinite(challengeRating) || challengeRating < 0) return null;
  if (challengeRating <= 4) return 2;
  return 2 + Math.floor((challengeRating - 1) / 4);
}

export function normalizeSignedNumber(value: string): number {
  return Number(value.replace(/[−‒–—﹣－]/gu, "-").replace(/＋/gu, "+"));
}

export function parseChallengeRating(value: string): number | null {
  const [numeratorText, denominatorText] = value.replace(/\s+/gu, "").split("/");
  const numerator = Number(numeratorText);
  const denominator = denominatorText === undefined ? 1 : Number(denominatorText);
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0 ? numerator / denominator : null;
}

export function tokens(text: string): TextToken[] {
  return Array.from(text.matchAll(/[^\s]+/gu), (match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/*
 * Модельна цитата може відрізнятися лише пробілами. Факт отримує координати тільки
 * тоді, коли така послідовність непробільних токенів є у відповідному header block рівно один раз.
 */
export function locateQuote(annotation: CompiledAnnotation, quote: string): HeaderFactSource | null {
  const haystack = tokens(annotation.text);
  const needle = tokens(quote);

  if (needle.length === 0 || needle.length > haystack.length) return null;

  const matches: Array<{ start: number; end: number }> = [];

  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    const matchesAll = needle.every((token, offset) => token.text === haystack[index + offset].text);
    if (!matchesAll) continue;

    matches.push({ start: haystack[index].start, end: haystack[index + needle.length - 1].end });
  }

  if (matches.length !== 1) return null;

  const match = matches[0];
  return {
    annotationId: annotation.id,
    start: annotation.source.start + match.start,
    end: annotation.source.start + match.end,
    evidence: annotation.text.slice(match.start, match.end),
  };
}

export function countNumber(evidence: string, value: number, signed: boolean): number {
  const normalized = evidence.replace(/[−‒–—﹣－]/gu, "-").replace(/＋/gu, "+");
  const token = signed && value >= 0 ? `+${value}` : String(value);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return Array.from(normalized.matchAll(new RegExp(`(?<!\\d)${escaped}(?!\\d)`, "gu"))).length;
}

export function headerAnnotations(
  document: LosslessStatblockDocument,
  fields: readonly string[],
): CompiledAnnotation[] {
  return document.annotations.filter(
    (annotation) =>
      annotation.role === "header_field" && annotation.field !== null && fields.includes(annotation.field),
  );
}
