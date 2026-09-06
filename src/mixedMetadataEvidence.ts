import type { CandidateBoundaryEvidence, SourceCandidate } from "./candidateTypes.js";
import type { SourceOwnershipMap } from "./sourceOwnership.js";
import { compactMetadataLineShape } from "./surfaceStructure.js";

function physicalLineBounds(rawSource: string, start: number): { start: number; end: number } {
  let lineStart = start;
  while (lineStart > 0 && !/[\r\n]/u.test(rawSource[lineStart - 1] ?? "")) lineStart -= 1;
  let lineEnd = start;
  while (lineEnd < rawSource.length && !/[\r\n]/u.test(rawSource[lineEnd] ?? "")) lineEnd += 1;
  return { start: lineStart, end: lineEnd };
}

function cloneBoundary(boundary: CandidateBoundaryEvidence | undefined): CandidateBoundaryEvidence {
  return boundary === undefined
    ? { scope: "unknown", strength: "weak", evidence: [], continuationStrength: "none", continuationEvidence: [] }
    : {
        scope: boundary.scope,
        strength: boundary.strength,
        evidence: [...boundary.evidence],
        continuationStrength: boundary.continuationStrength,
        continuationEvidence: [...boundary.continuationEvidence],
      };
}

function lineIntersectsOwnership(lineStart: number, lineEnd: number, ownership: SourceOwnershipMap): boolean {
  return ownership.ranges.some((range) => range.start < lineEnd && lineStart < range.end);
}

/**
 * True only for an unowned physical row that is interleaved between two already
 * accepted Header ownership islands. This is deliberately not a Header prefix,
 * BODY start, or semantic metadata range: it is a local relation between exact
 * accepted ownership ranges in the immutable source coordinate system.
 */
function lineIsBetweenHeaderOwnership(lineStart: number, lineEnd: number, ownership: SourceOwnershipMap): boolean {
  if (lineIntersectsOwnership(lineStart, lineEnd, ownership)) return false;
  let hasBefore = false;
  let hasAfter = false;
  for (const range of ownership.ranges) {
    if (range.end <= lineStart) hasBefore = true;
    if (lineEnd <= range.start) {
      hasAfter = true;
      break;
    }
  }
  return hasBefore && hasAfter;
}

function addEvidence(
  boundary: CandidateBoundaryEvidence,
  kind: "compact_metadata" | "header_interleaved_compact_row",
): void {
  if (!boundary.evidence.includes(kind)) boundary.evidence.push(kind);
}

function addContinuation(
  boundary: CandidateBoundaryEvidence,
  kind: "same_physical_interleaved_row",
  strength: "soft" | "strong",
): void {
  const rank = { none: 0, soft: 1, strong: 2 } as const;
  if (rank[strength] > rank[boundary.continuationStrength]) boundary.continuationStrength = strength;
  if (!boundary.continuationEvidence.includes(kind)) boundary.continuationEvidence.push(kind);
}

function compactInterleavedRowShape(text: string): boolean {
  const line = text.replace(/\s+/gu, " ").trim();
  if (line.length < 3 || line.length > 180) return false;
  if (/^[•*+-]/u.test(line) || !/\p{L}/u.test(line)) return false;

  // This is intentionally weaker than `compactMetadataLineShape`: once a row
  // is proven to sit in an unowned gap between accepted Header islands, a short
  // label-like physical row can be useful geometry evidence even when it has no
  // number or only one separator (for example a one-value resistance row).
  // Cased scripts still need an uppercase first letter so lowercase wrapped
  // prose cannot self-promote. Uncased scripts remain eligible.
  const firstCased = [...line].find((char) => /\p{Ll}|\p{Lu}|\p{Lt}/u.test(char));
  if (firstCased !== undefined && firstCased !== firstCased.toLocaleUpperCase()) return false;
  return true;
}

function previousPhysicalLine(rawSource: string, lineStart: number): { start: number; end: number } | null {
  let previousEnd = lineStart;
  while (previousEnd > 0 && /[\r\n]/u.test(rawSource[previousEnd - 1] ?? "")) previousEnd -= 1;
  if (previousEnd <= 0) return null;
  let previousStart = previousEnd;
  while (previousStart > 0 && !/[\r\n]/u.test(rawSource[previousStart - 1] ?? "")) previousStart -= 1;
  return { start: previousStart, end: previousEnd };
}

function previousRowLooksVisuallyOpen(line: string): boolean {
  const trimmed = line.trim();
  if (/[.!?]\s*[)\]}'”’"]*$/u.test(trimmed)) return false;

  // Internal safety veto only: a list-like row ending in one very short lexical
  // fragment can be a narrow-column wrap (`..., Piercing, and` / `..., рубящий от`).
  // This does not add model-facing evidence and does not select a start; it only
  // prevents the following uppercase fragment from being promoted to a new strong
  // row by the ownership overlay. Require multiple separators so ordinary values
  // such as `..., яд` do not qualify.
  const separators = (trimmed.match(/[,;]/gu) ?? []).length;
  if (separators < 2) return false;
  return /(?:^|[^\p{L}])([\p{L}]{1,4})\s*[)\]}'”’"]*$/u.test(trimmed);
}

/**
 * Add mixed-only, ownership-aware source-shape evidence for compact BODY rows
 * interleaved among accepted Header facts.
 *
 * The function never creates/removes candidate coordinates and never selects a
 * logical start. It only changes advisory boundary/continuation evidence passed
 * to the mixed BODY geometry model. This keeps the LLM authoritative for mixed
 * logical line restoration while avoiding the old global `first body-like row`
 * gate for metadata-shaped evidence.
 */
export function strengthenInterleavedMixedMetadataEvidence(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  ownership: SourceOwnershipMap,
): SourceCandidate[] {
  if (ownership.ranges.length < 2 || candidates.length === 0) return candidates.map((candidate) => ({ ...candidate }));

  const result = candidates.map((candidate) => ({
    ...candidate,
    reasons: [...candidate.reasons],
    boundary: cloneBoundary(candidate.boundary),
  }));

  const promotedPhysicalLines = new Map<number, { start: number; end: number }>();
  const eligibleCompactLines = new Map<number, { start: number; end: number }>();

  // First collect only physical rows whose coordinates are already proven to be
  // BODY-owned gaps between accepted Header ownership islands. This is local
  // geometry, not a guessed Header prefix or BODY start.
  for (const candidate of result) {
    if (!candidate.reasons.includes("line_start")) continue;
    const line = physicalLineBounds(rawSource, candidate.start);
    if (candidate.start !== line.start) continue;
    if (!lineIsBetweenHeaderOwnership(line.start, line.end, ownership)) continue;
    const text = rawSource.slice(line.start, line.end).trim();
    if (!compactInterleavedRowShape(text)) continue;
    eligibleCompactLines.set(line.start, line);
  }

  // Promote compact physical line starts in exact unowned gaps. Existing strong
  // continuation still wins, including the 2.74.198 trailing-separator/lowercase
  // evidence. `compact_metadata` is preserved only
  // when the old narrow shape test independently supports it; the new overlay's
  // own evidence remains vocabulary-free.
  for (const candidate of result) {
    if (!candidate.reasons.includes("line_start")) continue;
    const line = physicalLineBounds(rawSource, candidate.start);
    if (candidate.start !== line.start || !eligibleCompactLines.has(line.start)) continue;
    const previous = previousPhysicalLine(rawSource, line.start);
    if (previous !== null && eligibleCompactLines.has(previous.start)) {
      const previousText = rawSource.slice(previous.start, previous.end);
      if (previousRowLooksVisuallyOpen(previousText)) continue;
    }
    const boundary = candidate.boundary!;
    if (boundary.continuationStrength === "strong") continue;
    if (boundary.scope === "internal" && boundary.strength === "hard") continue;

    if (boundary.strength === "weak") {
      boundary.scope = "top_level";
      boundary.strength = "strong";
    }
    const text = rawSource.slice(line.start, line.end).trim();
    if (compactMetadataLineShape(text)) addEvidence(boundary, "compact_metadata");
    addEvidence(boundary, "header_interleaved_compact_row");
    promotedPhysicalLines.set(line.start, line);
  }

  if (promotedPhysicalLines.size === 0) return result;

  // A coordinate inside one promoted physical row is not automatically a peer
  // row merely because punctuation generated another candidate. Keep this SOFT:
  // mixed input can genuinely collapse multiple logical rows onto one physical
  // line, so the model remains free to split when surrounding context supports it.
  for (const candidate of result) {
    const line = physicalLineBounds(rawSource, candidate.start);
    const promoted = promotedPhysicalLines.get(line.start);
    if (promoted === undefined || candidate.start === promoted.start) continue;
    if (!lineIsBetweenHeaderOwnership(line.start, line.end, ownership)) continue;
    const boundary = candidate.boundary!;
    if (boundary.strength !== "weak") continue;
    addContinuation(boundary, "same_physical_interleaved_row", "soft");
  }

  return result;
}

/**
 * Return mixed candidate indexes that are source-proven visual continuations of
 * an ownership-interleaved compact row after a printed comma/semicolon.
 *
 * This is the narrow escalation of the 2.74.198 advisory separator rule: live
 * corpus runs showed that a weak model can still return a start on a row carrying
 * strong `previous_line_trailing_separator` evidence. We only make that evidence
 * authoritative when the continuation chain is rooted in an independently
 * ownership-proven interleaved row, and only for comma/semicolon endings. Colons
 * remain advisory because they can legitimately introduce a nested logical row.
 *
 * The function does not alter candidate evidence or model transport. Callers may
 * use the returned indexes only as a deterministic post-parse veto on logical
 * starts; source text and coordinates remain untouched.
 */
export function hardInterleavedMixedMetadataContinuationIndexes(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  ownership: SourceOwnershipMap,
): number[] {
  if (ownership.ranges.length < 2 || candidates.length === 0) return [];

  const physical: Array<{ index: number; start: number; end: number }> = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (candidate === undefined || !candidate.reasons.includes("line_start")) continue;
    const line = physicalLineBounds(rawSource, candidate.start);
    if (candidate.start !== line.start) continue;
    if (!lineIsBetweenHeaderOwnership(line.start, line.end, ownership)) continue;
    physical.push({ index, start: line.start, end: line.end });
  }

  const result: number[] = [];
  let chainRootedInInterleavedRow = false;
  let previousPhysical: { start: number; end: number } | null = null;

  for (const line of physical) {
    if (previousPhysical !== null) {
      const crossesAcceptedHeader = ownership.ranges.some(
        (range) => range.start < line.start && previousPhysical!.end < range.end,
      );
      if (crossesAcceptedHeader) chainRootedInInterleavedRow = false;
    }

    const candidate = candidates[line.index]!;
    const boundary = candidate.boundary;
    const independentlyInterleaved = boundary?.evidence.includes("header_interleaved_compact_row") ?? false;
    const previous = previousPhysicalLine(rawSource, line.start);
    const previousText = previous === null ? "" : rawSource.slice(previous.start, previous.end).trim();
    const previousEndsCommaOrSemicolon = /[,;]\s*[)\]}'”’"]*$/u.test(previousText);
    const separatorContinuation =
      boundary?.continuationStrength === "strong" &&
      boundary.continuationEvidence.includes("previous_line_trailing_separator") &&
      previousEndsCommaOrSemicolon;

    if (chainRootedInInterleavedRow && separatorContinuation) {
      result.push(line.index);
      // A wrapped row may span several consecutive printed lines. Keep the chain
      // rooted until a physical row is not itself a proven separator continuation.
      chainRootedInInterleavedRow = true;
    } else {
      chainRootedInInterleavedRow = independentlyInterleaved;
    }

    previousPhysical = { start: line.start, end: line.end };
  }

  return result;
}
