import { sequentialListLineIndexes } from "./listSequence.js";
import {
  collapsedNamedRuleLeadAt,
  compactMetadataLineShape,
  compactStandaloneHeadingShape,
  trustedNamedRuleLineShape,
  verticalScoreModifierCellShape,
} from "./surfaceStructure.js";

export const PARSER_MODES = ["auto", "multiline", "singleline", "generic"] as const;

export type ParserMode = (typeof PARSER_MODES)[number];
export type ResolvedParserMode = Exclude<ParserMode, "auto">;
export type DetectedParserStructure = "multiline" | "singleline" | "mixed";

export type ParserRoutingSignal = {
  code: string;
  weight: number;
  detail: string;
};

export type ParserRoutingDecision = {
  requestedMode: ParserMode;
  selectedMode: ResolvedParserMode;
  detectedStructure: DetectedParserStructure | null;
  confidence: number;
  multilineScore: number;
  singlelineScore: number;
  signals: ParserRoutingSignal[];
};

function normalizedLines(rawSource: string): string[] {
  return rawSource
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/gu, " ").trim())
    .filter((line) => line.length > 0);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function genericFeatureAnchorPositions(line: string): number[] {
  const boundaries = new Set<number>([0]);
  for (let index = 0; index < line.length; index += 1) {
    if (!/[.!?]/u.test(line[index] ?? "")) continue;
    let next = index + 1;
    while (next < line.length && /\s/u.test(line[next] ?? "")) next += 1;
    if (next < line.length) boundaries.add(next);
  }

  const positions: number[] = [];
  for (const start of [...boundaries].sort((a, b) => a - b)) {
    if (collapsedNamedRuleLeadAt(line, start) !== null) positions.push(start);
  }
  return [...new Set(positions)];
}

type LineObservation = {
  line: string;
  index: number;
  metadata: boolean;
  verticalCell: boolean;
  standalone: boolean;
  startsFeature: boolean;
  featureAnchorPositions: number[];
  isolatedStructural: boolean;
  collapsedStrong: boolean;
  collapsedAnchorCount: number;
  detail: string | null;
};

function observeLine(line: string, index: number, internalListItem: boolean): LineObservation {
  const metadata = !internalListItem && compactMetadataLineShape(line);
  const verticalCell = !internalListItem && verticalScoreModifierCellShape(line);
  const standalone = !internalListItem && compactStandaloneHeadingShape(line);
  const startsFeature = !internalListItem && trustedNamedRuleLineShape(line);
  const featureAnchorPositions = internalListItem ? [] : genericFeatureAnchorPositions(line);

  const isolatedFeature = startsFeature && featureAnchorPositions.filter((position) => position > 0).length === 0;
  const isolatedStructural = !internalListItem && (metadata || verticalCell || standalone || isolatedFeature);

  // Multiple named-rule anchors on one physical row are strong evidence that
  // source structures were flattened together. This is language-neutral and
  // intentionally does not require recognizing header or section vocabulary.
  const collapsedAnchorCount = featureAnchorPositions.filter((position) => position > 0).length;
  const collapsedStrong = !internalListItem && collapsedAnchorCount >= 1;
  const detail = collapsedStrong
    ? `${line.length} chars; ${featureAnchorPositions.length} compact named-rule anchors share one physical line.`
    : null;

  return {
    line,
    index,
    metadata,
    verticalCell,
    standalone,
    startsFeature,
    featureAnchorPositions,
    isolatedStructural,
    collapsedStrong,
    collapsedAnchorCount,
    detail,
  };
}

function longestRun(observations: LineObservation[], predicate: (entry: LineObservation) => boolean): number {
  let best = 0;
  let current = 0;
  for (const observation of observations) {
    if (predicate(observation)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function chooseFallbackByGeometry(lines: string[]): "multiline" | "singleline" {
  if (lines.length <= 1) return "singleline";
  const lengths = lines.map((line) => line.length).sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)] ?? 0;
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const max = lengths[lengths.length - 1] ?? 0;
  const concentration = total > 0 ? max / total : 0;
  if (lines.length <= 3 && (median >= 180 || max >= 320 || concentration >= 0.72)) return "singleline";
  return "multiline";
}

export function detectParserStructure(rawSource: string, requestedMode: ParserMode = "auto"): ParserRoutingDecision {
  if (requestedMode !== "auto") {
    return {
      requestedMode,
      selectedMode: requestedMode,
      detectedStructure: null,
      confidence: 1,
      multilineScore: 0,
      singlelineScore: 0,
      signals: [{ code: "manual_override", weight: 0, detail: `Parser mode selected manually: ${requestedMode}.` }],
    };
  }

  const lines = normalizedLines(rawSource);
  const internalListLines = sequentialListLineIndexes(lines);
  const observations = lines.map((line, index) => observeLine(line, index, internalListLines.has(index)));
  const meaningfulLineCount = lines.length;

  const metadataLines = observations.filter((entry) => entry.metadata).length;
  const verticalCells = observations.filter((entry) => entry.verticalCell).length;
  const isolatedFeatureLines = observations.filter((entry) => entry.startsFeature && entry.isolatedStructural).length;
  const isolatedStandaloneLines = observations.filter((entry) => entry.standalone).length;
  const isolatedStructuralLines = observations.filter((entry) => entry.isolatedStructural).length;
  const cleanMetadataRun = longestRun(observations, (entry) => entry.metadata || entry.verticalCell);
  const cleanStructuralRun = longestRun(observations, (entry) => entry.isolatedStructural);
  const collapsedLines = observations.filter((entry) => entry.collapsedStrong);

  let softWrappedContinuationLines = 0;
  let wrappedStructureContinuationLines = 0;
  // Visual wrapping can occur anywhere after compact metadata, and a body rule
  // can itself superficially resemble metadata (for example when its title has
  // numeric parenthetical information). Do not search for a semantic "last
  // header" here: routing is geometry-only. Scan every physical adjacency and
  // let positive structural rows opt themselves out below.
  for (let index = 1; index < lines.length; index += 1) {
    const current = lines[index]!;
    const previous = lines[index - 1]!;
    const observation = observations[index]!;
    if (observation.isolatedStructural || internalListLines.has(index)) continue;
    if (/^(?:[0-9]{1,2}|[\p{Lu}])[.)][ \t]+/u.test(current)) continue;
    const firstLetter = current.match(/\p{L}/u)?.[0] ?? null;
    const startsLowercase =
      firstLetter !== null &&
      firstLetter.toLocaleLowerCase() !== firstLetter.toLocaleUpperCase() &&
      firstLetter === firstLetter.toLocaleLowerCase();
    const startsUncased = firstLetter !== null && firstLetter.toLocaleLowerCase() === firstLetter.toLocaleUpperCase();
    const previousLooksOpen = !/[.!?:]$/u.test(previous);
    // Lowercase continuation is strong visual-wrap geometry for cased scripts only
    // when the row is substantive enough to be prose. Tiny lowercase table-cell
    // labels (for example copied column headings) are not evidence that the whole
    // document lost its physical structure. For uncased scripts, also require an
    // open previous row and a longer substantive continuation row. An open
    // previous row alone is too weak: ordinary metadata labels often omit
    // sentence punctuation in every language.
    const looksLikeVisualContinuation =
      (startsLowercase && current.trim().length >= 8) ||
      (startsUncased && previousLooksOpen && current.trim().length >= 20);
    if (looksLikeVisualContinuation) {
      softWrappedContinuationLines += 1;
    }

    // A logical named rule whose prose visibly continues onto the next physical
    // row is enough to make line geometry untrustworthy for deterministic body
    // parsing. This is deliberately language-neutral: it relies on the already
    // proven named-rule surface shape plus an open physical row, not on section
    // or rules vocabulary. The production pipeline deliberately routes the full
    // raw source, so this signal must stay geometry-only and rely on the
    // structural exclusions above instead of assuming Header rows were removed.
    const previousObservation = observations[index - 1]!;
    if (previousObservation.startsFeature && previousLooksOpen && !observation.isolatedStructural) {
      wrappedStructureContinuationLines += 1;
    }
  }
  const softWrapRatio = meaningfulLineCount > 0 ? softWrappedContinuationLines / meaningfulLineCount : 0;
  const hasStrongSoftWrapRegion = softWrappedContinuationLines >= 4 && softWrapRatio >= 0.08;
  const hasWrappedStructureRegion = wrappedStructureContinuationLines >= 1;

  const isolatedAnchorCount = isolatedStructuralLines;
  const collapsedAnchorCount = observations.reduce((sum, entry) => sum + entry.collapsedAnchorCount, 0);
  const totalShapeAnchors = isolatedAnchorCount + collapsedAnchorCount;
  const isolatedRatio = totalShapeAnchors > 0 ? isolatedAnchorCount / totalShapeAnchors : 0;

  let multilineScore = 0;
  let singlelineScore = 0;
  const signals: ParserRoutingSignal[] = [];
  const addMulti = (code: string, weight: number, detail: string) => {
    multilineScore += weight;
    signals.push({ code, weight, detail });
  };
  const addSingle = (code: string, weight: number, detail: string) => {
    singlelineScore += weight;
    signals.push({ code, weight: -weight, detail });
  };

  if (internalListLines.size > 0) {
    signals.push({
      code: "internal_list_geometry",
      weight: 0,
      detail: `${internalListLines.size} physical line(s) belong to a confirmed sequential list and are neutral for top-level routing.`,
    });
  }
  if (hasStrongSoftWrapRegion) {
    signals.push({
      code: "soft_wrapped_column",
      weight: 0,
      detail: `${softWrappedContinuationLines} of ${meaningfulLineCount} non-empty physical lines look like visual prose continuations.`,
    });
  }
  if (hasWrappedStructureRegion) {
    signals.push({
      code: "wrapped_structure_continuation",
      weight: 0,
      detail: `${wrappedStructureContinuationLines} named rule(s) visibly continue onto a following physical row.`,
    });
  }

  if (cleanMetadataRun >= 3)
    addMulti(
      "clean_metadata_run",
      5,
      `${cleanMetadataRun} consecutive compact metadata/table rows preserve physical geometry.`,
    );
  if (cleanStructuralRun >= 3)
    addMulti(
      "clean_structural_run",
      4,
      `${cleanStructuralRun} consecutive source-shaped blocks preserve physical geometry.`,
    );
  if (metadataLines + verticalCells >= 4)
    addMulti(
      "isolated_metadata_rows",
      4,
      `${metadataLines + verticalCells} compact metadata/table rows occupy clean individual lines.`,
    );
  if (isolatedFeatureLines >= 2 && isolatedStandaloneLines >= 1)
    addMulti(
      "clean_body_geometry",
      3,
      "Body-like named rules and compact standalone heading rows preserve physical boundaries.",
    );

  if (collapsedLines.length > 0) {
    const weight = Math.min(9, 4 + collapsedLines.length * 2);
    addSingle(
      "collapsed_structural_lines",
      weight,
      `${collapsedLines.length} physical line(s) contain multiple named-rule structures. ${collapsedLines
        .slice(0, 2)
        .map((entry) => `L${entry.index + 1}: ${entry.detail}`)
        .join(" ")}`,
    );
  }

  if (totalShapeAnchors >= 2) {
    if (isolatedRatio >= 0.75)
      addMulti(
        "isolated_anchor_ratio",
        3,
        `${Math.round(isolatedRatio * 100)}% of structural anchors are isolated by physical line geometry.`,
      );
    else if (isolatedRatio <= 0.25)
      addSingle(
        "collapsed_anchor_ratio",
        3,
        `Only ${Math.round(isolatedRatio * 100)}% of structural anchors are isolated; most occur inside collapsed lines.`,
      );
    else
      signals.push({
        code: "mixed_anchor_ratio",
        weight: 0,
        detail: `${Math.round(isolatedRatio * 100)}% of structural anchors are isolated, indicating heterogeneous geometry.`,
      });
  }

  const hasStrongMultilineRegion =
    cleanMetadataRun >= 3 ||
    cleanStructuralRun >= 3 ||
    metadataLines + verticalCells >= 4 ||
    (isolatedFeatureLines >= 2 && isolatedStandaloneLines >= 1);
  const hasStrongCollapsedRegion = collapsedLines.length >= 1;

  if (hasStrongMultilineRegion && (hasStrongSoftWrapRegion || hasWrappedStructureRegion)) {
    const evidence = multilineScore + singlelineScore;
    const confidence = clamp01(0.72 + Math.min(0.24, evidence / 80));
    signals.push({
      code: "mixed_wrapped_structure",
      weight: 0,
      detail:
        "Clean structural rows coexist with visual continuation rows inside logical body structures; physical line boundaries are not trustworthy, so Auto routes the body to the universal parser.",
    });
    return {
      requestedMode,
      selectedMode: "generic",
      detectedStructure: "mixed",
      confidence,
      multilineScore,
      singlelineScore,
      signals,
    };
  }

  if (hasStrongMultilineRegion && hasStrongCollapsedRegion) {
    const evidence = multilineScore + singlelineScore;
    const confidence = clamp01(0.72 + Math.min(0.24, evidence / 80));
    signals.push({
      code: "mixed_structure",
      weight: 0,
      detail:
        "A clean multiline region and a locally collapsed region coexist; Auto routes this source to the universal parser.",
    });
    return {
      requestedMode,
      selectedMode: "generic",
      detectedStructure: "mixed",
      confidence,
      multilineScore,
      singlelineScore,
      signals,
    };
  }

  if (hasWrappedStructureRegion || hasStrongSoftWrapRegion) {
    signals.push({
      code: "mixed_wrapped_structure",
      weight: 0,
      detail:
        "Visual continuation geometry shows that at least one logical body structure crosses physical line boundaries; chose the universal parser.",
    });
    return {
      requestedMode,
      selectedMode: "generic",
      detectedStructure: "mixed",
      confidence: 0.68,
      multilineScore,
      singlelineScore,
      signals,
    };
  }

  if (hasStrongCollapsedRegion) {
    const confidence = clamp01(0.74 + Math.min(0.24, singlelineScore / 36));
    return {
      requestedMode,
      selectedMode: "singleline",
      detectedStructure: "singleline",
      confidence,
      multilineScore,
      singlelineScore,
      signals,
    };
  }

  if (hasStrongMultilineRegion) {
    const confidence = clamp01(0.74 + Math.min(0.24, multilineScore / 36));
    return {
      requestedMode,
      selectedMode: "multiline",
      detectedStructure: "multiline",
      confidence,
      multilineScore,
      singlelineScore,
      signals,
    };
  }

  if (totalShapeAnchors >= 2) {
    if (isolatedRatio >= 0.67) {
      signals.push({
        code: "shape_density_fallback",
        weight: 0,
        detail: `Weak evidence, but ${Math.round(isolatedRatio * 100)}% of structural anchors preserve physical boundaries; chose multiline.`,
      });
      return {
        requestedMode,
        selectedMode: "multiline",
        detectedStructure: "multiline",
        confidence: 0.64,
        multilineScore,
        singlelineScore,
        signals,
      };
    }
    if (isolatedRatio <= 0.33) {
      signals.push({
        code: "shape_density_fallback",
        weight: 0,
        detail: `Weak evidence, but only ${Math.round(isolatedRatio * 100)}% of structural anchors are isolated; chose singleline.`,
      });
      return {
        requestedMode,
        selectedMode: "singleline",
        detectedStructure: "singleline",
        confidence: 0.64,
        multilineScore,
        singlelineScore,
        signals,
      };
    }
    signals.push({
      code: "mixed_structure",
      weight: 0,
      detail: `Weak but genuinely mixed anchor geometry (${Math.round(isolatedRatio * 100)}% isolated); chose the universal parser.`,
    });
    return {
      requestedMode,
      selectedMode: "generic",
      detectedStructure: "mixed",
      confidence: 0.6,
      multilineScore,
      singlelineScore,
      signals,
    };
  }

  const fallback = chooseFallbackByGeometry(lines);
  signals.push({
    code: "weak_shape_fallback",
    weight: 0,
    detail: `No useful source-shape anchors were found; deterministic geometry fallback chose ${fallback}.`,
  });
  return {
    requestedMode,
    selectedMode: fallback,
    detectedStructure: fallback,
    confidence: 0.55,
    multilineScore,
    singlelineScore,
    signals,
  };
}
