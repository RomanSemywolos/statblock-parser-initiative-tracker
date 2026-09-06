import type { CandidateRun, ParsedCandidateModelResponse } from "./modelSchema.js";
import type { SourceCandidate } from "./sourceCandidates.js";
import type { SourceOwnershipMap } from "./sourceOwnership.js";
import {
  looksLikeNamedFeatureLineStart,
  looksLikeStandaloneFeatureName,
  looksLikeStrongNamedFeature,
} from "./featureShape.js";
import { surfaceStandaloneHeadingRow } from "./titleBoundaryShape.js";

function multilineStructuralText(text: string): string {
  return (
    text
      .replace(/\u00a0/gu, " ")
      .replace(/^[ \t]*(?:#{1,6}[ \t]+)?/u, "")
      .replace(/^[ \t]*(?:[-+*][ \t]+)+/u, "")
      // Markdown sources sometimes close emphasis immediately before feature prose
      // (`**Name.**Text`). Preserve that visible authoring boundary as whitespace
      // before stripping markup; otherwise the shared surface-title detector would
      // correctly reject the artificial `Name.Text` token created by normalization.
      .replace(/([.!?])(?:\*{1,3}|_{1,3})(?=[\p{L}\p{N}])/gu, "$1 ")
      .replace(/\*{1,3}|_{1,3}/gu, "")
      .trim()
  );
}

function strongFeatureLine(text: string, candidate: SourceCandidate | undefined): boolean {
  // Internal hierarchy can affect the semantic role of this already-proven line,
  // but never its span. A list/subrow remains its own multiline logical unit.
  if (candidate?.boundary?.scope === "internal") return false;
  const structural = multilineStructuralText(text);
  return (
    looksLikeStrongNamedFeature(structural) ||
    looksLikeNamedFeatureLineStart(structural) ||
    looksLikeStandaloneFeatureName(structural)
  );
}

function physicalLineEnd(rawSource: string, offset: number): number {
  const newline = rawSource.indexOf("\n", offset);
  return newline >= 0 ? newline : rawSource.length;
}

function physicalLineStart(rawSource: string, offset: number): number {
  if (offset <= 0) return 0;
  const newline = rawSource.lastIndexOf("\n", offset - 1);
  return newline >= 0 ? newline + 1 : 0;
}

type MultilinePhysicalRun = {
  startCandidate: number;
  endCandidate: number;
  text: string;
};

/**
 * `multiline` is a routing guarantee: BODY physical line geometry is trusted.
 * Therefore one non-empty physical body line is one logical body unit. Candidate
 * granularity may be denser than physical lines, so all candidate coordinates on
 * the same line are folded into one run; coordinates from different non-empty
 * lines are never merged here.
 */
function createPhysicalLineRuns(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  startCandidate: number,
): MultilinePhysicalRun[] {
  const runs: MultilinePhysicalRun[] = [];
  let index = startCandidate;

  while (index < candidates.length) {
    const start = candidates[index]?.start;
    if (start === undefined) break;

    const lineStart = physicalLineStart(rawSource, start);
    const lineEnd = physicalLineEnd(rawSource, start);
    let endCandidate = index;

    while (endCandidate + 1 < candidates.length) {
      const nextStart = candidates[endCandidate + 1]?.start;
      if (nextStart === undefined || nextStart > lineEnd) break;
      // A candidate exactly at the next physical line starts a new logical unit.
      if (nextStart === lineEnd + 1) break;
      endCandidate += 1;
    }

    const text = rawSource.slice(lineStart, lineEnd).trim();
    if (text.length > 0) {
      runs.push({ startCandidate: index, endCandidate, text });
    }
    index = endCandidate + 1;
  }

  return runs;
}

function classifyMultilineLikeRuns(
  runs: readonly MultilinePhysicalRun[],
  candidates: readonly SourceCandidate[],
): CandidateRun[] {
  const bodyRuns: CandidateRun[] = [];
  let sectionHasFeature = false;

  for (const run of runs) {
    if (surfaceStandaloneHeadingRow(multilineStructuralText(run.text))) {
      bodyRuns.push({
        classification: "unknown_section_heading",
        startCandidate: run.startCandidate,
        endCandidate: run.endCandidate,
        field: null,
      });
      sectionHasFeature = false;
      continue;
    }

    if (strongFeatureLine(run.text, candidates[run.startCandidate])) {
      bodyRuns.push({
        classification: "feature",
        startCandidate: run.startCandidate,
        endCandidate: run.endCandidate,
        field: null,
      });
      sectionHasFeature = true;
      continue;
    }

    bodyRuns.push({
      classification: sectionHasFeature ? "section_content" : "section_rules",
      startCandidate: run.startCandidate,
      endCandidate: run.endCandidate,
      field: null,
    });
  }

  return bodyRuns;
}

export type VirtualMultilineNormalizationPlan = {
  bodyRuns: CandidateRun[];
  normalizedLineStarts: number[];
  signals: string[];
};

/**
 * Normalization BODY LLM output has one purpose only: restore logical line starts so the
 * remaining source has the same structural shape that multiline mode already
 * knows how to parse. It does not assign semantic roles. Header-owned candidates
 * are excluded before this function is called and split the BODY into independent
 * contiguous segments.
 *
 * The reconstructed logical lines are then passed through the exact same
 * deterministic classifier used by physically multiline BODY. The source text is
 * never rewritten; only virtual line geometry is supplied.
 */
export function createVirtualMultilineNormalizationPlan(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  allowedCandidateIndexes: readonly number[],
  modelLineStarts: readonly number[],
): VirtualMultilineNormalizationPlan {
  const allowed = [...new Set(allowedCandidateIndexes)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < candidates.length)
    .sort((left, right) => left - right);
  const allowedSet = new Set(allowed);
  const startsSet = new Set(modelLineStarts.filter((index) => allowedSet.has(index)));

  const segments: Array<{ start: number; end: number }> = [];
  for (const index of allowed) {
    const previous = segments[segments.length - 1];
    if (previous === undefined || index !== previous.end + 1) segments.push({ start: index, end: index });
    else previous.end = index;
  }

  const logicalRuns: MultilinePhysicalRun[] = [];
  const normalizedLineStarts: number[] = [];
  for (const segment of segments) {
    startsSet.add(segment.start);
    const starts = [...startsSet]
      .filter((index) => segment.start <= index && index <= segment.end)
      .sort((left, right) => left - right);
    normalizedLineStarts.push(...starts);
    for (let position = 0; position < starts.length; position += 1) {
      const startCandidate = starts[position]!;
      const nextStart = starts[position + 1];
      const endCandidate = nextStart === undefined ? segment.end : nextStart - 1;
      const startOffset = candidates[startCandidate]?.start;
      const endOffset = candidates[endCandidate + 1]?.start ?? rawSource.length;
      const text =
        startOffset === undefined ? "" : rawSource.slice(startOffset, endOffset).replace(/\s+/gu, " ").trim();
      if (text.length > 0) logicalRuns.push({ startCandidate, endCandidate, text });
    }
  }

  return {
    bodyRuns: classifyMultilineLikeRuns(logicalRuns, candidates),
    normalizedLineStarts,
    signals: [
      "body_llm_job=restore_multiline_logical_lines_only",
      "body_semantics=deterministic_multiline_parser",
      `normalized_line_starts=${normalizedLineStarts.length}`,
    ],
  };
}

export type MixedMultilineNormalizationPlan = VirtualMultilineNormalizationPlan;

export function createMixedMultilineNormalizationPlan(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  allowedCandidateIndexes: readonly number[],
  modelLineStarts: readonly number[],
): MixedMultilineNormalizationPlan {
  return createVirtualMultilineNormalizationPlan(rawSource, candidates, allowedCandidateIndexes, modelLineStarts);
}

export function mergeMultilineHeaderAndBody(
  header: ParsedCandidateModelResponse,
  bodyRuns: readonly CandidateRun[],
): ParsedCandidateModelResponse {
  return {
    ...header,
    runs: [...header.runs, ...bodyRuns].sort(
      (a, b) => a.startCandidate - b.startCandidate || a.endCandidate - b.endCandidate,
    ),
    debugRuns: [...header.debugRuns, ...bodyRuns].sort(
      (a, b) => a.startCandidate - b.startCandidate || a.endCandidate - b.endCandidate,
    ),
  };
}

export type MultilineOwnershipPlan = {
  headerRuns: CandidateRun[];
  bodyRuns: CandidateRun[];
  signals: string[];
};

function lineIntersectsOwnership(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  run: MultilinePhysicalRun,
  ownership: SourceOwnershipMap,
): { owned: boolean; field: CandidateRun["field"] } {
  const start = candidates[run.startCandidate]?.start;
  if (start === undefined) return { owned: false, field: null };
  const lineStart = physicalLineStart(rawSource, start);
  const lineEnd = physicalLineEnd(rawSource, start);
  const intersecting = ownership.ranges.filter((range) => range.start < lineEnd && lineStart < range.end);
  if (intersecting.length === 0) return { owned: false, field: null };

  const fields = new Set(
    intersecting.flatMap((range) =>
      range.owners.map((owner) => owner.field).filter((field): field is NonNullable<typeof field> => field !== null),
    ),
  );
  return { owned: true, field: fields.size === 1 ? [...fields][0]! : null };
}

/**
 * v2.74.133 multiline ownership architecture.
 *
 * There is no global Header/BODY boundary. Header is the set of source ranges
 * accepted by deterministic card-fact validation. On physically multiline
 * source, any physical row intersecting accepted Header evidence is preserved as
 * one Header presentation row; every other non-empty physical row is BODY and is
 * classified only from deterministic line geometry.
 *
 * This intentionally separates:
 * - semantic fact evidence (exact accepted source ranges),
 * - presentation ownership (the complete printed row containing that evidence),
 * - BODY structure (the complement of those rows).
 */
export function createMultilineOwnershipPlan(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  ownership: SourceOwnershipMap,
): MultilineOwnershipPlan {
  const physicalRuns = createPhysicalLineRuns(rawSource, candidates, 0);
  const headerRuns: CandidateRun[] = [];
  const bodyPhysicalRuns: MultilinePhysicalRun[] = [];

  for (const run of physicalRuns) {
    const owned = lineIntersectsOwnership(rawSource, candidates, run, ownership);
    if (owned.owned) {
      headerRuns.push({
        classification: "header_field",
        startCandidate: run.startCandidate,
        endCandidate: run.endCandidate,
        field: owned.field,
      });
      continue;
    }
    bodyPhysicalRuns.push(run);
  }
  const bodyRuns = classifyMultilineLikeRuns(bodyPhysicalRuns, candidates);

  return {
    headerRuns,
    bodyRuns,
    signals: [
      "header_ownership=validated_card_facts",
      "body_definition=complement_of_header_rows",
      "multiline_unit=physical_nonempty_line",
    ],
  };
}
