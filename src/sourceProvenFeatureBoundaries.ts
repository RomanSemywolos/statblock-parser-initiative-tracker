import type { ParseIssue } from "./domain.js";
import type { CandidateRun } from "./modelSchema.js";
import type { SourceCandidate } from "./candidateTypes.js";
import { compactStandaloneHeadingShape } from "./surfaceStructure.js";

export type SourceProvenFeatureBoundaryResult = {
  runs: CandidateRun[];
  issues: ParseIssue[];
};

function issue(
  code: string,
  message: string,
  candidateIndex: number | null,
  details: Record<string, unknown> = {},
): ParseIssue {
  return { code, severity: "info", message, candidateIndex, details };
}

function piece(rawSource: string, candidates: readonly SourceCandidate[], index: number): string {
  const start = candidates[index]?.start;
  if (start === undefined) return "";
  return rawSource.slice(start, candidates[index + 1]?.start ?? rawSource.length).trim();
}

function beginsWithLowercaseCasedLetter(text: string): boolean {
  const first = text.match(/\p{L}/u)?.[0];
  if (first === undefined) return false;
  const lower = first.toLocaleLowerCase();
  const upper = first.toLocaleUpperCase();
  return lower !== upper && first === lower;
}

function brokenTitleStart(text: string): boolean {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length < 8 || normalized.length > 180) return false;
  const openIndex = normalized.indexOf("(");
  if (openIndex < 2) return false;
  const beforeParen = normalized.slice(0, openIndex).trim();
  const afterParen = normalized.slice(openIndex + 1);
  if (beforeParen.length < 2 || beforeParen.length > 100 || /[;:!?]/u.test(beforeParen)) return false;
  const opens = (normalized.match(/\(/gu) ?? []).length;
  const closes = (normalized.match(/\)/gu) ?? []).length;
  if (opens <= closes || /[.!?]$/u.test(normalized)) return false;
  const words = beforeParen.split(/\s+/u).filter(Boolean);
  if (words.length === 0 || words.length > 14 || !/[\p{L}\p{N}]/u.test(afterParen)) return false;
  const lexical = words.filter((word) => /\p{L}/u.test(word));
  if (lexical.length === 0) return false;
  const uppercase = lexical.filter((word) => {
    const first = word.match(/\p{L}/u)?.[0];
    return first !== undefined && first === first.toLocaleUpperCase() && first !== first.toLocaleLowerCase();
  }).length;
  return uppercase >= Math.max(1, Math.ceil(lexical.length / 2));
}

function brokenTitleContinuationEnd(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  index: number,
): number | null {
  const first = piece(rawSource, candidates, index);
  if (!brokenTitleStart(first)) return null;
  let balance = (first.match(/\(/gu) ?? []).length - (first.match(/\)/gu) ?? []).length;
  for (let cursor = index + 1; cursor < candidates.length && cursor <= index + 3; cursor += 1) {
    const current = piece(rawSource, candidates, cursor);
    balance += (current.match(/\(/gu) ?? []).length - (current.match(/\)/gu) ?? []).length;
    if (balance <= 0) return cursor;

    // Do not bridge a source-proven independent structural boundary. This check
    // uses only the shared evidence layer; it knows no header or section words.
    const boundary = candidates[cursor]?.boundary;
    if (
      boundary?.scope === "top_level" &&
      boundary.strength !== "weak" &&
      boundary.evidence.some((kind) => kind !== "title_shape" && kind !== "sentence_shape")
    )
      return null;
  }
  return null;
}

function sourceProvesFeatureStart(rawSource: string, candidates: readonly SourceCandidate[], index: number): boolean {
  const boundary = candidates[index]?.boundary;
  if (boundary?.scope === "internal" && boundary.strength === "hard") return false;
  if (boundary?.scope === "top_level" && boundary.strength !== "weak" && boundary.evidence.includes("title_shape"))
    return true;
  return (
    brokenTitleStart(piece(rawSource, candidates, index)) &&
    brokenTitleContinuationEnd(rawSource, candidates, index) !== null
  );
}

function safeInternalFeatureStart(rawSource: string, candidates: readonly SourceCandidate[], index: number): boolean {
  if (!sourceProvesFeatureStart(rawSource, candidates, index)) return false;
  const current = piece(rawSource, candidates, index);
  if (beginsWithLowercaseCasedLetter(current)) return false;
  if (brokenTitleContinuationEnd(rawSource, candidates, index) !== null) return true;

  // Preserve a title-shaped wrapped tail when the source itself shows that it is
  // an unfinished phrase immediately before a later strong feature with the same
  // leading word. This is punctuation/geometry only, not English vocabulary.
  const nextIndex = index + 1;
  if (nextIndex < candidates.length && sourceProvesFeatureStart(rawSource, candidates, nextIndex)) {
    const previous = index > 0 ? piece(rawSource, candidates, index - 1) : "";
    const next = piece(rawSource, candidates, nextIndex);
    const leadingWord = (value: string): string | null =>
      value.match(/^([\p{L}\p{N}'’_-]+)/u)?.[1]?.toLocaleLowerCase() ?? null;
    const sameLeadingWord = leadingWord(current) !== null && leadingWord(current) === leadingWord(next);
    const previousLooksUnfinished = previous.length > 0 && !/[.!?][)\]}'”’"]*$/u.test(previous);
    if (compactStandaloneHeadingShape(current) && previousLooksUnfinished && sameLeadingWord) return false;
  }
  return true;
}

export function enforceSourceProvenFeatureBoundaries(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  runs: readonly CandidateRun[],
): SourceProvenFeatureBoundaryResult {
  const output: CandidateRun[] = [];
  const issues: ParseIssue[] = [];

  for (const run of runs) {
    if (run.classification !== "feature" || run.startCandidate >= run.endCandidate) {
      output.push({ ...run });
      continue;
    }
    const splitPoints: number[] = [];
    for (let index = run.startCandidate + 1; index <= run.endCandidate; index += 1) {
      if (safeInternalFeatureStart(rawSource, candidates, index)) splitPoints.push(index);
    }
    if (splitPoints.length === 0) {
      output.push({ ...run });
      continue;
    }
    let start = run.startCandidate;
    for (const splitPoint of splitPoints) {
      if (start < splitPoint) output.push({ ...run, startCandidate: start, endCandidate: splitPoint - 1 });
      start = splitPoint;
    }
    output.push({ ...run, startCandidate: start, endCandidate: run.endCandidate });
    issues.push(
      issue(
        "candidate_feature_split_at_internal_named_start",
        "A model-owned feature contained a later source-proven named-rule boundary, so ownership was split at that language-neutral structural coordinate.",
        run.startCandidate,
        { splitCandidates: splitPoints },
      ),
    );
  }
  return { runs: output, issues };
}
