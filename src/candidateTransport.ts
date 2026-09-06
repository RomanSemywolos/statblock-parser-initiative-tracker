import type {
  CompiledAnnotation,
  LosslessSourceMap,
  LosslessStatblockDocument,
  ParseIssue,
  StatblockSection,
  SourceUnit,
} from "./domain.js";

import type {
  CandidateRun,
  CandidateRunClassification,
  ModelAbilityRow,
  ModelSavingThrow,
  ParsedCandidateModelResponse,
  ParsedModelHeaderFacts,
} from "./modelSchema.js";

import type { SourceCandidate } from "./sourceCandidates.js";
import { enforceSourceProvenFeatureBoundaries } from "./sourceProvenFeatureBoundaries.js";
import { standaloneNamedRuleTitleShape, trustedNamedRuleLineShape } from "./surfaceStructure.js";
import { introducedListSequenceStartGroups } from "./listSequence.js";

export type CandidateTransportIssue = ParseIssue;

export type CandidateRunDebugEntry = {
  startCandidate: number;
  endCandidate: number;
  startId: string;
  endId: string;
  classification: CandidateRunClassification;
  runLength: number;
  startPreview: string;
  endPreview: string;
  accepted: boolean;
  acceptedRole: string | null;
  acceptedField: string | null;
  acceptedSection: string | null;
};

export type CandidateTransportDebug = {
  transport: "candidate_spans";
  status: "prepared" | "processed" | "response_invalid" | "model_failed";
  modelError: string | null;
  candidateCount: number;
  runCount: number;
  coveredCandidateCount: number;
  unclassifiedRunCount: number;
  runs: CandidateRunDebugEntry[];
};

export function createCandidateDebugSkeleton(
  sourceCandidates: readonly SourceCandidate[],
  status: CandidateTransportDebug["status"] = "prepared",
  modelError: string | null = null,
): CandidateTransportDebug {
  return {
    transport: "candidate_spans",
    status,
    modelError,
    candidateCount: sourceCandidates.length,
    runCount: 0,
    coveredCandidateCount: 0,
    unclassifiedRunCount: 0,
    runs: [],
  };
}

function issue(
  code: string,
  message: string,
  candidateIndex: number | null,
  details: Record<string, unknown> = {},
): ParseIssue {
  return {
    code,
    severity: "warning",
    message,
    candidateIndex,
    details,
  };
}

function contentUnits(sourceMap: LosslessSourceMap): SourceUnit[] {
  return sourceMap.units.filter((unit) => unit.kind === "content");
}

const HEADING_CLASSIFICATIONS: Partial<Record<CandidateRunClassification, StatblockSection>> = {
  traits_heading: "traits",
  actions_heading: "actions",
  bonus_actions_heading: "bonus_actions",
  reactions_heading: "reactions",
  legendary_actions_heading: "legendary_actions",
  mythic_actions_heading: "mythic_actions",
  lair_actions_heading: "lair_actions",
  regional_effects_heading: "regional_effects",
  description_heading: "description",
};

function uniqueHeaderAnnotation(document: LosslessStatblockDocument, field: string): CompiledAnnotation | null {
  const matches = document.annotations.filter(
    (annotation) => annotation.role === "header_field" && annotation.field === field,
  );

  return matches.length === 1 ? matches[0] : null;
}

export function candidateHeaderFacts(
  document: LosslessStatblockDocument,
  parsed: ParsedCandidateModelResponse,
  sourceCandidates?: readonly SourceCandidate[],
): ParsedModelHeaderFacts {
  const abilityRows: ModelAbilityRow[] = [];
  const abilityLabels = parsed.abilityLabels.map((label) => ({ ...label }));
  const savingThrows: ModelSavingThrow[] = parsed.savingThrows.map((save) => ({
    ability: save.ability,
    bonus: save.bonus,
    sourceQuote: save.evidenceQuote,
  }));
  const issues: ParsedModelHeaderFacts["issues"] = [];

  if (parsed.abilityLabels.length > 0) {
    // Legacy single-block parser can still consume the hints when the model also
    // produced one exact ability_scores annotation. The layout-independent
    // resolver consumes abilityLabels directly and does not require this block.
    const abilityAnnotation = uniqueHeaderAnnotation(document, "ability_scores");

    if (abilityAnnotation !== null) {
      for (const row of parsed.abilityLabels) {
        abilityRows.push({
          ability: row.ability,
          labelQuote: row.labelQuote,
          sourceQuote: abilityAnnotation.text,
        });
      }
    }
  }

  let essentialRegions =
    sourceCandidates === undefined
      ? []
      : (parsed.essentialFacts ?? []).flatMap((fact) => {
          const rawStart = sourceCandidates[fact.startCandidate]?.start;
          if (rawStart === undefined) return [];
          const rawEnd = sourceCandidates[fact.endCandidate + 1]?.start ?? document.rawSource.length;
          if (!(rawStart < rawEnd)) return [];
          const rawEvidence = document.rawSource.slice(rawStart, rawEnd);
          const leading = rawEvidence.length - rawEvidence.trimStart().length;
          const trailing = rawEvidence.length - rawEvidence.trimEnd().length;
          const start = rawStart + leading;
          const end = rawEnd - trailing;
          if (!(start < end)) return [];
          return [{ kind: fact.kind, start, end }];
        });

  // Independent verifier claims may repeat identity-edge mistakes. The two closed
  // identity facts are adjacent but distinct source ownership. Deterministic code
  // may carve only overlap that is independently bounded by the other claim; it
  // never guesses a missing split from vocabulary.
  const verifiedName = essentialRegions.find((region) => region.kind === "name") ?? null;
  const verifiedType = essentialRegions.find((region) => region.kind === "size_type_alignment") ?? null;
  if (
    verifiedName !== null &&
    verifiedType !== null &&
    verifiedName.start < verifiedType.start &&
    verifiedType.start < verifiedName.end &&
    verifiedName.end <= verifiedType.end
  ) {
    essentialRegions = essentialRegions.map((region) =>
      region === verifiedName ? { ...region, end: verifiedType.start } : region,
    );
    issues.push({
      code: "verified_identity_overlap_carved",
      message:
        "Verifier name evidence overlapped only the independently grounded creature-classification tail; the shared tail was removed from name evidence.",
      details: {
        nameStart: verifiedName.start,
        oldNameEnd: verifiedName.end,
        classificationStart: verifiedType.start,
        classificationEnd: verifiedType.end,
      },
    });
  } else if (
    verifiedName !== null &&
    verifiedType !== null &&
    verifiedName.start === verifiedType.start &&
    verifiedName.end < verifiedType.end
  ) {
    let classificationStart = verifiedName.end;
    while (classificationStart < verifiedType.end && /\s/u.test(document.rawSource[classificationStart] ?? ""))
      classificationStart += 1;
    essentialRegions = essentialRegions.map((region) =>
      region === verifiedType ? { ...region, start: classificationStart } : region,
    );
    issues.push({
      code: "verified_identity_prefix_carved",
      message:
        "Verifier creature-classification evidence repeated an independently grounded name prefix; the exact name prefix was removed from classification evidence.",
      details: {
        nameStart: verifiedName.start,
        nameEnd: verifiedName.end,
        oldClassificationStart: verifiedType.start,
        classificationEnd: verifiedType.end,
      },
    });
  } else if (
    verifiedName !== null &&
    verifiedType !== null &&
    verifiedName.start === verifiedType.start &&
    verifiedName.end === verifiedType.end
  ) {
    essentialRegions = essentialRegions.filter((region) => region !== verifiedName && region !== verifiedType);
    issues.push({
      code: "verified_identity_identical_span_rejected",
      message:
        "Verifier name and creature-classification claims used the identical source span; both contradictory identity claims were rejected rather than inventing a split.",
      details: { start: verifiedName.start, end: verifiedName.end },
    });
  }

  return { abilityRows, abilityLabels, savingThrows, essentialRegions, issues };
}

/*
 * v2.44 direct candidate transport.
 *
 * Candidate coordinates are already immutable source anchors.  This path does
 * not turn them back into quotes and then search for those quotes again.  The
 * structural model proposes document order/boundaries. Deterministic logic may
 * label a grounded header span and may close only source-proven continuation
 * coordinates back into an already-open compatible owner; it never invents
 * replacement prose or unsupported header semantics.
 */

function looksLikeGroundedPrintedSaveField(
  text: string,
  abilityLabels: readonly { ability: string; labelQuote: string }[],
): boolean {
  const compact = text.trim();
  if (compact.length === 0 || compact.length > 320) return false;

  let matched = 0;
  for (const hint of abilityLabels) {
    const escaped = hint.labelQuote.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    if (new RegExp(`${escaped}\\s*[+\\-−‒–—﹣－＋]\\d{1,3}`, "u").test(compact)) matched += 1;
  }

  // One explicit ability+signed-bonus pair is already strong mechanical shape;
  // requiring two when several labels are available further reduces prose risk.
  const threshold = abilityLabels.length >= 2 ? 2 : 1;
  return matched >= threshold;
}

type CandidateTransportOptions = {
  enforceSourceProvenFeatureBoundaries?: boolean;
  preserveUnknownSectionStructure?: boolean;
  /** Candidate coordinates that belong to independently accepted Header ownership.
   * Transport may use them as context, but must never emit or deterministically
   * annex them into BODY annotations. */
  protectedCandidateIndexes?: readonly number[];
};

function candidateRunText(rawSource: string, candidates: readonly SourceCandidate[], run: CandidateRun): string {
  const start = candidates[run.startCandidate]?.start;
  if (start === undefined) return "";
  const end = candidates[run.endCandidate + 1]?.start ?? rawSource.length;
  return rawSource.slice(start, end);
}

function carveTrailingClassificationFromName(runs: readonly CandidateRun[], issues: ParseIssue[]): CandidateRun[] {
  const names = runs.filter((run) => run.classification === "name");
  const classifications = runs.filter((run) => run.classification === "size_type_alignment");
  if (names.length !== 1 || classifications.length !== 1) return runs.map((run) => ({ ...run }));
  const name = names[0]!;
  const classification = classifications[0]!;
  const overlaps =
    name.startCandidate <= classification.endCandidate && classification.startCandidate <= name.endCandidate;
  if (!overlaps) return runs.map((run) => ({ ...run }));

  // The only safe deterministic repair is a trailing overlap: the model gave
  // the name a prefix of its own plus one or more candidates independently
  // claimed as the creature classification. Keep the unique name prefix and
  // let the independently grounded classification own the shared tail.
  if (
    name.startCandidate < classification.startCandidate &&
    classification.startCandidate <= name.endCandidate &&
    name.endCandidate <= classification.endCandidate
  ) {
    issues.push(
      issue(
        "candidate_identity_overlap_carved",
        "A creature-name span overlapped the independently grounded classification only on its trailing candidates, so the shared classification tail was removed from name ownership.",
        name.startCandidate,
        {
          nameStart: name.startCandidate,
          oldNameEnd: name.endCandidate,
          classificationStart: classification.startCandidate,
          classificationEnd: classification.endCandidate,
        },
      ),
    );
    return runs.map((run) => (run === name ? { ...run, endCandidate: classification.startCandidate - 1 } : { ...run }));
  }

  issues.push(
    issue(
      "candidate_identity_overlap_unresolved",
      "Name and creature-classification ownership overlapped in a shape that could not be carved without guessing; source remains preserved for later verification.",
      name.startCandidate,
      {
        nameStart: name.startCandidate,
        nameEnd: name.endCandidate,
        classificationStart: classification.startCandidate,
        classificationEnd: classification.endCandidate,
      },
    ),
  );
  return runs.map((run) => ({ ...run }));
}

function removeIdentityTextDuplication(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  runs: readonly CandidateRun[],
  issues: ParseIssue[],
): CandidateRun[] {
  const names = runs.filter((run) => run.classification === "name");
  if (names.length !== 1) return runs.map((run) => ({ ...run }));
  const nameText = candidateRunText(rawSource, candidates, names[0]!).replace(/\s+/gu, " ").trim();
  if (nameText.length === 0) return runs.map((run) => ({ ...run }));

  return runs.map((run) => {
    if (run.classification !== "size_type_alignment") return { ...run };
    const identityText = candidateRunText(rawSource, candidates, run).replace(/\s+/gu, " ").trim();
    if (identityText !== nameText) return { ...run };
    issues.push(
      issue(
        "candidate_duplicate_identity_subtitle_abstained",
        "A proposed size/type/alignment span was text-identical to the uniquely grounded creature name, so semantic subtitle ownership was rejected while the duplicate printed source remains visible as unresolved content.",
        run.startCandidate,
      ),
    );
    return { ...run, classification: "unclassified", field: null };
  });
}

function reclassifySourceProvenUnknownHeaders(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  runs: readonly CandidateRun[],
  issues: ParseIssue[],
): CandidateRun[] {
  const eligible = runs.map((run, index) => {
    if (run.classification !== "header_field" || (run.field !== null && run.field !== "other_header")) return false;
    const text = candidateRunText(rawSource, candidates, run).trim();
    if (text.length === 0) return false;
    if (trustedNamedRuleLineShape(text)) return true;

    const nextRun = runs[index + 1] ?? null;
    return (
      standaloneNamedRuleTitleShape(text) &&
      nextRun !== null &&
      nextRun.startCandidate === run.endCandidate + 1 &&
      (nextRun.classification === "unclassified" || nextRun.classification === "section_content") &&
      candidates[nextRun.startCandidate]?.boundary?.strength === "weak"
    );
  });

  // Title-shaped metadata and a named rule are surface-identical in isolation.
  // Do not override an explicit model-owned unknown header on that evidence
  // alone. Two consecutive independently printed named-rule-shaped header runs,
  // however, are source-proven sequence evidence for an implicit traits region.
  // This catches statblocks that omit a printed Traits heading while preserving
  // a lone localized/custom metadata row as other_header.
  const proven = new Set<number>();
  for (let index = 0; index < runs.length; index += 1) {
    if (!eligible[index]) continue;
    let next = index + 1;
    while (
      next < runs.length &&
      (runs[next]!.classification === "unclassified" || runs[next]!.classification === "section_content") &&
      candidates[runs[next]!.startCandidate]?.boundary?.strength === "weak"
    )
      next += 1;
    if (next < runs.length && eligible[next]) {
      proven.add(index);
      proven.add(next);
    }
  }

  return runs.map((run, index) => {
    if (!proven.has(index)) return { ...run };
    issues.push(
      issue(
        "candidate_named_rule_sequence_removed_from_header",
        "Consecutive source-proven named-rule-shaped unknown header spans were kept as an implicit traits region instead of entering the product header.",
        run.startCandidate,
      ),
    );
    return { ...run, classification: "feature", field: null };
  });
}

function enforceSourceProvenContinuations(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  runs: readonly CandidateRun[],
  issues: ParseIssue[],
  protectedCandidateIndexes: ReadonlySet<number> = new Set<number>(),
): CandidateRun[] {
  if (candidates.length === 0) return runs.map((run) => ({ ...run }));

  type OwnerCell = {
    ownerId: number;
    classification: CandidateRunClassification;
    field: CandidateRun["field"];
  };

  const owners: OwnerCell[] = Array.from({ length: candidates.length }, (_, index) => ({
    ownerId: -(index + 1),
    classification: "unclassified",
    field: null,
  }));
  runs.forEach((run, runIndex) => {
    for (let index = run.startCandidate; index <= run.endCandidate && index < owners.length; index += 1) {
      owners[index] = { ownerId: runIndex + 1, classification: run.classification, field: run.field ?? null };
    }
  });

  const isHeading = (classification: CandidateRunClassification): boolean =>
    classification === "unknown_section_heading" || HEADING_CLASSIFICATIONS[classification] !== undefined;

  // A repeated vertical compact table is also source-proven internal hierarchy.
  // In localized statblocks the six ability rows may be printed as one row per
  // physical line (label + score + modifier). Boundary evidence marks only the
  // first row as the table start and the following rows as internal/hard. If the
  // model mirrors those physical rows into separate header spans, keep them in
  // the already-open header owner. This uses only table geometry; semantic ability
  // identity is still grounded separately through abilityLabels.
  for (let index = 1; index < candidates.length; index += 1) {
    const boundary = candidates[index]?.boundary;
    if (boundary?.scope !== "internal" || boundary.strength !== "hard" || !boundary.evidence.includes("table_shape"))
      continue;

    const previous = owners[index - 1]!;
    const current = owners[index]!;
    if (previous.classification !== "header_field") continue;
    if (!(current.classification === "header_field" || current.classification === "unclassified")) continue;
    if (current.ownerId === previous.ownerId) continue;

    owners[index] = { ...previous };
    issues.push(
      issue(
        "candidate_source_proven_internal_table_closed",
        "A source-proven internal table row remained inside the already-open header table instead of becoming a sibling header span.",
        index,
        { modelClassification: current.classification, evidence: boundary.evidence },
      ),
    );
  }

  // A repeated bullet or ordered sequence introduced by a visible trailing colon is
  // source-proven internal hierarchy. The sequence proves that everything between
  // confirmed markers belongs to the already-open parent feature, even when the
  // model or the named-rule splitter gives each item title its own owner.
  const listGroups = introducedListSequenceStartGroups(rawSource);
  const candidateIndexByStart = new Map(candidates.map((candidate, index) => [candidate.start, index] as const));
  const inlineMarkerOnlyPrefix = (markerIndex: number, nextIndex: number): boolean => {
    const markerStart = candidates[markerIndex]?.start;
    const nextStart = candidates[nextIndex]?.start;
    if (markerStart === undefined || nextStart === undefined || nextStart <= markerStart) return false;
    const prefixSource = rawSource.slice(markerStart, nextStart);
    // The next coordinate may be absorbed as the final list item's title only
    // when it begins on the SAME physical row as a marker-only coordinate.
    // `4.\nNext Feature.` is not proof that Next Feature belongs to item 4;
    // `4. Bisect.` is.  This keeps the repair local and source-geometric.
    if (/[\r\n]/u.test(prefixSource)) return false;
    const prefix = prefixSource.trim();
    return /^(?:(?:[0-9]{1,2}|\p{Lu})[.)]|[-–—+*•◦▪‣])$/u.test(prefix);
  };

  for (const group of listGroups) {
    const markerIndexes = group
      .map((start) => candidateIndexByStart.get(start))
      .filter((index): index is number => index !== undefined)
      .sort((left, right) => left - right);
    if (markerIndexes.length < 2) continue;

    const firstMarkerIndex = markerIndexes[0]!;
    const lastMarkerIndex = markerIndexes[markerIndexes.length - 1]!;
    let parentIndex = firstMarkerIndex - 1;
    while (parentIndex >= 0) {
      const previousBoundary = candidates[parentIndex]?.boundary;
      const previousOwner = owners[parentIndex]!;
      if (previousOwner.classification === "feature") break;
      if (isHeading(previousOwner.classification)) {
        parentIndex = -1;
        break;
      }
      if (
        previousBoundary?.scope === "top_level" &&
        previousBoundary.strength === "hard" &&
        !previousBoundary.evidence.includes("title_shape")
      ) {
        parentIndex = -1;
        break;
      }
      parentIndex -= 1;
    }
    if (parentIndex < 0 || owners[parentIndex]!.classification !== "feature") continue;
    const parent = owners[parentIndex]!;
    const originalLastMarkerOwner = { ...owners[lastMarkerIndex]! };

    let bridgeEnd = lastMarkerIndex;
    for (let index = firstMarkerIndex; index <= lastMarkerIndex; index += 1) {
      const boundary = candidates[index]?.boundary;
      if (
        index !== firstMarkerIndex &&
        boundary?.scope === "top_level" &&
        boundary.strength === "hard" &&
        !boundary.evidence.includes("list_sequence") &&
        !boundary.evidence.includes("title_shape") &&
        !boundary.evidence.includes("sentence_shape")
      ) {
        bridgeEnd = index - 1;
        break;
      }
    }
    if (bridgeEnd < lastMarkerIndex) continue;
    for (let index = firstMarkerIndex; index <= bridgeEnd; index += 1) {
      if (!isHeading(owners[index]!.classification)) owners[index] = { ...parent };
    }

    let tailStart = lastMarkerIndex;
    let tailOwner = originalLastMarkerOwner;
    // Source-proven feature splitting can give the final marker's following
    // item title a new owner before list closure runs.  Once the list sequence
    // itself is proven and the final marker is marker-only, a title beginning
    // on the same physical row is still part of that final item regardless of
    // which temporary owner held the marker before closure.
    if (tailStart + 1 < owners.length && inlineMarkerOnlyPrefix(tailStart, tailStart + 1)) {
      tailStart += 1;
      tailOwner = owners[tailStart]!;
    }
    if (
      !isHeading(tailOwner.classification) &&
      (tailOwner.classification === "feature" ||
        tailOwner.classification === "unclassified" ||
        tailOwner.classification === "section_content")
    ) {
      let tailEnd = tailStart;
      while (tailEnd + 1 < owners.length && owners[tailEnd + 1]!.ownerId === tailOwner.ownerId) tailEnd += 1;
      for (let index = tailStart; index <= tailEnd; index += 1) {
        const boundary = candidates[index]?.boundary;
        if (
          index !== tailStart &&
          boundary?.scope === "top_level" &&
          boundary.strength === "hard" &&
          !boundary.evidence.includes("list_sequence") &&
          !boundary.evidence.includes("title_shape") &&
          !boundary.evidence.includes("sentence_shape")
        ) {
          tailEnd = index - 1;
          break;
        }
      }
      for (let index = tailStart; index <= tailEnd; index += 1) owners[index] = { ...parent };
    }

    issues.push(
      issue(
        "candidate_source_proven_internal_list_closed",
        "A source-proven introduced list sequence remained inside its parent feature across item markers and item-title owners.",
        firstMarkerIndex,
        { parentCandidate: parentIndex, firstMarkerCandidate: firstMarkerIndex, lastMarkerCandidate: lastMarkerIndex },
      ),
    );
  }

  // Strong continuation is source-shape evidence, not a semantic guess. It may
  // close an already-open feature/header interval, but it may not erase a model-
  // identified section heading or invent a semantic field. Each model run keeps
  // its own identity; matching classifications never merge by themselves.
  for (let index = 1; index < candidates.length; index += 1) {
    const boundary = candidates[index]?.boundary;
    if (boundary?.strength !== "weak" || boundary.continuationStrength !== "strong") continue;

    const current = owners[index]!;
    if (isHeading(current.classification)) continue;

    // A dense multilingual lattice can contain weak coordinate-only cells
    // between the owning block and the row that carries strong continuation
    // evidence. Walk backward across only those weak/unclassified cells; stop
    // at any independently positive boundary. This closes the whole bounded
    // continuation interval without deleting useful candidate coordinates.
    let previousIndex = index - 1;
    while (previousIndex >= 0 && previousIndex >= index - 4) {
      const previousBoundary = candidates[previousIndex]?.boundary;
      const previousOwner = owners[previousIndex]!;
      if (previousOwner.classification !== "unclassified") break;
      if (previousBoundary?.scope === "top_level" && previousBoundary.strength !== "weak") {
        previousIndex = -1;
        break;
      }
      if (previousBoundary?.scope === "internal" && previousBoundary.strength === "hard") {
        previousIndex = -1;
        break;
      }
      previousIndex -= 1;
    }
    if (previousIndex < 0) continue;
    const previous = owners[previousIndex]!;
    const featureContinuation =
      previous.classification === "feature" &&
      (current.classification === "feature" ||
        current.classification === "unclassified" ||
        current.classification === "section_content");
    const independentHeaderStart =
      boundary.scope === "top_level" &&
      boundary.strength !== "weak" &&
      boundary.evidence.some((kind) => kind === "compact_metadata" || kind === "table_shape");
    const relationalHeaderContinuation = boundary.continuationEvidence.some(
      (kind) => kind === "previous_line_trailing_separator" || kind === "leading_bracket_line_start",
    );
    const headerContinuation =
      previous.classification === "header_field" &&
      !independentHeaderStart &&
      (current.classification === "unclassified" ||
        current.classification === "feature" ||
        current.classification === "section_content" ||
        (current.classification === "header_field" && relationalHeaderContinuation));
    if (!featureContinuation && !headerContinuation) continue;

    for (let bridge = previousIndex + 1; bridge <= index; bridge += 1) owners[bridge] = { ...previous };
    issues.push(
      issue(
        "candidate_source_proven_continuation_closed",
        "A weak candidate with strong source-shape continuation evidence closed a bounded weak coordinate interval into the nearest compatible owner.",
        index,
        {
          previousCandidate: previousIndex,
          previousClassification: previous.classification,
          modelClassification: current.classification,
          continuationEvidence: boundary.continuationEvidence,
        },
      ),
    );
  }

  // A feature whose printed name occupies its own physical row still owns the
  // immediately following weak prose rows. Mixed PDF/web copies commonly split
  // `Title.` and its rule text onto separate lines; a weak line coordinate is
  // presentation geometry, not a peer block. Never cross an independently
  // positive boundary or another model-owned feature/header/heading.
  for (let index = 0; index < candidates.length; index += 1) {
    const owner = owners[index]!;
    if (owner.classification !== "feature") continue;
    if (index > 0 && owners[index - 1]!.ownerId === owner.ownerId) continue;
    const start = candidates[index]?.start;
    if (start === undefined) continue;
    let lineEnd = start;
    while (lineEnd < rawSource.length && !/[\r\n]/u.test(rawSource[lineEnd] ?? "")) lineEnd += 1;
    const line = rawSource.slice(start, lineEnd).trim();
    if (!standaloneNamedRuleTitleShape(line)) continue;

    let changed = false;
    for (let cursor = index + 1; cursor < candidates.length; cursor += 1) {
      const boundary = candidates[cursor]?.boundary;
      const current = owners[cursor]!;
      if (boundary?.scope === "top_level" && boundary.strength !== "weak") break;
      if (boundary?.scope === "internal" && boundary.strength === "hard") break;
      if (!(current.classification === "unclassified" || current.classification === "section_content")) break;
      owners[cursor] = { ...owner };
      changed = true;
    }
    if (changed) {
      issues.push(
        issue(
          "candidate_standalone_feature_body_closed",
          "Weak prose rows immediately following a standalone printed feature title were kept inside that feature.",
          index,
        ),
      );
    }
  }

  // Ownership protection is stronger than every deterministic continuation
  // heuristic. Even if a weak-shape repair temporarily looked through one of
  // these coordinates, restore it as an isolated unclassified barrier before
  // materializing runs so BODY can never annex accepted Header source.
  for (const index of protectedCandidateIndexes) {
    if (index < 0 || index >= owners.length) continue;
    owners[index] = { ownerId: -(owners.length + index + 1), classification: "unclassified", field: null };
  }

  const output: CandidateRun[] = [];
  let startCandidate = 0;
  for (let index = 1; index <= owners.length; index += 1) {
    if (index < owners.length && owners[index]!.ownerId === owners[index - 1]!.ownerId) continue;
    const owner = owners[index - 1]!;
    output.push({
      classification: owner.classification,
      field: owner.field ?? null,
      startCandidate,
      endCandidate: index - 1,
    });
    startCandidate = index;
  }
  return output;
}

export function candidateResponseToDirectResponse(
  rawSource: string,
  sourceMap: LosslessSourceMap,
  sourceCandidates: readonly SourceCandidate[],
  parsed: ParsedCandidateModelResponse,
  options: CandidateTransportOptions = {},
): {
  response: import("./modelSchema.js").ParsedModelResponse;
  issues: ParseIssue[];
  debug: CandidateTransportDebug;
} {
  const issues: ParseIssue[] = [];
  const sorted = [...parsed.runs].sort(
    (a, b) => a.startCandidate - b.startCandidate || a.endCandidate - b.endCandidate,
  );
  const ordered: CandidateRun[] = [];

  // An exact-span contradiction is a model uncertainty signal, not a reason to
  // let whichever JSON item happened to come first own the source. Preserve the
  // range once as unclassified; a human/Auto Style may repair presentation later.
  for (let index = 0; index < sorted.length;) {
    const first = sorted[index]!;
    const sameSpan: CandidateRun[] = [first];
    index += 1;
    while (
      index < sorted.length &&
      sorted[index]!.startCandidate === first.startCandidate &&
      sorted[index]!.endCandidate === first.endCandidate
    ) {
      sameSpan.push(sorted[index]!);
      index += 1;
    }
    const classifications = new Set(sameSpan.map((run) => run.classification));
    if (classifications.size > 1) {
      ordered.push({
        classification: "unclassified",
        startCandidate: first.startCandidate,
        endCandidate: first.endCandidate,
        field: null,
      });
      issues.push(
        issue(
          "candidate_structural_exact_conflict_abstained",
          "The structural model assigned incompatible meanings to the same exact candidate span; the span was preserved once as unclassified instead of choosing one meaning by output order.",
          first.startCandidate,
          {
            startCandidate: first.startCandidate,
            endCandidate: first.endCandidate,
            classifications: [...classifications],
          },
        ),
      );
    } else {
      ordered.push(first);
    }
  }

  // Resolve the one proof-safe identity overlap before generic partitioning.
  // Otherwise the later classification run is discarded as an overlap before
  // the dedicated trailing-tail carve can inspect both claims.
  const identityReconciled = carveTrailingClassificationFromName(ordered, issues);

  let partition: CandidateRun[] = [];
  let cursor = 0;

  for (const run of identityReconciled) {
    if (run.startCandidate < cursor) {
      issues.push(
        issue(
          "candidate_structural_overlap_rejected",
          "An overlapping structural span was rejected; structural ownership already belongs to an earlier span.",
          run.startCandidate,
          { startCandidate: run.startCandidate, endCandidate: run.endCandidate, cursor },
        ),
      );
      continue;
    }
    if (run.startCandidate > cursor) {
      partition.push({
        classification: "unclassified",
        startCandidate: cursor,
        endCandidate: run.startCandidate - 1,
        field: null,
      });
      issues.push(
        issue(
          "candidate_structural_gap_preserved",
          "A structural-model gap was preserved explicitly as unclassified source instead of being semantically repaired.",
          cursor,
          { startCandidate: cursor, endCandidate: run.startCandidate - 1 },
        ),
      );
    }
    partition.push({ ...run });
    cursor = run.endCandidate + 1;
  }
  if (cursor < sourceCandidates.length) {
    partition.push({
      classification: "unclassified",
      startCandidate: cursor,
      endCandidate: sourceCandidates.length - 1,
      field: null,
    });
    issues.push(
      issue(
        "candidate_structural_gap_preserved",
        "A trailing structural-model gap was preserved explicitly as unclassified source instead of being semantically repaired.",
        cursor,
        { startCandidate: cursor, endCandidate: sourceCandidates.length - 1 },
      ),
    );
  }

  partition = removeIdentityTextDuplication(rawSource, sourceCandidates, partition, issues);
  partition = reclassifySourceProvenUnknownHeaders(rawSource, sourceCandidates, partition, issues);

  if (options.enforceSourceProvenFeatureBoundaries === true) {
    const enforced = enforceSourceProvenFeatureBoundaries(rawSource, sourceCandidates, partition);
    partition = enforced.runs;
    issues.push(...enforced.issues);
  }

  partition = enforceSourceProvenContinuations(
    rawSource,
    sourceCandidates,
    partition,
    issues,
    new Set(options.protectedCandidateIndexes ?? []),
  );

  // A structural header span does not need an English/deterministic subtype.
  // Localized and homebrew headers are valid `header_field` ownership when the
  // model grounds them to source candidates. Critical semantic fields are
  // verified separately below; transport must not reinterpret an unknown
  // header as a feature merely because its surface text looks title-like.

  // Card-fact verification is evidence only.  It may refine the semantic label
  // of an already-owned header span, but may never create, resize or move one.
  const verifiedField = new Map<string, import("./domain.js").HeaderField>();
  for (const fact of parsed.essentialFacts ?? []) {
    const field =
      fact.kind === "name"
        ? "name"
        : fact.kind === "size_type_alignment"
          ? "size_type_alignment"
          : fact.kind === "armor_class"
            ? "armor_class"
            : fact.kind === "initiative"
              ? "initiative"
              : fact.kind === "hit_points"
                ? "hit_points"
                : fact.kind === "ability_scores"
                  ? "ability_scores"
                  : fact.kind === "saving_throws"
                    ? "saving_throws"
                    : fact.kind === "challenge"
                      ? "challenge"
                      : "proficiency_bonus";
    verifiedField.set(`${fact.startCandidate}:${fact.endCandidate}`, field);
  }

  const content = contentUnits(sourceMap);
  const unitIndexById = new Map(content.map((unit, index) => [unit.id, index] as const));
  const candidates: import("./modelSchema.js").ParsedModelResponse["candidates"] = [];
  let activeSection: StatblockSection | null = "traits";

  function rangeFor(run: CandidateRun): { startUnitId: string; endUnitId: string; text: string } | null {
    const start = sourceCandidates[run.startCandidate];
    const next = sourceCandidates[run.endCandidate + 1] ?? null;
    if (start === undefined) return null;
    const startIndex = unitIndexById.get(start.startUnitId);
    if (startIndex === undefined) return null;
    let endIndex = content.length - 1;
    if (next !== null) {
      const nextIndex = unitIndexById.get(next.startUnitId);
      if (nextIndex !== undefined) endIndex = nextIndex - 1;
    }
    if (endIndex < startIndex) return null;
    const startUnit = content[startIndex]!;
    const endUnit = content[endIndex]!;
    return { startUnitId: startUnit.id, endUnitId: endUnit.id, text: rawSource.slice(startUnit.start, endUnit.end) };
  }

  for (const run of partition) {
    const headingSection = HEADING_CLASSIFICATIONS[run.classification];
    if (headingSection !== undefined) activeSection = headingSection;
    if (run.classification === "unknown_section_heading") {
      // A printed section boundary is structurally proven, but its language-
      // dependent semantic identity is unknown. Multiline mode preserves that
      // structural object explicitly with section:null; mixed/singleline leave
      // it unresolved because their body structure itself is model-reconstructed.
      activeSection = null;
      if (options.preserveUnknownSectionStructure === true) {
        const range = rangeFor(run);
        if (range !== null) {
          candidates.push({
            candidateIndex: run.startCandidate,
            annotation: {
              role: "section_heading",
              section: null,
              startUnitId: range.startUnitId,
              endUnitId: range.endUnitId,
            },
            provenance: "deterministic_section_heading",
          });
        }
      }
      continue;
    }
    if (run.classification === "unclassified") continue;
    const range = rangeFor(run);
    if (range === null) continue;
    const exactVerified = verifiedField.get(`${run.startCandidate}:${run.endCandidate}`) ?? null;
    let annotation: import("./modelSchema.js").ModelAnnotation;

    if (run.classification === "name") {
      annotation = { role: "header_field", field: "name", startUnitId: range.startUnitId, endUnitId: range.endUnitId };
    } else if (run.classification === "size_type_alignment") {
      annotation = {
        role: "header_field",
        field: "size_type_alignment",
        startUnitId: range.startUnitId,
        endUnitId: range.endUnitId,
      };
    } else if (run.classification === "header_field") {
      // A verifier's saving-throw claim is accepted only when the local source
      // has actual printed ability+signed-bonus shape. Semantic field identity
      // comes from the model/verifier; deterministic code validates only shape.
      const hasPrintedSaveShape = looksLikeGroundedPrintedSaveField(range.text, parsed.abilityLabels);
      const safeVerified = exactVerified === "saving_throws" && !hasPrintedSaveShape ? null : exactVerified;
      const modelField = run.field === "other_header" ? null : run.field;
      annotation = {
        role: "header_field",
        field:
          safeVerified ?? modelField ?? (hasPrintedSaveShape ? "saving_throws" : null) ?? run.field ?? "other_header",
        startUnitId: range.startUnitId,
        endUnitId: range.endUnitId,
      };
    } else if (run.classification === "body_metadata" || run.classification === "body_paragraph") {
      // Ownership-first BODY paragraphs are deliberately semantically neutral.
      // Mixed mode only asks the model for logical boundaries plus the binary
      // distinction "printed section heading vs ordinary paragraph". Metadata,
      // features, section rules and other paragraph subtypes are not model tasks.
      annotation = {
        role: "section_content",
        section: null,
        startUnitId: range.startUnitId,
        endUnitId: range.endUnitId,
      };
    } else if (headingSection !== undefined) {
      annotation = {
        role: "section_heading",
        section: headingSection,
        startUnitId: range.startUnitId,
        endUnitId: range.endUnitId,
      };
    } else if (
      run.classification === "section_rules" ||
      run.classification === "feature" ||
      run.classification === "section_content"
    ) {
      if (activeSection === null && options.preserveUnknownSectionStructure !== true) {
        issues.push(
          issue(
            "candidate_section_semantics_unresolved",
            "Content after a model-proven section boundary with unresolved semantic identity remained unclassified instead of inheriting or guessing a section.",
            run.startCandidate,
            { classification: run.classification },
          ),
        );
        continue;
      }
      annotation =
        run.classification === "section_rules"
          ? {
              role: "section_rules",
              section: activeSection,
              startUnitId: range.startUnitId,
              endUnitId: range.endUnitId,
            }
          : run.classification === "feature"
            ? { role: "feature", section: activeSection, startUnitId: range.startUnitId, endUnitId: range.endUnitId }
            : {
                role: "section_content",
                section: activeSection,
                startUnitId: range.startUnitId,
                endUnitId: range.endUnitId,
              };
    } else {
      annotation = { role: "supplementary", startUnitId: range.startUnitId, endUnitId: range.endUnitId };
    }
    candidates.push({ candidateIndex: run.startCandidate, annotation, provenance: "model_span" });
  }

  const covered = new Set<number>();
  for (const run of partition)
    for (let index = run.startCandidate; index <= run.endCandidate; index += 1) covered.add(index);
  const debug: CandidateTransportDebug = {
    transport: "candidate_spans",
    status: parsed.issues.some((currentIssue) => /envelope/u.test(currentIssue.message))
      ? "response_invalid"
      : "processed",
    modelError: null,
    candidateCount: sourceCandidates.length,
    runCount: partition.length,
    coveredCandidateCount: covered.size,
    unclassifiedRunCount: partition.filter(
      (run) =>
        run.classification === "unclassified" ||
        (run.classification === "unknown_section_heading" && options.preserveUnknownSectionStructure !== true),
    ).length,
    runs: partition.map((run) => ({
      startCandidate: run.startCandidate,
      endCandidate: run.endCandidate,
      startId: `C${String(run.startCandidate).padStart(3, "0")}`,
      endId: `C${String(run.endCandidate).padStart(3, "0")}`,
      classification: run.classification,
      runLength: run.endCandidate - run.startCandidate + 1,
      startPreview: sourceCandidates[run.startCandidate]?.preview ?? "",
      endPreview: sourceCandidates[run.endCandidate]?.preview ?? "",
      accepted:
        run.classification !== "unclassified" &&
        (run.classification !== "unknown_section_heading" || options.preserveUnknownSectionStructure === true),
      acceptedRole: null,
      acceptedField: null,
      acceptedSection: null,
    })),
  };
  return { response: { candidates, returnedCandidateCount: parsed.returnedCandidateCount, issues: [] }, issues, debug };
}
