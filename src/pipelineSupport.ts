import type { ModelRunSummary, ParseIssue } from "./domain.js";
import type { ModelResponseIssue } from "./modelSchema.js";

export function pipelineIssue(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
  candidateIndex: number | null = null,
): ParseIssue {
  return {
    code,
    severity: "warning",
    message,
    candidateIndex,
    details,
  };
}

export function responseIssue(currentIssue: ModelResponseIssue): ParseIssue {
  return pipelineIssue(
    currentIssue.candidateIndex === null ? "invalid_model_response" : "invalid_model_candidate_classification",
    currentIssue.message,
    currentIssue.details,
    currentIssue.candidateIndex,
  );
}

export function emptyModelSummary(model: string, attempted: boolean): ModelRunSummary {
  return {
    model,
    attempted,
    succeeded: !attempted,
    elapsedSeconds: attempted ? 0 : null,
    requestCount: attempted ? 1 : 0,
    succeededRequestCount: 0,
    partialRequestCount: 0,
    failedRequestCount: attempted ? 1 : 0,
    returnedCandidateCount: 0,
    suppressedDuplicateCandidateCount: 0,
    acceptedAnnotationCount: 0,
    acceptedModelAnnotationCount: 0,
    deterministicAnnotationCount: 0,
    rejectedCandidateCount: 0,
  };
}

export function physicalBodyFallbackStarts(
  candidates: readonly { reasons: readonly string[] }[],
  allowedCandidateIndexes: readonly number[],
): number[] {
  const allowed = new Set(allowedCandidateIndexes);
  const starts = new Set<number>();
  let previousAllowed: number | null = null;
  for (const index of allowedCandidateIndexes) {
    if (!allowed.has(index)) continue;
    const candidate = candidates[index];
    if (candidate === undefined) continue;
    // The first candidate after every Header-owned gap must start a BODY run.
    if (previousAllowed === null || index !== previousAllowed + 1) starts.add(index);
    // Mixed-mode fallback intentionally uses only source-proven physical geometry.
    // It may preserve visual wraps as separate lines, but it never invents semantic
    // ownership and is strictly more useful than collapsing the entire BODY into
    // an unclassified remainder after a provider failure.
    if (
      candidate.reasons.includes("line_start") ||
      candidate.reasons.includes("paragraph_start") ||
      candidate.reasons.includes("document_start")
    ) {
      starts.add(index);
    }
    previousAllowed = index;
  }
  return [...starts].sort((left, right) => left - right);
}

export function resolveAbilityLabelCoordinateQuote(
  rawSource: string,
  candidates: readonly { start: number }[],
  labelQuote: string,
): string | null {
  const coordinate = /^C(\d{3,})$/u.exec(labelQuote.trim());
  if (coordinate === null) return labelQuote;
  const index = Number(coordinate[1]);
  const compactSpan = (candidateIndex: number): string | null => {
    const start = candidates[candidateIndex]?.start;
    const end = candidates[candidateIndex + 1]?.start ?? rawSource.length;
    if (start === undefined || !(start < end)) return null;
    const printed = rawSource.slice(start, end).trim();
    if (printed.length === 0 || printed.length > 32) return null;
    return printed;
  };

  const printed = compactSpan(index);
  if (printed === null) return null;
  // Preferred contract: q points directly at the exact printed ability label.
  if (!/\s/u.test(printed)) return printed;

  // Deferred 2.74.163 control repair: small models sometimes point q at the
  // immediately following numeric score/modifier cell instead of its label.
  // This fallback is language-neutral and does not infer ability identity: the
  // canonical `a` still comes from the model, and the existing six-label/table
  // constraint solver must independently prove the complete region.
  if (!/^[-+]?\d+(?:\s*\([+-]?\d+\))?(?:\s|$)/u.test(printed)) return null;
  const previous = compactSpan(index - 1);
  if (previous === null || /\s/u.test(previous) || /^[-+]?\d/u.test(previous)) return null;
  return previous;
}
