import type {
  AbilityKey,
  CompiledAnnotation,
  DocumentBlock,
  LosslessSourceMap,
  LosslessStatblockDocument,
  ModelRunSummary,
  NormalizedView,
  ParseIssue,
  SectionView,
  StatblockSection,
} from "./domain.js";

import { ABILITY_KEYS } from "./domain.js";
import { findDeterministicHeaderStarts } from "./headerClassifier.js";
import { compactMetadataLineShape } from "./surfaceStructure.js";

import type { ModelAnnotation, ParsedModelResponse } from "./modelSchema.js";

import { reconstructLosslessSource, validateLosslessSourceMap } from "./losslessSource.js";

type ResolvedCandidate = {
  candidateIndex: number;
  annotation: ModelAnnotation;
  provenance: CompiledAnnotation["provenance"];
  startUnitIndex: number;
  endUnitIndex: number;
  start: number;
  end: number;
  text: string;
};

function issue(
  code: string,
  severity: ParseIssue["severity"],
  message: string,
  candidateIndex: number | null,
  details: Record<string, unknown> = {},
): ParseIssue {
  return {
    code,
    severity,
    message,
    candidateIndex,
    details,
  };
}

function annotationField(annotation: ModelAnnotation): CompiledAnnotation["field"] {
  return annotation.role === "header_field" ? annotation.field : null;
}

function annotationSection(annotation: ModelAnnotation): CompiledAnnotation["section"] {
  return "section" in annotation ? annotation.section : null;
}

function resolveCandidates(
  rawSource: string,
  sourceMap: LosslessSourceMap,
  candidates: ParsedModelResponse["candidates"],
  issues: ParseIssue[],
): ResolvedCandidate[] {
  const unitIndexById = new Map(sourceMap.units.map((unit, index) => [unit.id, index] as const));

  const resolved: ResolvedCandidate[] = [];

  for (const candidate of candidates) {
    const annotation = candidate.annotation;

    const startUnitIndex = unitIndexById.get(annotation.startUnitId);

    const endUnitIndex = unitIndexById.get(annotation.endUnitId);

    if (startUnitIndex === undefined || endUnitIndex === undefined) {
      issues.push(
        issue(
          "unknown_source_unit",
          "warning",
          "The annotation referenced a source unit that does not exist; the candidate was rejected and its source remains unclassified.",
          candidate.candidateIndex,
          {
            startUnitId: annotation.startUnitId,
            endUnitId: annotation.endUnitId,
          },
        ),
      );

      continue;
    }

    if (startUnitIndex > endUnitIndex) {
      issues.push(
        issue(
          "reversed_source_range",
          "warning",
          "The annotation end precedes its start; the candidate was rejected.",
          candidate.candidateIndex,
          {
            startUnitId: annotation.startUnitId,
            endUnitId: annotation.endUnitId,
          },
        ),
      );

      continue;
    }

    let normalizedStartUnitIndex = startUnitIndex;

    let normalizedEndUnitIndex = endUnitIndex;

    while (
      normalizedStartUnitIndex <= normalizedEndUnitIndex &&
      sourceMap.units[normalizedStartUnitIndex].kind === "separator"
    ) {
      normalizedStartUnitIndex += 1;
    }

    while (
      normalizedEndUnitIndex >= normalizedStartUnitIndex &&
      sourceMap.units[normalizedEndUnitIndex].kind === "separator"
    ) {
      normalizedEndUnitIndex -= 1;
    }

    if (normalizedStartUnitIndex > normalizedEndUnitIndex) {
      issues.push(
        issue(
          "separator_only_range",
          "warning",
          "The annotation range contains only source separators; the candidate was rejected.",
          candidate.candidateIndex,
          {
            startUnitId: annotation.startUnitId,
            endUnitId: annotation.endUnitId,
          },
        ),
      );

      continue;
    }

    const startUnit = sourceMap.units[normalizedStartUnitIndex];

    const endUnit = sourceMap.units[normalizedEndUnitIndex];

    const normalizedAnnotation: ModelAnnotation = { ...annotation, startUnitId: startUnit.id, endUnitId: endUnit.id };

    if (normalizedStartUnitIndex !== startUnitIndex || normalizedEndUnitIndex !== endUnitIndex) {
      issues.push(
        issue(
          "separator_boundary_trimmed",
          "info",
          "Whitespace-only boundary units were trimmed inward without changing or discarding source text.",
          candidate.candidateIndex,
          {
            originalStartUnitId: annotation.startUnitId,
            originalEndUnitId: annotation.endUnitId,
            normalizedStartUnitId: startUnit.id,
            normalizedEndUnitId: endUnit.id,
          },
        ),
      );
    }

    const start = startUnit.start;

    const end = endUnit.end;

    const text = rawSource.slice(start, end);

    resolved.push({
      candidateIndex: candidate.candidateIndex,
      annotation: normalizedAnnotation,
      provenance: candidate.provenance ?? "model_span",
      startUnitIndex: normalizedStartUnitIndex,
      endUnitIndex: normalizedEndUnitIndex,
      start,
      end,
      text,
    });
  }

  return resolved;
}

function headerStartIsInsideOpenBracket(text: string, offset: number): boolean {
  const stack: string[] = [];
  const closingFor: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const openings = new Set(Object.keys(closingFor));
  const closings = new Set(Object.values(closingFor));

  for (const char of text.slice(0, offset)) {
    if (openings.has(char)) {
      stack.push(char);
      continue;
    }
    if (!closings.has(char) || stack.length === 0) continue;
    const opening = stack[stack.length - 1];
    if (closingFor[opening] === char) stack.pop();
  }

  return stack.length > 0;
}

function splitGroundedMultiFieldHeaders(
  rawSource: string,
  sourceMap: LosslessSourceMap,
  candidates: readonly ResolvedCandidate[],
  issues: ParseIssue[],
  options: { requireInlineEvidence?: boolean } = {},
): ResolvedCandidate[] {
  const output: ResolvedCandidate[] = [];
  const unitIndexByStart = new Map(sourceMap.units.map((unit, index) => [unit.start, index] as const));

  for (const candidate of candidates) {
    if (
      candidate.annotation.role !== "header_field" ||
      candidate.annotation.field === "ability_scores" ||
      candidate.annotation.field === "other_header"
    ) {
      output.push(candidate);
      continue;
    }

    const starts = findDeterministicHeaderStarts(candidate.text).filter(
      (start, index) => index === 0 || !headerStartIsInsideOpenBracket(candidate.text, start.offset),
    );
    if (starts.length <= 1 || starts[0].offset !== 0) {
      output.push(candidate);
      continue;
    }

    if (options.requireInlineEvidence === true) {
      const hasInlinePair = starts.some((start, index) => {
        if (index === 0) return false;
        const previous = starts[index - 1];
        return !/[\r\n]/u.test(candidate.text.slice(previous.offset, start.offset));
      });
      if (!hasInlinePair) {
        output.push(candidate);
        continue;
      }
    }

    const segments: ResolvedCandidate[] = [];
    let safe = true;
    for (let index = 0; index < starts.length; index += 1) {
      const segmentStart = candidate.start + starts[index].offset;
      const nextStart = index + 1 < starts.length ? candidate.start + starts[index + 1].offset : candidate.end;
      const startUnitIndex = unitIndexByStart.get(segmentStart);
      if (startUnitIndex === undefined) {
        safe = false;
        break;
      }

      let endUnitIndex = startUnitIndex;
      for (let unitIndex = startUnitIndex; unitIndex <= candidate.endUnitIndex; unitIndex += 1) {
        const unit = sourceMap.units[unitIndex];
        if (unit.start >= nextStart) break;
        if (unit.kind === "content") endUnitIndex = unitIndex;
      }
      const startUnit = sourceMap.units[startUnitIndex];
      const endUnit = sourceMap.units[endUnitIndex];
      if (startUnit.kind !== "content" || endUnit.end <= startUnit.start) {
        safe = false;
        break;
      }

      segments.push({
        candidateIndex: candidate.candidateIndex,
        annotation: {
          role: "header_field",
          field: starts[index].field,
          startUnitId: startUnit.id,
          endUnitId: endUnit.id,
        },
        provenance: "deterministic_header_split",
        startUnitIndex,
        endUnitIndex,
        start: startUnit.start,
        end: endUnit.end,
        text: rawSource.slice(startUnit.start, endUnit.end),
      });
    }

    if (!safe || segments.length <= 1) {
      output.push(candidate);
      continue;
    }

    output.push(...segments);
    issues.push(
      issue(
        "multi_field_header_span_split",
        "info",
        "A grounded header span contained multiple independently proven printed header labels and was split losslessly at exact source-unit boundaries.",
        candidate.candidateIndex,
        {
          fields: segments.map((segment) =>
            segment.annotation.role === "header_field" ? segment.annotation.field : null,
          ),
        },
      ),
    );
  }

  return output;
}

function removeExactDuplicates(candidates: readonly ResolvedCandidate[], issues: ParseIssue[]): ResolvedCandidate[] {
  const unique: ResolvedCandidate[] = [];

  const seen = new Map<string, number>();

  for (const candidate of candidates) {
    const key = [
      candidate.start,
      candidate.end,
      candidate.annotation.role,
      annotationField(candidate.annotation) ?? "",
      annotationSection(candidate.annotation) ?? "",
    ].join("|");

    const firstCandidateIndex = seen.get(key);

    if (firstCandidateIndex !== undefined) {
      issues.push(
        issue(
          "duplicate_annotation",
          "info",
          "An exact duplicate annotation was ignored without duplicating source ownership.",
          candidate.candidateIndex,
          {
            firstCandidateIndex,
          },
        ),
      );

      continue;
    }

    seen.set(key, candidate.candidateIndex);

    unique.push(candidate);
  }

  return unique;
}

function rejectOverlaps(candidates: readonly ResolvedCandidate[], issues: ParseIssue[]): ResolvedCandidate[] {
  const conflicted = new Set<number>();

  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
    const first = candidates[firstIndex];

    for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
      const second = candidates[secondIndex];

      const overlaps = first.start < second.end && second.start < first.end;

      if (overlaps) {
        conflicted.add(first.candidateIndex);
        conflicted.add(second.candidateIndex);
      }
    }
  }

  for (const candidateIndex of conflicted) {
    issues.push(
      issue(
        "overlapping_annotations",
        "warning",
        "This annotation overlaps another non-identical annotation. All conflicting ownership claims were rejected instead of choosing one.",
        candidateIndex,
      ),
    );
  }

  return candidates.filter((candidate) => !conflicted.has(candidate.candidateIndex));
}

function compileAnnotations(candidates: readonly ResolvedCandidate[]): CompiledAnnotation[] {
  return [...candidates]
    .sort(
      (first, second) =>
        first.start - second.start || first.end - second.end || first.candidateIndex - second.candidateIndex,
    )
    .map((candidate, index) => ({
      id: `annotation-${index}`,
      candidateIndex: candidate.candidateIndex,
      provenance: candidate.provenance,
      role: candidate.annotation.role,
      field: annotationField(candidate.annotation),
      section: annotationSection(candidate.annotation),
      source: {
        startUnitId: candidate.annotation.startUnitId,
        endUnitId: candidate.annotation.endUnitId,
        start: candidate.start,
        end: candidate.end,
      },
      text: candidate.text,
    }));
}

function createBlocks(rawSource: string, annotations: readonly CompiledAnnotation[]): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  function addBlock(kind: DocumentBlock["kind"], start: number, end: number, annotationId: string | null): void {
    if (start === end) {
      return;
    }

    blocks.push({
      id: `block-${blocks.length}`,
      kind,
      start,
      end,
      text: rawSource.slice(start, end),
      annotationId,
    });
  }

  function addGap(start: number, end: number): void {
    if (start === end) {
      return;
    }

    const text = rawSource.slice(start, end);

    addBlock(/^\s+$/u.test(text) ? "separator" : "unclassified", start, end, null);
  }

  let cursor = 0;

  for (const annotation of annotations) {
    addGap(cursor, annotation.source.start);

    addBlock("annotated", annotation.source.start, annotation.source.end, annotation.id);

    cursor = annotation.source.end;
  }

  addGap(cursor, rawSource.length);

  return blocks;
}

export function reconstructBlocks(blocks: readonly DocumentBlock[]): string {
  return blocks.map((block) => block.text).join("");
}

export function validateBlockPartition(rawSource: string, blocks: readonly DocumentBlock[]): boolean {
  if (rawSource.length === 0) {
    return blocks.length === 0;
  }

  if (blocks.length === 0) {
    return false;
  }

  let cursor = 0;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (
      block.id !== `block-${index}` ||
      block.start !== cursor ||
      block.end <= block.start ||
      block.end > rawSource.length ||
      rawSource.slice(block.start, block.end) !== block.text
    ) {
      return false;
    }

    cursor = block.end;
  }

  return cursor === rawSource.length && reconstructBlocks(blocks) === rawSource;
}

function createNormalizedView(
  blocks: readonly DocumentBlock[],
  annotations: readonly CompiledAnnotation[],
): NormalizedView {
  const annotationById = new Map(annotations.map((annotation) => [annotation.id, annotation] as const));

  const sectionViews: SectionView[] = [];

  const sectionByName = new Map<StatblockSection, SectionView>();

  function getSection(section: StatblockSection): SectionView {
    const existing = sectionByName.get(section);

    if (existing !== undefined) {
      return existing;
    }

    const created: SectionView = {
      section,
      headingBlockIds: [],
      rulesBlockIds: [],
      featureBlockIds: [],
      contentBlockIds: [],
      unclassifiedBlockIds: [],
    };

    sectionByName.set(section, created);
    sectionViews.push(created);

    return created;
  }

  const view: NormalizedView = {
    sourceOrderBlockIds: blocks.map((block) => block.id),
    sourceOrderContentBlockIds: [],
    header: {
      fieldBlockIds: [],
      contentBlockIds: [],
      unclassifiedBlockIds: [],
    },
    sections: sectionViews,
    supplementaryBlockIds: [],
    topLevelUnclassifiedBlockIds: [],
  };

  let currentSection: StatblockSection | null = null;

  let sectionSeen = false;

  for (const block of blocks) {
    if (block.kind === "separator") {
      continue;
    }

    view.sourceOrderContentBlockIds.push(block.id);

    if (block.kind === "unclassified") {
      if (currentSection !== null) {
        getSection(currentSection).unclassifiedBlockIds.push(block.id);
      } else if (!sectionSeen) {
        view.header.unclassifiedBlockIds.push(block.id);
      } else {
        view.topLevelUnclassifiedBlockIds.push(block.id);
      }

      continue;
    }

    const annotation = block.annotationId === null ? undefined : annotationById.get(block.annotationId);

    if (annotation === undefined) {
      view.topLevelUnclassifiedBlockIds.push(block.id);
      continue;
    }

    switch (annotation.role) {
      case "header_field":
        view.header.fieldBlockIds.push(block.id);
        break;

      case "header_content":
        view.header.contentBlockIds.push(block.id);
        break;

      case "section_heading": {
        const section = annotation.section;

        if (section === null) {
          view.topLevelUnclassifiedBlockIds.push(block.id);
          break;
        }

        currentSection = section;
        sectionSeen = true;
        getSection(section).headingBlockIds.push(block.id);
        break;
      }

      case "section_rules":
      case "feature":
      case "section_content": {
        const section = annotation.section;

        if (section === null) {
          view.topLevelUnclassifiedBlockIds.push(block.id);
          break;
        }

        currentSection = section;
        sectionSeen = true;

        const sectionView = getSection(section);

        if (annotation.role === "section_rules") {
          sectionView.rulesBlockIds.push(block.id);
        } else if (annotation.role === "feature") {
          sectionView.featureBlockIds.push(block.id);
        } else {
          sectionView.contentBlockIds.push(block.id);
        }

        break;
      }

      case "supplementary":
        view.supplementaryBlockIds.push(block.id);
        break;
    }
  }

  return view;
}

export function rebuildDocumentFromAnnotations(
  document: LosslessStatblockDocument,
  annotations: readonly CompiledAnnotation[],
  extraIssues: readonly ParseIssue[] = [],
): LosslessStatblockDocument {
  const normalizedAnnotations = [...annotations]
    .sort(
      (a, b) => a.source.start - b.source.start || a.source.end - b.source.end || a.candidateIndex - b.candidateIndex,
    )
    .map((annotation, index) => ({ ...annotation, id: `annotation-${index}` }));

  const blocks = createBlocks(document.rawSource, normalizedAnnotations);
  const integrity = {
    ...document.integrity,
    blockPartitionValid: validateBlockPartition(document.rawSource, blocks),
    reconstructsRawSource: reconstructBlocks(blocks) === document.rawSource,
  };

  return {
    ...document,
    annotations: normalizedAnnotations,
    blocks,
    view: createNormalizedView(blocks, normalizedAnnotations),
    integrity,
    issues: [...document.issues, ...extraIssues],
  };
}

function looksLikeCompactClassificationLine(text: string): boolean {
  const line = text.replace(/\s+/gu, " ").trim();
  if (line.length < 3 || line.length > 120) return false;
  if (/[.!?]$/u.test(line) || /^[-+*•]/u.test(line)) return false;
  const words = line.match(/[\p{L}\p{N}'’_-]+/gu) ?? [];
  if (words.length < 2 || words.length > 14) return false;
  // Identity classification rows are compact descriptive metadata, commonly
  // exposing comma/parenthetical structure but not sentence prose. No size,
  // type, alignment, or language vocabulary is required here.
  return /[,;]/u.test(line) || /\([^\r\n]{1,64}\)/u.test(line);
}
const SAFE_WRAPPED_LABEL_FIELDS = new Set([
  "armor_class",
  "initiative",
  "hit_points",
  "speed",
  "saving_throws",
  "skills",
  "damage_vulnerabilities",
  "damage_resistances",
  "damage_immunities",
  "condition_immunities",
  "senses",
  "languages",
  "habitat",
  "challenge",
  "experience_points",
  "proficiency_bonus",
]);

function reconcileHeaderAnnotations(
  annotations: readonly CompiledAnnotation[],
  issues: ParseIssue[],
): CompiledAnnotation[] {
  return annotations.map((annotation) => {
    if (
      annotation.role !== "header_field" ||
      annotation.field === "ability_scores" ||
      annotation.field === "other_header"
    ) {
      return annotation;
    }

    const nonEmptyLines = annotation.text.split(/\r\n|\n|\r/gu).filter((line) => line.trim().length > 0);

    if (nonEmptyLines.length <= 1 || annotation.field === "size_type_alignment") {
      return annotation;
    }

    const laterStartsAnotherField = findDeterministicHeaderStarts(annotation.text).some(
      (start) => start.offset > 0 && !headerStartIsInsideOpenBracket(annotation.text, start.offset),
    );
    const isSafeWrappedName =
      annotation.field === "name" &&
      !laterStartsAnotherField &&
      !nonEmptyLines.slice(1).some((line) => looksLikeCompactClassificationLine(line));
    const laterLooksLikeIndependentMetadata = nonEmptyLines.slice(1).some((line) => compactMetadataLineShape(line));
    const semanticNumericListWrap =
      (annotation.field === "saving_throws" || annotation.field === "skills") &&
      !/\d/u.test(nonEmptyLines[0] ?? "") &&
      nonEmptyLines.slice(1).every((line) => /[+\-−–—]\s*\d/u.test(line));
    const isSafeWrappedLabelledField =
      annotation.field !== null &&
      SAFE_WRAPPED_LABEL_FIELDS.has(annotation.field) &&
      !laterStartsAnotherField &&
      (!laterLooksLikeIndependentMetadata || semanticNumericListWrap);

    if (isSafeWrappedName || isSafeWrappedLabelledField) return annotation;

    issues.push(
      issue(
        "multirow_header_field",
        "warning",
        "A specific header field spans multiple non-empty source lines. Its exact text was preserved as header content, but its narrower field label was withdrawn because adjacent logical fields may have been combined.",
        annotation.candidateIndex,
        {
          field: annotation.field,
          nonEmptyLineCount: nonEmptyLines.length,
        },
      ),
    );

    return { ...annotation, provenance: "deterministic_header_uncertainty", role: "header_content", field: null };
  });
}

export type CompileDocumentInput = {
  rawSource: string;
  sourceMap: LosslessSourceMap;
  candidates: ParsedModelResponse["candidates"];
  initialIssues?: ParseIssue[];
  model: ModelRunSummary;
  preserveStructuralOwnership?: boolean;
};

export function compileLosslessDocument(input: CompileDocumentInput): LosslessStatblockDocument {
  if (!validateLosslessSourceMap(input.rawSource, input.sourceMap)) {
    throw new Error("Cannot compile annotations against an invalid source map.");
  }

  const issues = [...(input.initialIssues ?? [])];

  const resolved = resolveCandidates(input.rawSource, input.sourceMap, input.candidates, issues);

  // Candidate spans are already grounded structural ownership. The compiler may
  // validate them, but it must not resize/split them using a language lexicon.
  // Legacy quote-based callers still use the older deterministic splitter.
  const splitHeaders = input.preserveStructuralOwnership
    ? resolved
    : splitGroundedMultiFieldHeaders(input.rawSource, input.sourceMap, resolved, issues);

  const unique = removeExactDuplicates(splitHeaders, issues);

  const nonOverlapping = rejectOverlaps(unique, issues);

  const modelAnnotations = compileAnnotations(nonOverlapping);

  // Candidate coordinates already define structural ownership. On the direct
  // path, header heuristics may enrich facts later but must not resize or move
  // structural spans. Legacy quote fixtures retain the older reconciliation.
  const annotations = input.preserveStructuralOwnership
    ? modelAnnotations
    : reconcileHeaderAnnotations(modelAnnotations, issues);

  const blocks = createBlocks(input.rawSource, annotations);

  const blockPartitionValid = validateBlockPartition(input.rawSource, blocks);

  const reconstructsRawSource = reconstructBlocks(blocks) === input.rawSource;

  if (!blockPartitionValid || !reconstructsRawSource) {
    throw new Error("Application-created document blocks failed lossless integrity validation.");
  }

  const model: ModelRunSummary = {
    ...input.model,
    acceptedAnnotationCount: annotations.length,
    acceptedModelAnnotationCount: annotations.filter(
      (annotation) =>
        annotation.provenance === "model_span" ||
        annotation.provenance === "deterministic_section_ownership" ||
        annotation.provenance === "deterministic_header_continuation" ||
        annotation.provenance === "deterministic_header_uncertainty" ||
        annotation.provenance === "deterministic_header_split",
    ).length,
    deterministicAnnotationCount: annotations.filter(
      (annotation) =>
        annotation.provenance === "deterministic_section_heading" ||
        annotation.provenance === "deterministic_region_gap",
    ).length,
    rejectedCandidateCount: Math.max(
      0,
      input.model.returnedCandidateCount -
        input.model.suppressedDuplicateCandidateCount -
        annotations.filter(
          (annotation) =>
            annotation.provenance === "model_span" ||
            annotation.provenance === "deterministic_section_ownership" ||
            annotation.provenance === "deterministic_header_continuation" ||
            annotation.provenance === "deterministic_header_uncertainty" ||
            annotation.provenance === "deterministic_header_split",
        ).length,
    ),
  };

  return {
    formatVersion: "lossless-statblock-v1",
    rawSource: input.rawSource,
    sourceMap: input.sourceMap,
    annotations,
    blocks,
    view: createNormalizedView(blocks, annotations),
    structuredHeader: {
      abilities: Object.fromEntries(ABILITY_KEYS.map((ability) => [ability, null])) as Record<AbilityKey, null>,
      savingThrows: [],
      proficiencyBonus: null,
    },
    model,
    integrity: {
      sourceMapValid: validateLosslessSourceMap(input.rawSource, input.sourceMap),
      blockPartitionValid,
      reconstructsRawSource: reconstructLosslessSource(input.sourceMap) === input.rawSource && reconstructsRawSource,
    },
    issues,
  };
}
