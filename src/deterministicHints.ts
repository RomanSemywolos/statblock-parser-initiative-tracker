import type { SourceCandidate } from "./sourceCandidates.js";
import { standaloneNamedRuleTitleShape, trustedNamedRuleLineShape } from "./surfaceStructure.js";
import { surfaceCompactColonLabelLead, surfaceStandaloneHeadingRow } from "./titleBoundaryShape.js";

export type DeterministicHintKind =
  | "named_rule_continuation"
  | "labeled_continuation"
  | "all_caps_standalone"
  | "standalone_heading_row"
  | "contextual_standalone_heading_row";

export type DeterministicHint = {
  kind: DeterministicHintKind;
  candidates: number[];
  evidence: string[];
};

/*
 * Hints are deliberately weaker than parser classifications. Base structural
 * hints must remain language-neutral; semantic identity/header knowledge is
 * handled by the model verifier and optional language/profile enrichers.
 */
function pieceText(rawSource: string, candidates: readonly SourceCandidate[], index: number): string {
  const start = candidates[index]?.start;
  if (start === undefined) return "";
  const end = candidates[index + 1]?.start ?? rawSource.length;
  return rawSource.slice(start, end).replace(/\s+/gu, " ").trim();
}

function physicalLineText(rawSource: string, start: number): string {
  let lineStart = start;
  while (lineStart > 0 && !/[\r\n]/u.test(rawSource[lineStart - 1] ?? "")) lineStart -= 1;
  let lineEnd = start;
  while (lineEnd < rawSource.length && !/[\r\n]/u.test(rawSource[lineEnd] ?? "")) lineEnd += 1;
  return rawSource.slice(lineStart, lineEnd).trim();
}

function namedRuleContinuationHint(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  index: number,
): DeterministicHint | null {
  const current = pieceText(rawSource, candidates, index);
  const next = pieceText(rawSource, candidates, index + 1);
  if (!standaloneNamedRuleTitleShape(current) || next.length < 12) return null;
  if (standaloneNamedRuleTitleShape(next)) return null;

  const beginsLikeProse = /^[\p{Lu}\p{Ll}"'“‘(]/u.test(next);
  if (!beginsLikeProse) return null;
  return {
    kind: "named_rule_continuation",
    candidates: [index, index + 1],
    evidence: ["short_named_rule_shape", "following_candidate_has_prose_continuation_shape"],
  };
}

function labeledContinuationHint(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  index: number,
): DeterministicHint | null {
  if (index <= 0) return null;
  const boundary = candidates[index];
  if (
    boundary === undefined ||
    !boundary.reasons.includes("line_start") ||
    boundary.reasons.includes("paragraph_start")
  )
    return null;
  const current = pieceText(rawSource, candidates, index);
  const previous = pieceText(rawSource, candidates, index - 1);

  const label = surfaceCompactColonLabelLead(current, 80, 8);
  if (label === null || current.slice(label.length).trim().length === 0) return null;

  const previousLooksLikeNamedRule = standaloneNamedRuleTitleShape(previous) || trustedNamedRuleLineShape(previous);
  if (!previousLooksLikeNamedRule) return null;

  return {
    kind: "labeled_continuation",
    candidates: [index - 1, index],
    evidence: ["preceding_candidate_has_named_rule_shape", "compact_labeled_continuation_shape"],
  };
}

function standaloneHeadingRowHint(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  index: number,
): DeterministicHint | null {
  const candidate = candidates[index];
  if (
    candidate === undefined ||
    !(candidate.reasons.includes("line_start") || candidate.reasons.includes("document_start"))
  )
    return null;
  const line = physicalLineText(rawSource, candidate.start);
  if (!surfaceStandaloneHeadingRow(line)) return null;
  // Tabular header rows such as `Mod\tSave` are source-proven table geometry,
  // not standalone section rows. Never let the hard mixed-heading safeguard
  // split a table that the model intentionally kept as one multiline unit.
  if (line.includes("\t")) return null;

  // ALL-CAPS rows already have their established hint and hard-geometry path.
  // This new evidence is deliberately narrower: only title-case standalone
  // rows with enough independent capitalized words are added. That preserves
  // `Legendary Actions` / `Bonus Actions` while rejecting ordinary prose such
  // as `The creature moves`. No vocabulary or section identity is encoded.
  const words = line.match(/[\p{L}'’_-]+/gu) ?? [];
  const casedFirstLetters = words
    .map((word) => word.match(/\p{L}/u)?.[0] ?? null)
    .filter((letter): letter is string => letter !== null && letter.toLocaleLowerCase() !== letter.toLocaleUpperCase());
  if (casedFirstLetters.length === 0) return null;
  const uppercaseInitials = casedFirstLetters.filter((letter) => letter === letter.toLocaleUpperCase()).length;
  const allLetters = [...line].filter((character) => /\p{L}/u.test(character));
  const allCasedLetters = allLetters.filter(
    (character) => character.toLocaleLowerCase() !== character.toLocaleUpperCase(),
  );
  if (allCasedLetters.length > 0 && allCasedLetters.every((character) => character === character.toLocaleUpperCase()))
    return null;
  // Hard mixed geometry is intentionally narrower than the generic heading
  // shape detector. A one-word title-case physical row can easily be a visual
  // wrap (`Flying` / `Sword.`), so only multi-word title-case rows receive this
  // deterministic preservation. Existing ALL-CAPS geometry remains separate.
  if (words.length < 2) return null;
  if (uppercaseInitials < 2) return null;
  if (uppercaseInitials * 2 < casedFirstLetters.length) return null;

  return {
    kind: "standalone_heading_row",
    candidates: [index],
    evidence: ["standalone_physical_line", "compact_heading_shape", "multiple_capitalized_word_starts"],
  };
}

function candidateHasHeaderMetadataEvidence(candidate: SourceCandidate | undefined): boolean {
  const evidence = candidate?.boundary?.evidence ?? [];
  return evidence.includes("header_interleaved_compact_row") || evidence.includes("compact_metadata");
}

function nextPhysicalLineCandidateIndex(candidates: readonly SourceCandidate[], index: number): number | null {
  for (let next = index + 1; next < candidates.length; next += 1) {
    const candidate = candidates[next];
    if (candidate?.reasons.includes("line_start") || candidate?.reasons.includes("paragraph_start")) return next;
  }
  return null;
}

/**
 * Hard mixed-only geometry for short standalone rows whose surrounding BODY
 * shape proves that they introduce a peer-rule region. This deliberately does
 * not identify a section or inspect vocabulary. It exists for one-word and
 * sentence-case headings (`Actions`, `Действия`, `Легендарные действия`) that
 * the older title-case safeguard cannot recognize. The hint is intentionally
 * NOT model-facing; it only preserves already printed standalone line geometry.
 */
function contextualStandaloneHeadingRowHint(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  index: number,
): DeterministicHint | null {
  const candidate = candidates[index];
  if (candidate === undefined || !candidate.reasons.includes("standalone_block_start")) return null;
  if (!(candidate.reasons.includes("line_start") || candidate.reasons.includes("document_start"))) return null;
  if (candidateHasHeaderMetadataEvidence(candidate)) return null;

  const line = physicalLineText(rawSource, candidate.start);
  if (!surfaceStandaloneHeadingRow(line) || line.includes("\t")) return null;

  // Two adjacent standalone-looking physical rows are ambiguous wrap geometry,
  // not enough proof for a hard section boundary. For example `Flying\nSword.`
  // may be one wrapped named-rule title. Real section rows in the supported
  // corpus follow metadata/prose and then introduce peer-rule geometry.
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const prior = candidates[previous];
    if (
      prior?.reasons.includes("line_start") ||
      prior?.reasons.includes("paragraph_start") ||
      prior?.reasons.includes("document_start")
    ) {
      if (prior.reasons.includes("standalone_block_start")) return null;
      break;
    }
  }

  // A wrapped metadata tail such as `Slashing from Nonmagical Attacks` is also
  // a short standalone-looking physical row. Stop immediately when the next
  // physical row returns to the ownership-proven metadata corridor.
  let next = nextPhysicalLineCandidateIndex(candidates, index);
  let physicalRowsChecked = 0;
  while (next !== null && physicalRowsChecked < 8) {
    const following = candidates[next];
    if (following === undefined) return null;
    if (candidateHasHeaderMetadataEvidence(following)) return null;
    if (following.reasons.includes("standalone_block_start") && physicalRowsChecked > 0) return null;
    if (following.reasons.includes("named_block_start")) {
      return {
        kind: "contextual_standalone_heading_row",
        candidates: [index],
        evidence: ["standalone_physical_line", "peer_rule_region_ahead", "no_header_metadata_corridor"],
      };
    }
    next = nextPhysicalLineCandidateIndex(candidates, next);
    physicalRowsChecked += 1;
  }
  return null;
}

function allCapsStandaloneHint(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  index: number,
): DeterministicHint | null {
  const candidate = candidates[index];
  if (
    candidate === undefined ||
    !(candidate.reasons.includes("line_start") || candidate.reasons.includes("document_start"))
  )
    return null;
  const line = physicalLineText(rawSource, candidate.start);
  if (line.length < 2 || line.length > 80 || /[\d,.:;!?()[\]{}]/u.test(line)) return null;
  const letters = [...line].filter((character) => /\p{L}/u.test(character));
  if (letters.length < 2) return null;
  const cased = letters.filter((character) => character.toLocaleLowerCase() !== character.toLocaleUpperCase());
  if (cased.length === 0) return null;
  if (cased.some((character) => character !== character.toLocaleUpperCase())) return null;
  const words = line.match(/[\p{L}'’_-]+/gu) ?? [];
  if (words.length < 1 || words.length > 8) return null;
  return {
    kind: "all_caps_standalone",
    candidates: [index],
    evidence: ["standalone_physical_line", "all_cased_letters_uppercase", "compact_text_shape"],
  };
}

export function createDeterministicHints(
  rawSource: string,
  candidates: readonly SourceCandidate[],
): DeterministicHint[] {
  const hints: DeterministicHint[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const namedContinuation = namedRuleContinuationHint(rawSource, candidates, index);
    if (namedContinuation !== null) hints.push(namedContinuation);

    const labeled = labeledContinuationHint(rawSource, candidates, index);
    if (labeled !== null) hints.push(labeled);
  }

  return hints.slice(0, 16);
}

/**
 * Mixed normalization may use a few additional source-shape observations that
 * are useful specifically for restoring lost multiline geometry. They remain
 * advisory only: none of them creates a boundary or assigns a semantic role.
 */
export function createMixedNormalizationHints(
  rawSource: string,
  candidates: readonly SourceCandidate[],
): DeterministicHint[] {
  const hints = [...createDeterministicHints(rawSource, candidates)];
  for (let index = 0; index < candidates.length && hints.length < 32; index += 1) {
    const allCaps = allCapsStandaloneHint(rawSource, candidates, index);
    if (allCaps !== null) hints.push(allCaps);
    if (hints.length >= 32) break;
    const standaloneHeading = standaloneHeadingRowHint(rawSource, candidates, index);
    if (standaloneHeading !== null) hints.push(standaloneHeading);
    if (hints.length >= 32) break;
    // Contextual rescue is only for rows the established ALL-CAPS/title-case
    // safeguards cannot already prove. Avoid duplicate hard hints and preserve
    // the finite hint budget for genuinely independent observations.
    if (allCaps === null && standaloneHeading === null) {
      const contextualStandaloneHeading = contextualStandaloneHeadingRowHint(rawSource, candidates, index);
      if (contextualStandaloneHeading !== null) hints.push(contextualStandaloneHeading);
    }
  }
  return hints;
}

export function structuralHints(hints: readonly DeterministicHint[]): DeterministicHint[] {
  return hints.filter((hint) => hint.kind === "named_rule_continuation" || hint.kind === "labeled_continuation");
}

export function mixedNormalizationHints(hints: readonly DeterministicHint[]): DeterministicHint[] {
  return hints.filter(
    (hint) =>
      hint.kind === "named_rule_continuation" ||
      hint.kind === "labeled_continuation" ||
      hint.kind === "all_caps_standalone" ||
      hint.kind === "standalone_heading_row",
  );
}

export function verificationHints(_hints: readonly DeterministicHint[]): DeterministicHint[] {
  // Critical-fact verification is already semantic and source-grounded. Feeding
  // English identity vocabulary here would make unknown languages receive less
  // evidence, so the base verifier intentionally receives no language hint.
  return [];
}
