import type { LosslessSourceMap } from "./domain.js";
import type {
  CandidateBoundaryEvidence,
  BoundaryEvidenceKind,
  BoundaryScope,
  BoundaryStrength,
  SourceCandidate,
} from "./candidateTypes.js";
import { surfaceCollapsedTitleLead, surfaceCompactColonLabelLead } from "./titleBoundaryShape.js";
import { compactMetadataLineShape, verticalScoreModifierCellShape } from "./surfaceStructure.js";
import { introducedListSequenceStarts, sequentialInlineListMarkerStarts } from "./listSequence.js";

export type {
  CandidateBoundaryEvidence,
  BoundaryEvidenceKind,
  BoundaryScope,
  BoundaryStrength,
} from "./candidateTypes.js";

function candidatePiece(rawSource: string, candidates: readonly SourceCandidate[], index: number): string {
  const start = candidates[index]?.start;
  if (start === undefined) return "";
  return rawSource.slice(start, candidates[index + 1]?.start ?? rawSource.length).trim();
}

function titleShapeIsStrong(piece: string): boolean {
  const lead = surfaceCollapsedTitleLead(piece);
  if (lead === null) return false;
  const outside = lead.replace(/\([^)]*\)/gu, " ").replace(/\.$/u, " ");
  const lexical = outside.match(/[\p{L}\p{N}'’_-]+/gu)?.filter((word) => /\p{L}/u.test(word)) ?? [];
  if (lexical.length === 0 || lexical.length > 8) return false;

  // A one-word title is valuable in collapsed input, but a parenthetical prose
  // fragment such as `Charisma (...).` is intentionally not promoted merely
  // because it starts with a capital letter.
  if (lexical.length === 1 && /\(/u.test(lead)) return false;
  return true;
}

function mergeEvidence(
  evidence: CandidateBoundaryEvidence,
  scope: BoundaryScope,
  strength: BoundaryStrength,
  kind: BoundaryEvidenceKind,
): void {
  const rank: Record<BoundaryStrength, number> = { weak: 0, strong: 1, hard: 2 };
  if (rank[strength] > rank[evidence.strength]) evidence.strength = strength;
  if (scope === "internal") evidence.scope = "internal";
  else if (scope === "top_level" && evidence.scope === "unknown") evidence.scope = "top_level";
  if (!evidence.evidence.includes(kind)) evidence.evidence.push(kind);
}

function previousPhysicalLine(rawSource: string, start: number): string | null {
  if (start <= 0) return null;
  let cursor = start - 1;
  while (cursor >= 0 && /[\r\n]/u.test(rawSource[cursor] ?? "")) cursor -= 1;
  if (cursor < 0) return null;
  let lineStart = cursor;
  while (lineStart > 0 && !/[\r\n]/u.test(rawSource[lineStart - 1] ?? "")) lineStart -= 1;
  const line = rawSource.slice(lineStart, cursor + 1).trim();
  return line.length === 0 ? null : line;
}

function currentPhysicalLine(rawSource: string, start: number): string {
  let end = start;
  while (end < rawSource.length && !/[\r\n]/u.test(rawSource[end] ?? "")) end += 1;
  return rawSource.slice(start, end).trim();
}

function addContinuationEvidence(
  boundary: CandidateBoundaryEvidence,
  kind: CandidateBoundaryEvidence["continuationEvidence"][number],
  strength: "soft" | "strong",
): void {
  const rank = { none: 0, soft: 1, strong: 2 } as const;
  if (rank[strength] > rank[boundary.continuationStrength]) boundary.continuationStrength = strength;
  if (!boundary.continuationEvidence.includes(kind)) boundary.continuationEvidence.push(kind);
}

function verticalAbilitySequenceIndexes(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  scanEndCandidate: number,
): Set<number> {
  const result = new Set<number>();
  for (let start = 0; start + 5 < Math.min(scanEndCandidate, candidates.length); start += 1) {
    let ok = true;
    for (let offset = 0; offset < 6; offset += 1) {
      if (!verticalScoreModifierCellShape(candidatePiece(rawSource, candidates, start + offset))) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    for (let offset = 0; offset < 6; offset += 1) result.add(start + offset);
    start += 5;
  }
  return result;
}

/**
 * Adds a structural evidence layer without changing candidate coordinates.
 * Evidence describes why a boundary is plausible and whether visible geometry
 * makes it top-level or internal; it does not assign statblock semantics.
 */
export function attachBoundaryEvidence(
  rawSource: string,
  _sourceMap: LosslessSourceMap,
  candidates: readonly SourceCandidate[],
  mode: "multiline" | "singleline" | "generic",
): SourceCandidate[] {
  const listStarts =
    mode === "singleline" ? sequentialInlineListMarkerStarts(rawSource) : introducedListSequenceStarts(rawSource);

  const firstBodyLikeIndex =
    mode === "generic" || mode === "multiline"
      ? candidates.findIndex((candidate) => candidate.reasons.includes("named_block_start"))
      : -1;
  const preBodyEnd = firstBodyLikeIndex >= 0 ? firstBodyLikeIndex : candidates.length;
  const verticalAbilityRows =
    mode === "generic" || mode === "multiline"
      ? verticalAbilitySequenceIndexes(rawSource, candidates, preBodyEnd)
      : new Set<number>();

  return candidates.map((candidate, index) => {
    const boundary: CandidateBoundaryEvidence = {
      scope: "unknown",
      strength: "weak",
      evidence: [],
      continuationStrength: "none",
      continuationEvidence: [],
    };
    const piece = candidatePiece(rawSource, candidates, index);

    if (candidate.reasons.includes("document_start")) mergeEvidence(boundary, "top_level", "hard", "document_start");
    if (candidate.reasons.includes("paragraph_start")) {
      // A blank line is strong source geometry, but mixed PDF/web text can use
      // paragraph spacing inside one logical rule. Only trusted multiline mode
      // treats physical paragraph geometry as hard ownership evidence.
      mergeEvidence(boundary, "top_level", mode === "multiline" ? "hard" : "strong", "paragraph");
    }
    if (candidate.reasons.includes("line_start")) {
      // Physical line geometry is an immutable logical-unit coordinate in clean
      // multiline mode. In generic/mixed input the same line start remains only
      // weak addressability because one logical structure may be visually wrapped.
      // Semantic section ownership is never inferred from the line start itself.
      mergeEvidence(boundary, "unknown", "weak", "physical_line");
    }
    if (candidate.reasons.includes("table_row_start")) mergeEvidence(boundary, "top_level", "hard", "table_shape");

    if (candidate.reasons.includes("standalone_block_start") && mode === "singleline") {
      // In collapsed single-line input a compact standalone coordinate is useful
      // positive shape. In mixed input the same surface form is common in soft
      // wraps (including a lone capitalized word), so it remains coordinate-only.
      mergeEvidence(boundary, "top_level", "strong", "compact_block");
    }

    if (candidate.reasons.includes("named_block_start") && titleShapeIsStrong(rawSource.slice(candidate.start))) {
      // Candidate density must never weaken a source-proposed named-rule start.
      // Dense multilingual token coordinates may occur inside the printed title,
      // so inspect the raw source from this offset rather than truncating at the
      // next candidate coordinate.
      mergeEvidence(boundary, "top_level", "strong", "title_shape");
    }
    if (candidate.reasons.includes("sentence_start")) {
      mergeEvidence(boundary, "unknown", "weak", "sentence_shape");
    }

    // Trailing separators are source-visible continuation evidence and must be
    // attached before compact-metadata promotion. Otherwise a wrapped list row
    // such as `Skills ... Perception +17,` / `Stealth +19, Survival +11` can
    // incorrectly promote its continuation to an independent strong metadata
    // boundary merely because that continuation still looks compact.
    if (
      (mode === "generic" || mode === "multiline") &&
      candidate.reasons.includes("line_start") &&
      !candidate.reasons.includes("paragraph_start")
    ) {
      const previousLine = previousPhysicalLine(rawSource, candidate.start);
      if (previousLine !== null && /[,;:]\s*[)\]}'”’"]*$/u.test(previousLine)) {
        addContinuationEvidence(boundary, "previous_line_trailing_separator", "strong");
      }
    }

    if ((mode === "generic" || mode === "multiline") && index < preBodyEnd) {
      if (verticalAbilityRows.has(index)) {
        if (verticalAbilityRows.has(index - 1)) {
          mergeEvidence(boundary, "internal", "hard", "table_shape");
        } else {
          mergeEvidence(boundary, "top_level", "hard", "table_shape");
        }
      } else if (
        boundary.strength === "weak" &&
        boundary.continuationStrength !== "strong" &&
        compactMetadataLineShape(
          candidate.reasons.includes("line_start") ? currentPhysicalLine(rawSource, candidate.start) : piece,
        )
      ) {
        mergeEvidence(boundary, "top_level", "strong", "compact_metadata");
      }
    }

    if (
      (mode === "generic" || mode === "multiline") &&
      boundary.strength === "weak" &&
      candidate.reasons.includes("line_start") &&
      !candidate.reasons.includes("paragraph_start")
    ) {
      const previousLine = previousPhysicalLine(rawSource, candidate.start);
      const currentLine = currentPhysicalLine(rawSource, candidate.start);
      if (previousLine !== null) {
        if (!/[,;:]\s*[)\]}'”’"]*$/u.test(previousLine) && !/[.!?]\s*[)\]}'”’"]*$/u.test(previousLine)) {
          addContinuationEvidence(boundary, "previous_line_open", "soft");
        }
      }
      const firstLetter = currentLine.match(/\p{L}/u)?.[0];
      if (firstLetter !== undefined) {
        const lower = firstLetter.toLocaleLowerCase();
        const upper = firstLetter.toLocaleUpperCase();
        if (lower !== upper && firstLetter === lower)
          addContinuationEvidence(boundary, "lowercase_line_start", "strong");
      }
      if (/^[+\-−–—]?\d/u.test(currentLine)) addContinuationEvidence(boundary, "numeric_line_start", "soft");
      // A standalone bracketed row is overwhelmingly continuation geometry:
      // it carries qualifying material for the immediately preceding field/rule
      // rather than introducing a new independent statblock block. This is
      // language-neutral and remains advisory unless a compatible owner exists.
      if (/^[([{]/u.test(currentLine)) addContinuationEvidence(boundary, "leading_bracket_line_start", "strong");

      if (surfaceCompactColonLabelLead(currentLine, 80, 8) !== null) {
        // Inline punctuation may create one or more weak coordinates inside the
        // preceding physical row (for example after a printed feature title).
        // Look backward through those coordinate-only pieces to the nearest
        // independently positive named-rule start. This keeps Label: rows tied
        // to their owning rule without knowing what the label means.
        for (let previousIndex = index - 1; previousIndex >= 0 && previousIndex >= index - 4; previousIndex -= 1) {
          const previousCandidate = candidates[previousIndex];
          const previousPiece = candidatePiece(rawSource, candidates, previousIndex);
          if (titleShapeIsStrong(previousPiece)) {
            addContinuationEvidence(boundary, "compact_label_after_named_start", "strong");
            break;
          }
          if (
            previousCandidate?.reasons.includes("paragraph_start") ||
            previousCandidate?.reasons.includes("table_row_start")
          )
            break;
        }
      }
    }

    if (listStarts.has(candidate.start)) {
      boundary.scope = "internal";
      boundary.strength = "hard";
      if (!boundary.evidence.includes("list_sequence")) boundary.evidence.push("list_sequence");
    }

    return { ...candidate, boundary };
  });
}
