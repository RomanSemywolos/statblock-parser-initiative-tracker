import { surfaceCollapsedTitleLead, surfaceTrustedTitleLead } from "./titleBoundaryShape.js";

function lexicalWords(text: string): string[] {
  return text.match(/[\p{L}\p{N}'’_-]+/gu) ?? [];
}

function firstCasedLetter(text: string): string | null {
  for (const character of text) {
    if (!/\p{L}/u.test(character)) continue;
    if (character.toLocaleLowerCase() === character.toLocaleUpperCase()) continue;
    return character;
  }
  return null;
}

/**
 * Surface-only compact metadata shape for the pre-body portion of a structured
 * document. It deliberately knows no field labels or language vocabulary.
 */
export function compactMetadataLineShape(text: string): boolean {
  const line = text.replace(/\s+/gu, " ").trim();
  if (line.length < 3 || line.length > 180) return false;
  if (/^[•*+-]/u.test(line) || /[.!?]\s*[)\]}'”’"]*$/u.test(line)) return false;
  if (!/\p{L}/u.test(line)) return false;

  const numeric = /[+\-−–—]?\d/u.exec(line);
  if (numeric?.index !== undefined && numeric.index <= 56) {
    const prefix = line.slice(0, numeric.index).trim();
    const words = prefix.match(/[\p{L}][\p{L}'’_-]*/gu) ?? [];
    if (words.length >= 1 && words.length <= 5 && prefix.length <= 52) return true;
  }

  if (/\([^\r\n]{1,48}\)/u.test(line) && /[,;]/u.test(line)) return true;
  const separators = (line.match(/[,;]/gu) ?? []).length;
  return separators >= 2;
}

/** Repeated vertical label + score + parenthesized modifier row. */
export function verticalScoreModifierCellShape(text: string): boolean {
  const line = text.replace(/\s+/gu, " ").trim();
  if (line.length < 4 || line.length > 48) return false;
  return /^(?:[\p{L}][\p{L}'’_-]*\s+){1,3}\d{1,3}\s*\(\s*[+\-−–—]?\d{1,3}\s*\)$/u.test(line);
}

/**
 * Compact standalone heading-like row. This is only geometry evidence; it does
 * not assign a section or other semantic role.
 */
export function compactStandaloneHeadingShape(text: string): boolean {
  const line = text.replace(/\s+/gu, " ").trim();
  if (line.length < 2 || line.length > 64) return false;
  if (/[.:;!?0-9]/u.test(line)) return false;
  const words = lexicalWords(line).filter((word) => /\p{L}/u.test(word));
  if (words.length < 1 || words.length > 6) return false;
  const first = firstCasedLetter(line);
  // Uncased scripts remain eligible. For cased scripts, a printed standalone
  // heading/name normally begins with an uppercase letter.
  return first === null || first === first.toLocaleUpperCase();
}

function trustedTitleLeadShape(lead: string): boolean {
  const title = lead
    .slice(0, -1)
    .replace(/\([^)]*\)/gu, " ")
    .trim();
  if (title.length === 0 || /[,;:]/u.test(title)) return false;
  const words = lexicalWords(title).filter((word) => /\p{L}/u.test(word));
  if (words.length < 1 || words.length > 8) return false;
  if (words.filter((word) => /\d/u.test(word)).length > 2) return false;

  const first = firstCasedLetter(title);
  if (first === null) return true;
  if (first !== first.toLocaleUpperCase()) return false;

  // A trusted physical line can legitimately use sentence-case feature names
  // in many languages. Keep this bounded: long prose-like leads need more than
  // a single initial capital, while compact 1-4 word titles do not.
  if (words.length <= 4) return true;
  let uppercaseWords = 0;
  for (const word of words) {
    const letter = firstCasedLetter(word);
    if (letter !== null && letter === letter.toLocaleUpperCase()) uppercaseWords += 1;
  }
  return uppercaseWords >= 2;
}

/**
 * Named-rule surface at a trusted physical line start. The return value is the
 * printed title lead only; callers decide whether it is ownership evidence.
 */
export function trustedNamedRuleLead(text: string, maxLength = 120): string | null {
  const line = text.replace(/\u00a0/gu, " ").trim();
  const lead = surfaceTrustedTitleLead(line, maxLength);
  if (lead === null || !trustedTitleLeadShape(lead)) return null;

  // Missing post-terminator whitespace is a useful recovery signal but also
  // makes an ordinary sentence such as `The creature attacks.It ...` look like
  // a title. Require stronger title-case shape only for this repaired boundary.
  // Normal physical `Title. Prose` rows remain sentence-case friendly for
  // localized names such as `Разорвать серебряную нить.`.
  const next = line[lead.length] ?? "";
  if (next !== "" && !/\s/u.test(next)) {
    const words = lexicalWords(lead.slice(0, -1).replace(/\([^)]*\)/gu, " ")).filter((word) => /\p{L}/u.test(word));
    let uppercaseWords = 0;
    for (const word of words) {
      const letter = firstCasedLetter(word);
      if (letter !== null && letter === letter.toLocaleUpperCase()) uppercaseWords += 1;
    }
    if (words.length > 1 && uppercaseWords < 2) return null;
  }
  return lead;
}

export function trustedNamedRuleLineShape(text: string): boolean {
  const line = text.replace(/\u00a0/gu, " ").trim();
  const lead = trustedNamedRuleLead(line);
  if (lead === null) return false;
  return line.slice(lead.length).trim().length > 0;
}

/**
 * Inline collapsed title evidence is intentionally stricter than a trusted
 * physical line. It has no language word list; lowercase-word density is used
 * only as a generic prose-risk signal.
 */
export function collapsedNamedRuleLeadAt(text: string, offset: number): string | null {
  const rest = text.slice(offset);
  const lead = surfaceCollapsedTitleLead(rest, 100);
  if (lead === null || !trustedTitleLeadShape(lead)) return null;
  const words = lexicalWords(lead).filter((word) => /\p{L}/u.test(word));
  let lowercaseWords = 0;
  for (const word of words) {
    const letter = firstCasedLetter(word);
    if (letter !== null && letter === letter.toLocaleLowerCase()) lowercaseWords += 1;
  }
  if (lowercaseWords > 2) return null;
  if (rest.slice(lead.length).trim().length === 0) return null;
  return lead;
}

/** A complete short printed rule title at a trusted coordinate, with no prose. */
export function standaloneNamedRuleTitleShape(text: string): boolean {
  const line = text
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const lead = trustedNamedRuleLead(line);
  return lead !== null && lead.length === line.length;
}
