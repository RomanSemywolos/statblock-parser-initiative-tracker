import { surfaceCollapsedTitleLead } from "./titleBoundaryShape.js";
import { trustedNamedRuleLead } from "./surfaceStructure.js";

export function looksLikeStandaloneFeatureName(text: string): boolean {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length < 3 || normalized.length > 100) return false;

  const lead = surfaceCollapsedTitleLead(normalized, 100);
  if (lead === null || lead.length !== normalized.length) return false;
  const title = lead.slice(0, -1).trim();
  if (/\d+(?:\.\d+)?\s*\p{L}{1,6}$/u.test(title)) return false;

  const words = title.split(/\s+/u).filter(Boolean);
  if (words.length === 0 || words.length > 14) return false;

  const lexicalWords = words.filter((word) => /\p{L}/u.test(word));
  if (lexicalWords.length === 0) return false;

  const startsUppercase = lexicalWords.filter((word) => {
    const first = word.match(/\p{L}/u)?.[0];
    return first !== undefined && first === first.toLocaleUpperCase() && first !== first.toLocaleLowerCase();
  }).length;

  // Для багатослівної назви одного випадково великого першого слова недостатньо:
  // інакше звичайне речення на кшталт "First line." виглядало б як нова feature.
  // Однослівні назви ("Bite.", "Run!", "Why?") лишаються допустимими boundary-signals.
  const minimumUppercaseWords = lexicalWords.length === 1 ? 1 : Math.max(2, Math.ceil(lexicalWords.length / 2));

  return startsUppercase >= minimumUppercaseWords;
}

/**
 * Shape-only detector for a feature that begins at a trusted physical boundary.
 * Unlike `looksLikeStrongNamedFeature`, this does not require the whole line to
 * end in punctuation: copied statblocks frequently omit the final full stop on
 * otherwise complete action rows. Only the short surface title ending in `.`, `!` or `?`
 * is evaluated, so ordinary wrapped prose such as `The target ...` is rejected
 * by the same title-shape rules used for standalone feature names.
 */
export function looksLikeNamedFeatureLineStart(text: string): boolean {
  const normalized = text.replace(/\s+/gu, " ").trim();
  return trustedNamedRuleLead(normalized, 120) !== null;
}

export function looksLikeStrongNamedFeature(text: string): boolean {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length < 24) return false;

  const lead = surfaceCollapsedTitleLead(normalized, 100);
  if (lead === null || lead.length > 101) return false;

  const title = lead.slice(0, -1).trim();
  const body = normalized.slice(lead.length).trim();
  if (body.length < 16) return false;

  const titleWords = title.split(/\s+/u).filter(Boolean);
  if (titleWords.length === 0 || titleWords.length > 14) return false;

  // Простий labelled header на кшталт "Something 30 ft." не повинен ставати feature.
  if (/\b\d+(?:\.\d+)?\s*\p{L}{1,6}$/u.test(title)) return false;

  return /[\p{L}\p{N}]/u.test(body) && /[.!?]$/u.test(normalized);
}
