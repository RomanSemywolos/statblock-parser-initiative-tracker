import type { LosslessSourceMap, SourceUnit } from "./domain.js";
import type { SourceCandidate } from "./candidateTypes.js";
import { sequentialInlineListMarkerStarts } from "./listSequence.js";
import { collapsedNamedRuleLeadAt } from "./surfaceStructure.js";
import { surfaceCollapsedTitleLead } from "./titleBoundaryShape.js";
import type { SinglelineStructuralReconstruction } from "./singlelineStructuralReconstruction.js";

export const SINGLELINE_CANDIDATE_AUDIT_ORIGINS = [
  "base_geometry",
  "compact_table_shape",
  "named_title_anchor",
  "collapsed_named_title_shape",
  "composite_title_refinement",
  "list_marker_internal",
  "dense_prefix_address",
  "punctuation_address",
  "title_lookback_address",
  "synthetic_top_level",
  "synthetic_internal",
  "other_address",
] as const;

export type SinglelineCandidateAuditOrigin = (typeof SINGLELINE_CANDIDATE_AUDIT_ORIGINS)[number];
export type SinglelineCandidateAuditRole = "structural" | "address_only" | "mixed";

export type SinglelineCandidateAuditEntry = {
  candidateIndex: number;
  candidateId: string;
  start: number;
  preview: string;
  role: SinglelineCandidateAuditRole;
  origins: SinglelineCandidateAuditOrigin[];
  reasons: SourceCandidate["reasons"];
  boundaryScope: SourceCandidate["boundary"] extends infer T ? (T extends { scope: infer S } ? S | null : null) : null;
  boundaryStrength: SourceCandidate["boundary"] extends infer T
    ? T extends { strength: infer S }
      ? S | null
      : null
    : null;
};

export type SinglelineCandidateAudit = {
  candidateCount: number;
  structuralCandidateCount: number;
  addressOnlyCandidateCount: number;
  mixedCandidateCount: number;
  byOrigin: Record<SinglelineCandidateAuditOrigin, number>;
  entries: SinglelineCandidateAuditEntry[];
};

const STRUCTURAL_ORIGINS = new Set<SinglelineCandidateAuditOrigin>([
  "base_geometry",
  "compact_table_shape",
  "named_title_anchor",
  "collapsed_named_title_shape",
  "list_marker_internal",
  "synthetic_top_level",
  "synthetic_internal",
]);

const ADDRESS_ORIGINS = new Set<SinglelineCandidateAuditOrigin>([
  "dense_prefix_address",
  "punctuation_address",
  "title_lookback_address",
  "composite_title_refinement",
  "other_address",
]);

function previousContentUnitAt(sourceMap: LosslessSourceMap, unitIndex: number): SourceUnit | null {
  for (let index = unitIndex - 1; index >= 0; index -= 1) {
    if (sourceMap.units[index].kind === "content") return sourceMap.units[index];
  }
  return null;
}

function endsWithSentenceBoundary(text: string): boolean {
  return /[.!?]["')\]}»”’]*$/u.test(text);
}

function sortedOrigins(origins: Set<SinglelineCandidateAuditOrigin>): SinglelineCandidateAuditOrigin[] {
  return SINGLELINE_CANDIDATE_AUDIT_ORIGINS.filter((origin) => origins.has(origin));
}

/**
 * Diagnostic-only provenance view for the current singleline lattice.
 *
 * This function does not create, remove, reorder, promote, or weaken candidates.
 * It only explains which already-existing singleline mechanisms can account for
 * each coordinate. Categories may overlap because the current implementation can
 * reach one coordinate through more than one mechanism.
 */
export function auditSinglelineCandidateLattice(
  rawSource: string,
  sourceMap: LosslessSourceMap,
  baseCandidates: readonly SourceCandidate[],
  candidates: readonly SourceCandidate[],
  reconstruction?: SinglelineStructuralReconstruction,
): SinglelineCandidateAudit {
  const contentUnits = sourceMap.units.filter((unit) => unit.kind === "content");
  const contentIndexByStart = new Map(contentUnits.map((unit, index) => [unit.start, index] as const));
  const sourceUnitIndexByStart = new Map<number, number>();
  for (let index = 0; index < sourceMap.units.length; index += 1) {
    const unit = sourceMap.units[index];
    if (unit.kind === "content") sourceUnitIndexByStart.set(unit.start, index);
  }

  const baseStarts = new Set(baseCandidates.map((candidate) => candidate.start));
  const densePrefixStarts = new Set(contentUnits.slice(1, 160).map((unit) => unit.start));
  const listMarkerStarts = sequentialInlineListMarkerStarts(rawSource);

  const punctuationStarts = new Set<number>();
  for (const unit of contentUnits) {
    const sourceUnitIndex = sourceUnitIndexByStart.get(unit.start);
    if (sourceUnitIndex === undefined) continue;
    const previous = previousContentUnitAt(sourceMap, sourceUnitIndex);
    if (previous !== null && endsWithSentenceBoundary(previous.text)) punctuationStarts.add(unit.start);
  }

  const collapsedNamedIntervals: Array<{ start: number; end: number }> = [];
  let activeCollapsedNamedEnd = -1;
  for (const candidate of candidates) {
    if (candidate.start < activeCollapsedNamedEnd) continue;
    const lead = collapsedNamedRuleLeadAt(rawSource, candidate.start);
    if (lead === null || /\d/u.test(lead)) continue;
    activeCollapsedNamedEnd = candidate.start + lead.length;
    collapsedNamedIntervals.push({ start: candidate.start, end: activeCollapsedNamedEnd });
  }
  const collapsedNamedStarts = new Set(collapsedNamedIntervals.map((interval) => interval.start));

  const compositeRefinementStarts = new Set<number>();
  for (const entry of reconstruction?.entries ?? []) {
    if (!entry.evidence.includes("composite_title_shape")) continue;
    const lead = surfaceCollapsedTitleLead(rawSource.slice(entry.start));
    if (lead === null) continue;
    const end = entry.start + lead.length;
    for (const candidate of candidates) {
      if (candidate.start > entry.start && candidate.start < end) compositeRefinementStarts.add(candidate.start);
    }
  }

  const namedStarts = candidates
    .filter((candidate) => candidate.reasons.includes("named_block_start"))
    .map((candidate) => candidate.start);
  const titleLookbackStarts = new Set<number>();
  for (const namedStart of namedStarts) {
    const namedIndex = contentIndexByStart.get(namedStart);
    if (namedIndex === undefined || namedIndex <= 0) continue;
    for (const unit of contentUnits.slice(Math.max(0, namedIndex - 6), namedIndex)) {
      titleLookbackStarts.add(unit.start);
    }
  }

  const byOrigin = Object.fromEntries(SINGLELINE_CANDIDATE_AUDIT_ORIGINS.map((origin) => [origin, 0])) as Record<
    SinglelineCandidateAuditOrigin,
    number
  >;

  const entries = candidates.map<SinglelineCandidateAuditEntry>((candidate, candidateIndex) => {
    const origins = new Set<SinglelineCandidateAuditOrigin>();
    if (baseStarts.has(candidate.start)) origins.add("base_geometry");
    if (candidate.reasons.includes("table_row_start") && !baseStarts.has(candidate.start)) {
      origins.add("compact_table_shape");
    }
    if (candidate.reasons.includes("named_block_start")) origins.add("named_title_anchor");
    // A collapsed BODY rule title may be missed by the historical candidate
    // reason path when it follows a standalone section label without terminal
    // punctuation (for example `Actions Multiattack. ...`). Promote only the
    // already-addressable coordinate whose own source slice has the existing
    // language-neutral collapsed named-title shape. Numeric leads remain
    // address-only because compact metadata such as `Speed 30 ft.` is otherwise
    // too easy to mistake for a rule title. This changes proposal confidence,
    // not source text, ownership, or semantics.
    if (candidate.reasons.includes("sentence_start") && collapsedNamedStarts.has(candidate.start)) {
      origins.add("collapsed_named_title_shape");
    }
    if (listMarkerStarts.has(candidate.start)) origins.add("list_marker_internal");
    if (densePrefixStarts.has(candidate.start) && candidate.reasons.includes("sentence_start")) {
      origins.add("dense_prefix_address");
    }
    if (punctuationStarts.has(candidate.start) && candidate.reasons.includes("sentence_start")) {
      origins.add("punctuation_address");
    }
    if (titleLookbackStarts.has(candidate.start) && candidate.reasons.includes("sentence_start")) {
      origins.add("title_lookback_address");
    }
    if (compositeRefinementStarts.has(candidate.start)) origins.add("composite_title_refinement");
    if (reconstruction?.topLevelStarts.has(candidate.start)) origins.add("synthetic_top_level");
    if (reconstruction?.internalStarts.has(candidate.start)) origins.add("synthetic_internal");

    if (origins.size === 0) origins.add("other_address");

    const hasStructural = [...origins].some((origin) => STRUCTURAL_ORIGINS.has(origin));
    const hasAddress = [...origins].some((origin) => ADDRESS_ORIGINS.has(origin));
    const role: SinglelineCandidateAuditRole =
      hasStructural && hasAddress ? "mixed" : hasStructural ? "structural" : "address_only";

    for (const origin of origins) byOrigin[origin] += 1;

    return {
      candidateIndex,
      candidateId: candidate.id,
      start: candidate.start,
      preview: candidate.preview,
      role,
      origins: sortedOrigins(origins),
      reasons: [...candidate.reasons],
      boundaryScope: candidate.boundary?.scope ?? null,
      boundaryStrength: candidate.boundary?.strength ?? null,
    };
  });

  return {
    candidateCount: entries.length,
    structuralCandidateCount: entries.filter((entry) => entry.role === "structural").length,
    addressOnlyCandidateCount: entries.filter((entry) => entry.role === "address_only").length,
    mixedCandidateCount: entries.filter((entry) => entry.role === "mixed").length,
    byOrigin,
    entries,
  };
}
