import type { LosslessSourceMap } from "./domain.js";
import type { SourceCandidate } from "./candidateTypes.js";
import { sequentialInlineCompactLabelStarts } from "./compactLabelSequence.js";
import { sequentialInlineListMarkerStarts } from "./listSequence.js";
import { compactStandaloneHeadingShape } from "./surfaceStructure.js";
import { surfaceCollapsedTitleLead, surfaceCompactColonLabelLead } from "./titleBoundaryShape.js";

export type SinglelineSyntheticRole = "top_level" | "internal";

export const SINGLELINE_SYNTHETIC_EVIDENCE = [
  "document_geometry",
  "named_title_shape",
  "composite_title_shape",
  "leading_label_run_shape",
  "heading_before_compact_label",
  "introduced_list_sequence",
  "introduced_compact_label_sequence",
] as const;

export type SinglelineSyntheticEvidenceKind = (typeof SINGLELINE_SYNTHETIC_EVIDENCE)[number];

export type SinglelineSyntheticEntry = {
  start: number;
  candidateIndex: number;
  role: SinglelineSyntheticRole;
  evidence: SinglelineSyntheticEvidenceKind[];
};

export type SinglelineStructuralReconstruction = {
  entries: SinglelineSyntheticEntry[];
  topLevelStarts: Set<number>;
  internalStarts: Set<number>;
};

function addEvidence(
  map: Map<number, { role: SinglelineSyntheticRole; evidence: Set<SinglelineSyntheticEvidenceKind> }>,
  start: number,
  role: SinglelineSyntheticRole,
  evidence: SinglelineSyntheticEvidenceKind,
): void {
  const current = map.get(start);
  if (current === undefined) {
    map.set(start, { role, evidence: new Set([evidence]) });
    return;
  }
  if (role === "top_level") current.role = "top_level";
  current.evidence.add(evidence);
}

function compactCompositeTitleShape(rawSource: string, start: number): boolean {
  const tail = rawSource.slice(start);
  if (!/^\p{L}/u.test(tail)) return false;
  const lead = surfaceCollapsedTitleLead(tail);
  if (lead === null) return false;
  const outside = lead.replace(/\([^)]*\)/gu, " ").replace(/[.!?]$/u, " ");
  const words = outside.match(/[\p{L}\p{N}'’_-]+/gu) ?? [];
  if (words.length < 2 || words.length > 8) return false;
  if (/[,;:]/u.test(outside) || words.some((word) => /\d/u.test(word))) return false;
  const opens = (lead.match(/\(/gu) ?? []).length;
  const closes = (lead.match(/\)/gu) ?? []).length;
  if (opens !== closes) return false;

  let cased = 0;
  let titleCased = 0;
  let lowercase = 0;
  for (const word of words) {
    const first = word.match(/\p{L}/u)?.[0];
    if (first === undefined) continue;
    const lower = first.toLocaleLowerCase();
    const upper = first.toLocaleUpperCase();
    if (lower === upper) continue;
    cased += 1;
    if (first === upper) titleCased += 1;
    else lowercase += 1;
  }
  // Uncased scripts remain eligible. For cased scripts require compact label-like
  // capitalization while allowing a small number of lowercase connector words.
  return cased === 0 || (titleCased >= 1 && lowercase <= 2 && titleCased / cased >= 0.75);
}

function headingBeforeCompactLabelShape(rawSource: string, start: number): boolean {
  const rest = rawSource.slice(start);
  const colon = rest.indexOf(":");
  if (colon < 4 || colon > 96) return false;
  const beforeColon = rest.slice(0, colon);
  const whitespace = [...beforeColon.matchAll(/\s+/gu)].map((match) => match.index ?? -1).filter((index) => index > 0);
  for (const split of whitespace) {
    const heading = beforeColon.slice(0, split).trim();
    const headingWords = heading.match(/[\p{L}'’_-]+/gu) ?? [];
    if (headingWords.length < 2 || headingWords.length > 5) continue;
    if (!compactStandaloneHeadingShape(heading)) continue;
    const labelTail = rest.slice(split).trimStart();
    const label = surfaceCompactColonLabelLead(labelTail, 80, 6);
    if (label === null) continue;
    const labelWords = label.slice(0, -1).match(/[\p{L}'’_-]+/gu) ?? [];
    if (labelWords.length < 2) continue;
    return true;
  }
  return false;
}

function leadingLabelRunShape(rawSource: string, candidates: readonly SourceCandidate[], index: number): boolean {
  const start = candidates[index]?.start;
  if (start === undefined) return false;
  const words = rawSource.slice(start).match(/^(?:[ \t]*[\p{L}'’_-]+){2,4}[ \t]+[\p{L}'’_-]+/u)?.[0];
  if (words === undefined) return false;
  const tokens = words.trim().match(/[\p{L}'’_-]+/gu) ?? [];
  if (tokens.length < 3) return false;
  let upperRun = 0;
  for (const token of tokens) {
    const first = token.match(/\p{L}/u)?.[0];
    if (first === undefined) break;
    const lower = first.toLocaleLowerCase();
    const upper = first.toLocaleUpperCase();
    if (lower === upper || first === upper) upperRun += 1;
    else break;
  }
  if (upperRun < 2 || upperRun > 4 || upperRun >= tokens.length) return false;
  const nextFirst = tokens[upperRun]?.match(/\p{L}/u)?.[0];
  if (nextFirst === undefined) return false;
  const nextLower = nextFirst.toLocaleLowerCase();
  const nextUpper = nextFirst.toLocaleUpperCase();
  return nextLower !== nextUpper && nextFirst === nextLower;
}

/**
 * Recover sparse, language-neutral synthetic geometry for a physically collapsed
 * source. The full candidate lattice remains the exact address space. This stage
 * only marks plausible logical starts and source-proven internal hierarchies; it
 * never decides whether a compact lead is a section heading, feature, or metadata.
 */
export function reconstructSinglelineStructure(
  rawSource: string,
  sourceMap: LosslessSourceMap,
  candidates: readonly SourceCandidate[],
): SinglelineStructuralReconstruction {
  const indexByStart = new Map(candidates.map((candidate, index) => [candidate.start, index] as const));
  const contentUnits = sourceMap.units.filter((unit) => unit.kind === "content");
  const actualSentenceStarts = new Set<number>();
  for (let index = 0; index < contentUnits.length; index += 1) {
    if (index === 0 || /[.!?]["')\]}»”’]*$/u.test(contentUnits[index - 1]!.text))
      actualSentenceStarts.add(contentUnits[index]!.start);
  }
  const synthetic = new Map<
    number,
    { role: SinglelineSyntheticRole; evidence: Set<SinglelineSyntheticEvidenceKind> }
  >();

  const compositeIntervals: Array<{ start: number; end: number }> = [];
  let activeCompositeEnd = -1;
  for (const candidate of candidates) {
    if (candidate.start < activeCompositeEnd) continue;
    if (!compactCompositeTitleShape(rawSource, candidate.start)) continue;
    const lead = surfaceCollapsedTitleLead(rawSource.slice(candidate.start));
    if (lead === null) continue;
    activeCompositeEnd = candidate.start + lead.length;
    compositeIntervals.push({ start: candidate.start, end: activeCompositeEnd });
  }
  const insideCompositeTail = (start: number): boolean =>
    compositeIntervals.some((interval) => start > interval.start && start < interval.end);

  for (const candidate of candidates) {
    if (
      candidate.reasons.includes("document_start") ||
      candidate.reasons.includes("paragraph_start") ||
      candidate.reasons.includes("table_row_start")
    ) {
      addEvidence(synthetic, candidate.start, "top_level", "document_geometry");
    }
    if (candidate.reasons.includes("named_block_start") && !insideCompositeTail(candidate.start)) {
      addEvidence(synthetic, candidate.start, "top_level", "named_title_shape");
    }
  }
  for (const [index, candidate] of candidates.entries()) {
    if (insideCompositeTail(candidate.start)) continue;
    if (!actualSentenceStarts.has(candidate.start)) continue;
    if (leadingLabelRunShape(rawSource, candidates, index)) {
      addEvidence(synthetic, candidate.start, "top_level", "leading_label_run_shape");
    }
  }
  for (const interval of compositeIntervals) {
    addEvidence(synthetic, interval.start, "top_level", "composite_title_shape");
  }

  for (const candidate of candidates) {
    if (!actualSentenceStarts.has(candidate.start) || insideCompositeTail(candidate.start)) continue;
    if (headingBeforeCompactLabelShape(rawSource, candidate.start)) {
      addEvidence(synthetic, candidate.start, "top_level", "heading_before_compact_label");
    }
  }

  // A collapsed standalone heading can be printed immediately before a compact
  // labelled row, e.g. `Legendary Actions Legendary Action Uses: 3.`. Dense
  // singleline addressability gives us both coordinates already. Promote the
  // first coordinate only when the exact source between them independently has
  // standalone-heading shape and the following coordinate independently begins
  // with a compact `Label:` shape. This restores geometry without knowing any
  // heading or field vocabulary.
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    if (!actualSentenceStarts.has(candidate.start) || insideCompositeTail(candidate.start)) continue;
    for (let nextIndex = index + 1; nextIndex < candidates.length; nextIndex += 1) {
      const next = candidates[nextIndex]!;
      if (next.start - candidate.start > 80) break;
      const prefix = rawSource.slice(candidate.start, next.start).trim();
      if (!compactStandaloneHeadingShape(prefix)) continue;
      if (surfaceCompactColonLabelLead(rawSource.slice(next.start), 80, 8) === null) continue;
      addEvidence(synthetic, candidate.start, "top_level", "heading_before_compact_label");
      break;
    }
  }

  for (const start of sequentialInlineListMarkerStarts(rawSource)) {
    if (indexByStart.has(start)) addEvidence(synthetic, start, "internal", "introduced_list_sequence");
  }
  for (const start of sequentialInlineCompactLabelStarts(rawSource)) {
    if (indexByStart.has(start)) addEvidence(synthetic, start, "internal", "introduced_compact_label_sequence");
  }

  const entries = [...synthetic.entries()]
    .filter(([start]) => indexByStart.has(start))
    .sort(([a], [b]) => a - b)
    .map(([start, value]) => ({
      start,
      candidateIndex: indexByStart.get(start)!,
      role: value.role,
      evidence: SINGLELINE_SYNTHETIC_EVIDENCE.filter((kind) => value.evidence.has(kind)),
    }));

  return {
    entries,
    topLevelStarts: new Set(entries.filter((entry) => entry.role === "top_level").map((entry) => entry.start)),
    internalStarts: new Set(entries.filter((entry) => entry.role === "internal").map((entry) => entry.start)),
  };
}
