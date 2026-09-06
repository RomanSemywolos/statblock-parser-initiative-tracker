import { TRANSLATION_GLOSSARY, type TranslationGlossaryEntry } from "./translationGlossaryData.js";

export { TRANSLATION_GLOSSARY };
export type { TranslationGlossaryEntry };

export type GlossaryMatch = { entry: TranslationGlossaryEntry; start: number; end: number; source: string };

// Global prose replacement must be extremely conservative. Contextual labels, action names
// and trait names are translated by structured/document rules instead.
const SAFE_EXACT_LEVELS = new Set(["UI_EXACT"]);

function escapeRegex(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
function boundaryPattern(term: string): RegExp {
  const left = /^[\p{L}\p{N}]/u.test(term) ? "(?<![\\p{L}\\p{N}_])" : "";
  const right = /[\p{L}\p{N}]$/u.test(term) ? "(?![\\p{L}\\p{N}_])" : "";
  return new RegExp(`${left}${escapeRegex(term)}${right}`, "giu");
}

export function findGlossaryMatches(
  source: string,
  entries: readonly TranslationGlossaryEntry[] = TRANSLATION_GLOSSARY,
): GlossaryMatch[] {
  const candidates: GlossaryMatch[] = [];
  for (const entry of entries) {
    if (entry.processing !== "glossary exact") continue;
    for (const match of source.matchAll(boundaryPattern(entry.english))) {
      const start = match.index ?? 0;
      candidates.push({ entry, start, end: start + match[0].length, source: match[0] });
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const accepted: GlossaryMatch[] = [];
  for (const candidate of candidates) {
    if (accepted.some((match) => candidate.start < match.end && candidate.end > match.start)) continue;
    accepted.push(candidate);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

export function applyExactGlossary(
  source: string,
  options: { safeOnly?: boolean; entries?: readonly TranslationGlossaryEntry[] } = {},
): string {
  const safeOnly = options.safeOnly ?? true;
  const entries = (options.entries ?? TRANSLATION_GLOSSARY).filter(
    (entry) => !safeOnly || SAFE_EXACT_LEVELS.has(entry.level),
  );
  const matches = findGlossaryMatches(source, entries);
  let cursor = 0;
  let output = "";
  for (const match of matches) {
    output += source.slice(cursor, match.start) + match.entry.uk;
    cursor = match.end;
  }
  return output + source.slice(cursor);
}

export function glossaryEntry(english: string): TranslationGlossaryEntry | null {
  const normalized = english.trim().toLocaleLowerCase("en");
  return TRANSLATION_GLOSSARY.find((entry) => entry.english.toLocaleLowerCase("en") === normalized) ?? null;
}
