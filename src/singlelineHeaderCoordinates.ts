import { ABILITY_KEYS, type AbilityKey } from "./domain.js";
import type {
  ModelAbilityLabel,
  ParsedModelHeaderFacts,
  ParsedSinglelineHeaderCoordinatesResponse,
  SinglelineHeaderFieldCoordinateKind,
} from "./modelSchema.js";
import type { SourceCandidate } from "./candidateTypes.js";

export type SinglelineHeaderCoordinateIssue = {
  code:
    | "singleline_header_identity_coordinate_rejected"
    | "singleline_header_field_coordinate_rejected"
    | "singleline_header_ability_coordinate_rejected"
    | "singleline_header_ability_region_rejected"
    | "singleline_header_saving_throw_region_rejected";
  message: string;
  details: Record<string, unknown>;
};

export type GroundedSinglelineHeaderCoordinates = {
  modelFacts: ParsedModelHeaderFacts;
  groundedRegions: NonNullable<ParsedModelHeaderFacts["essentialRegions"]>;
  issues: SinglelineHeaderCoordinateIssue[];
};

type Range = { start: number; end: number };
type GroundedAbilityCoordinate = ModelAbilityLabel &
  Range & {
    startCandidate: number;
    endCandidate: number;
  };

const SIGN_CHARS = "+\\-−‒–—﹣－＋";
const SIGNED_AT_START = new RegExp(`^[${SIGN_CHARS}]\\d{1,3}`, "u");
const UNSIGNED_AT_START = /^\d{1,5}/u;
const CHALLENGE_AT_START = /^\d+(?:\s*\/\s*\d+)?/u;
const ABILITY_CELL_AT_START = new RegExp(
  `^(\\d{1,3})(?:\\s*(?:\\(\\s*([${SIGN_CHARS}]\\d{1,3})\\s*\\)|([${SIGN_CHARS}]\\d{1,3})))?(?:\\s+([${SIGN_CHARS}]\\d{1,3}))?`,
  "u",
);

function skipWhitespace(text: string, start: number): number {
  let cursor = start;
  while (cursor < text.length && /\s/u.test(text[cursor] ?? "")) cursor += 1;
  return cursor;
}

function trimWhitespaceEnd(text: string, start: number, end: number): number {
  let cursor = Math.min(end, text.length);
  while (cursor > start && /\s/u.test(text[cursor - 1] ?? "")) cursor -= 1;
  return cursor;
}

function firstContentOffset(text: string): number {
  return skipWhitespace(text, 0);
}

function candidateSpan(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  startCandidate: number,
  endCandidate: number,
): Range | null {
  const start = candidates[startCandidate]?.start;
  if (start === undefined || endCandidate < startCandidate) return null;
  const rawEnd = candidates[endCandidate + 1]?.start ?? rawSource.length;
  if (rawEnd <= start) return null;
  const end = trimWhitespaceEnd(rawSource, start, rawEnd);
  return end > start ? { start, end } : null;
}

function compactPrintedLabel(rawSource: string, span: Range): string | null {
  const text = rawSource.slice(span.start, span.end).trim();
  if (text.length === 0 || text.length > 64 || !/\p{L}/u.test(text)) return null;
  if (/\d/u.test(text) || /[.!?]/u.test(text)) return null;
  return text;
}

function consumeBalancedParenthetical(rawSource: string, start: number): number | null {
  const open = skipWhitespace(rawSource, start);
  if (rawSource[open] !== "(") return start;
  let depth = 0;
  for (let cursor = open; cursor < rawSource.length; cursor += 1) {
    const char = rawSource[cursor]!;
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return cursor + 1;
    }
  }
  return null;
}

function scalarFieldRangeFromFactSpan(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  startCandidate: number,
  endCandidate: number,
  kind: Exclude<SinglelineHeaderFieldCoordinateKind, "sv">,
): Range | null {
  const factSpan = candidateSpan(rawSource, candidates, startCandidate, endCandidate);
  if (factSpan === null) return null;
  const pattern =
    kind === "ac" || kind === "hp" ? UNSIGNED_AT_START : kind === "cr" ? CHALLENGE_AT_START : SIGNED_AT_START;

  // The model selects the complete fact. Deterministic code finds the first
  // compatible mechanical value inside that exact span and treats everything
  // before it as the printed label. This is the collapsed-input analogue of the
  // mixed parser verifying a whole physical Header row.
  for (let index = startCandidate + 1; index <= endCandidate; index += 1) {
    const valueStart = candidates[index]?.start;
    if (valueStart === undefined || valueStart >= factSpan.end) break;
    const match = pattern.exec(rawSource.slice(valueStart));
    if (match === null) continue;

    const labelSpan = {
      start: factSpan.start,
      end: trimWhitespaceEnd(rawSource, factSpan.start, valueStart),
    };
    if (labelSpan.end <= labelSpan.start || compactPrintedLabel(rawSource, labelSpan) === null) continue;

    const numericEnd = valueStart + match[0].length;
    if (factSpan.end < numericEnd) continue;
    const completedEnd = consumeBalancedParenthetical(rawSource, numericEnd);
    if (completedEnd === null || completedEnd - factSpan.start > 240) continue;

    // A coordinate card may contain punctuation that closes an outer wrapper
    // (notably nested `PB +9)` inside a CR parenthetical). Final exact ownership
    // ends at the mechanically proven value; transport punctuation is not annexed.
    const extraInsideClaim = factSpan.end > completedEnd ? rawSource.slice(completedEnd, factSpan.end).trim() : "";
    if (extraInsideClaim.length > 0 && !/^[()[\]{}.,;:]+$/u.test(extraInsideClaim)) continue;

    return { start: factSpan.start, end: completedEnd };
  }
  return null;
}

const ABILITY_NUMERIC_ANCHOR = new RegExp(
  `^\\d{1,3}(?:\\s*(?:\\(\\s*[${SIGN_CHARS}]\\d{1,3}\\s*\\)|[${SIGN_CHARS}]\\d{1,3})){0,2}$`,
  "u",
);

type RepairedGroundedAbilityCoordinate = GroundedAbilityCoordinate & {
  modelStartCandidate: number;
  modelEndCandidate: number;
  repairedFromNumericAnchor: boolean;
};

function groundedAbilities(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  parsed: ParsedSinglelineHeaderCoordinatesResponse,
  issues: SinglelineHeaderCoordinateIssue[],
): RepairedGroundedAbilityCoordinate[] {
  const byAbility = new Map<AbilityKey, RepairedGroundedAbilityCoordinate>();
  const usedStarts = new Set<number>();

  for (const anchor of parsed.abilityLabels) {
    const originalSpan = candidateSpan(rawSource, candidates, anchor.startCandidate, anchor.endCandidate);
    if (originalSpan === null) {
      issues.push({
        code: "singleline_header_ability_coordinate_rejected",
        message:
          "A singleline ability coordinate span was rejected because it does not resolve to one unique source span.",
        details: { ability: anchor.ability, startCandidate: anchor.startCandidate, endCandidate: anchor.endCandidate },
      });
      continue;
    }

    let acceptedSpan = originalSpan;
    let acceptedStartCandidate = anchor.startCandidate;
    let acceptedEndCandidate = anchor.endCandidate;
    let labelQuote = compactPrintedLabel(rawSource, acceptedSpan);
    let repairedFromNumericAnchor = false;

    // Reuse the established language-neutral coordinate-repair principle from the
    // mixed/legacy Header path: a weak model may point an ability mapping at the
    // immediately following numeric cell. We may move exactly one candidate left
    // only when that candidate is a compact printed label. This is provisional:
    // the complete six-label mechanical solver below must independently prove the
    // region before any repaired mapping becomes Header evidence.
    if (labelQuote === null) {
      const selectedText = rawSource.slice(originalSpan.start, originalSpan.end).trim();
      if (anchor.startCandidate > 0 && ABILITY_NUMERIC_ANCHOR.test(selectedText)) {
        const previousCandidate = anchor.startCandidate - 1;
        const previousSpan = candidateSpan(rawSource, candidates, previousCandidate, previousCandidate);
        const previousLabel = previousSpan === null ? null : compactPrintedLabel(rawSource, previousSpan);
        if (previousSpan !== null && previousLabel !== null) {
          acceptedSpan = previousSpan;
          acceptedStartCandidate = previousCandidate;
          acceptedEndCandidate = previousCandidate;
          labelQuote = previousLabel;
          repairedFromNumericAnchor = true;
        }
      }
    }

    if (labelQuote === null || usedStarts.has(acceptedSpan.start)) {
      issues.push({
        code: "singleline_header_ability_coordinate_rejected",
        message:
          "A singleline ability coordinate span was rejected because the addressed source is not a unique compact printed label.",
        details: {
          ability: anchor.ability,
          startCandidate: anchor.startCandidate,
          endCandidate: anchor.endCandidate,
          addressedText: rawSource.slice(originalSpan.start, originalSpan.end),
        },
      });
      continue;
    }

    usedStarts.add(acceptedSpan.start);
    byAbility.set(anchor.ability, {
      ability: anchor.ability,
      labelQuote,
      ...acceptedSpan,
      startCandidate: acceptedStartCandidate,
      endCandidate: acceptedEndCandidate,
      modelStartCandidate: anchor.startCandidate,
      modelEndCandidate: anchor.endCandidate,
      repairedFromNumericAnchor,
    });
  }

  return ABILITY_KEYS.flatMap((ability) => {
    const grounded = byAbility.get(ability);
    return grounded === undefined ? [] : [grounded];
  });
}

function parseSequentialAbilityCells(rawSource: string, start: number, count: number): number | null {
  let cursor = start;
  for (let index = 0; index < count; index += 1) {
    cursor = skipWhitespace(rawSource, cursor);
    const match = ABILITY_CELL_AT_START.exec(rawSource.slice(cursor));
    if (match === null) return null;
    const printedModifier = match[2] ?? match[3] ?? null;
    if (printedModifier === null) return null;
    cursor += match[0].length;
  }
  return cursor;
}

function abilityRegionFromExplicitLabelSpans(
  rawSource: string,
  abilities: readonly GroundedAbilityCoordinate[],
): Range | null {
  if (abilities.length !== ABILITY_KEYS.length) return null;
  const ordered = [...abilities].sort((left, right) => left.start - right.start);
  if (new Set(ordered.map((label) => label.start)).size !== ABILITY_KEYS.length) return null;

  // Separate label row: six labels adjacent in source, then six numeric cells.
  const labelsAdjacent = ordered.slice(0, -1).every((current, index) => {
    const next = ordered[index + 1]!;
    return skipWhitespace(rawSource, current.end) === next.start;
  });
  if (labelsAdjacent) {
    const firstNumeric = skipWhitespace(rawSource, ordered[ordered.length - 1]!.end);
    const finalEnd = parseSequentialAbilityCells(rawSource, firstNumeric, ABILITY_KEYS.length);
    if (finalEnd !== null) return { start: ordered[0]!.start, end: finalEnd };
  }

  // Interleaved / 2024 layout: each explicit label span is followed immediately by
  // one score/modifier cell, and the next label begins after that cell.
  let finalEnd = 0;
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index]!;
    const valueStart = skipWhitespace(rawSource, current.end);
    const nextStart = ordered[index + 1]?.start ?? rawSource.length;
    const match = ABILITY_CELL_AT_START.exec(rawSource.slice(valueStart, nextStart));
    if (match === null) return null;
    const printedModifier = match[2] ?? match[3] ?? null;
    if (printedModifier === null) return null;
    const cellEnd = valueStart + match[0].length;
    if (cellEnd > nextStart) return null;
    if (index < ordered.length - 1 && skipWhitespace(rawSource, cellEnd) !== nextStart) return null;
    finalEnd = cellEnd;
  }
  return { start: ordered[0]!.start, end: finalEnd };
}

function savingThrowRegionFromFactSpan(
  rawSource: string,
  factSpan: Range,
  abilities: readonly GroundedAbilityCoordinate[],
): Range | null {
  if (abilities.length === 0) return null;
  const quotes = [...new Set(abilities.map((ability) => ability.labelQuote))].sort(
    (left, right) => right.length - left.length,
  );

  // Find the first mapped ability+signed-bonus pair inside the model-selected fact.
  // The prefix before that pair is the printed field label. Once one pair is proven,
  // deterministic code may close the comma/semicolon continuation through all
  // adjacent mapped pairs, just as mixed owns the complete physical metadata row.
  let firstPairStart: number | null = null;
  let firstPairEnd: number | null = null;
  for (let cursor = factSpan.start; cursor < factSpan.end; cursor += 1) {
    if (cursor > factSpan.start && !/\s/u.test(rawSource[cursor - 1] ?? "")) continue;
    const quote = quotes.find((candidate) => rawSource.startsWith(candidate, cursor));
    if (quote === undefined) continue;
    const bonusStart = skipWhitespace(rawSource, cursor + quote.length);
    const bonus = SIGNED_AT_START.exec(rawSource.slice(bonusStart));
    if (bonus === null) continue;
    const pairEnd = bonusStart + bonus[0].length;
    if (pairEnd > factSpan.end) continue;
    firstPairStart = cursor;
    firstPairEnd = pairEnd;
    break;
  }
  if (firstPairStart === null || firstPairEnd === null) return null;

  const labelSpan = {
    start: factSpan.start,
    end: trimWhitespaceEnd(rawSource, factSpan.start, firstPairStart),
  };
  if (labelSpan.end <= labelSpan.start || compactPrintedLabel(rawSource, labelSpan) === null) return null;

  let cursor = firstPairStart;
  let pairCount = 0;
  let end = firstPairStart;
  while (cursor < rawSource.length) {
    while (cursor < rawSource.length && /[,;]/u.test(rawSource[cursor] ?? ""))
      cursor = skipWhitespace(rawSource, cursor + 1);
    const quote = quotes.find((candidate) => rawSource.startsWith(candidate, cursor));
    if (quote === undefined) break;
    cursor += quote.length;
    cursor = skipWhitespace(rawSource, cursor);
    const bonus = SIGNED_AT_START.exec(rawSource.slice(cursor));
    if (bonus === null) break;
    cursor += bonus[0].length;
    end = cursor;
    pairCount += 1;
    cursor = skipWhitespace(rawSource, cursor);
  }
  if (pairCount === 0) return null;

  const extraInsideClaim = factSpan.end > end ? rawSource.slice(end, factSpan.end).trim() : "";
  if (extraInsideClaim.length > 0 && !/^[()[\]{}.,;:]+$/u.test(extraInsideClaim)) return null;
  return { start: factSpan.start, end };
}

function carveAlreadyOwnedScalarPrefix(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  startCandidate: number,
  endCandidate: number,
  kind: SinglelineHeaderFieldCoordinateKind,
  acceptedRegions: readonly NonNullable<ParsedModelHeaderFacts["essentialRegions"]>[number][],
): { startCandidate: number; endCandidate: number } {
  // Full-fact selection may begin on the final attached token of the immediately
  // previous scalar fact (for example Initiative +18 (28) / HP 697...). Mixed can
  // carve this from physical-row ownership; collapsed singleline can do the same
  // only when that prefix is already independently accepted Header evidence.
  if (kind !== "init" && kind !== "hp") return { startCandidate, endCandidate };
  const selected = candidateSpan(rawSource, candidates, startCandidate, endCandidate);
  if (selected === null) return { startCandidate, endCandidate };
  const allowedPreviousKinds = kind === "init" ? new Set(["armor_class"]) : new Set(["armor_class", "initiative"]);
  const overlap = acceptedRegions
    .filter(
      (region) =>
        allowedPreviousKinds.has(region.kind) &&
        region.start <= selected.start &&
        selected.start < region.end &&
        region.end < selected.end,
    )
    .sort((left, right) => right.end - left.end)[0];
  if (overlap === undefined) return { startCandidate, endCandidate };

  let shifted = startCandidate;
  while (shifted <= endCandidate && (candidates[shifted]?.start ?? Number.POSITIVE_INFINITY) < overlap.end)
    shifted += 1;
  if (shifted > endCandidate) return { startCandidate, endCandidate };
  const shiftedStart = candidates[shifted]?.start;
  if (shiftedStart === undefined || rawSource.slice(overlap.end, shiftedStart).trim().length > 0) {
    return { startCandidate, endCandidate };
  }
  return { startCandidate: shifted, endCandidate };
}

function essentialKindForField(
  kind: Exclude<SinglelineHeaderFieldCoordinateKind, "ab">,
): NonNullable<ParsedModelHeaderFacts["essentialRegions"]>[number]["kind"] {
  if (kind === "ac") return "armor_class";
  if (kind === "init") return "initiative";
  if (kind === "hp") return "hit_points";
  if (kind === "sv") return "saving_throws";
  if (kind === "cr") return "challenge";
  return "proficiency_bonus";
}

/**
 * Convert coordinate-only Header span selections into exact source evidence.
 * This mirrors the mixed parser's responsibility split: the model chooses source
 * spans semantically; deterministic code proves mechanical shape, exact values,
 * final evidence ranges and ownership. The denser coordinate overlay is specific
 * to physically-collapsed singleline input.
 */
export function groundSinglelineHeaderCoordinates(
  rawSource: string,
  candidates: readonly SourceCandidate[],
  parsed: ParsedSinglelineHeaderCoordinatesResponse,
): GroundedSinglelineHeaderCoordinates {
  const issues: SinglelineHeaderCoordinateIssue[] = [];
  const regions: NonNullable<ParsedModelHeaderFacts["essentialRegions"]> = [];

  const nameAnchor = parsed.identity.find((anchor) => anchor.kind === "name") ?? null;
  const typeAnchor = parsed.identity.find((anchor) => anchor.kind === "size_type_alignment") ?? null;
  const nameRange =
    nameAnchor === null
      ? null
      : candidateSpan(rawSource, candidates, nameAnchor.startCandidate, nameAnchor.endCandidate);
  if (nameAnchor !== null && (nameRange === null || nameRange.start !== firstContentOffset(rawSource))) {
    issues.push({
      code: "singleline_header_identity_coordinate_rejected",
      message:
        "The singleline name coordinates were rejected because they do not address the exact first printed source span.",
      details: { startCandidate: nameAnchor.startCandidate, endCandidate: nameAnchor.endCandidate },
    });
  } else if (nameRange !== null) {
    regions.push({ kind: "name", ...nameRange });
  }

  const acceptedName = regions.find((region) => region.kind === "name") ?? null;
  const typeRange =
    typeAnchor === null
      ? null
      : candidateSpan(rawSource, candidates, typeAnchor.startCandidate, typeAnchor.endCandidate);
  if (
    typeAnchor !== null &&
    (typeRange === null || acceptedName === null || typeRange.start !== skipWhitespace(rawSource, acceptedName.end))
  ) {
    issues.push({
      code: "singleline_header_identity_coordinate_rejected",
      message:
        "The singleline size/type/alignment coordinates were rejected because they are not the exact span adjacent to the grounded name.",
      details: { startCandidate: typeAnchor.startCandidate, endCandidate: typeAnchor.endCandidate },
    });
  } else if (typeRange !== null) {
    regions.push({ kind: "size_type_alignment", ...typeRange });
  }

  const abilities = groundedAbilities(rawSource, candidates, parsed, issues);
  const abilityRegion = abilityRegionFromExplicitLabelSpans(rawSource, abilities);
  if (abilities.length === ABILITY_KEYS.length && abilityRegion === null) {
    issues.push({
      code: "singleline_header_ability_region_rejected",
      message:
        "All six singleline ability-label spans were valid, but their surrounding numeric cells did not prove one complete six-ability region.",
      details: {
        labels: abilities.map((ability) => ({
          ability: ability.ability,
          startCandidate: ability.startCandidate,
          endCandidate: ability.endCandidate,
          modelStartCandidate: ability.modelStartCandidate,
          modelEndCandidate: ability.modelEndCandidate,
          repairedFromNumericAnchor: ability.repairedFromNumericAnchor,
          start: ability.start,
          end: ability.end,
        })),
      },
    });
  }

  if (abilityRegion !== null) regions.push({ kind: "ability_scores", ...abilityRegion });

  const orderedFields = [...parsed.fields].sort(
    (left, right) => left.startCandidate - right.startCandidate || left.endCandidate - right.endCandidate,
  );
  for (const anchor of orderedFields) {
    const carved = carveAlreadyOwnedScalarPrefix(
      rawSource,
      candidates,
      anchor.startCandidate,
      anchor.endCandidate,
      anchor.kind,
      regions,
    );
    const factSpan = candidateSpan(rawSource, candidates, carved.startCandidate, carved.endCandidate);
    if (factSpan === null) {
      issues.push({
        code: "singleline_header_field_coordinate_rejected",
        message: "A singleline Header fact coordinate span did not resolve to the supplied lattice.",
        details: {
          kind: anchor.kind,
          startCandidate: carved.startCandidate,
          endCandidate: carved.endCandidate,
          modelStartCandidate: anchor.startCandidate,
          modelEndCandidate: anchor.endCandidate,
        },
      });
      continue;
    }

    if (anchor.kind === "sv") {
      const region = savingThrowRegionFromFactSpan(rawSource, factSpan, abilities);
      if (region === null) {
        issues.push({
          code: "singleline_header_saving_throw_region_rejected",
          message:
            "The model-selected singleline Saving Throws fact did not contain a compact label followed by a mechanically proven mapped ability+signed-bonus sequence.",
          details: {
            startCandidate: carved.startCandidate,
            endCandidate: carved.endCandidate,
            modelStartCandidate: anchor.startCandidate,
            modelEndCandidate: anchor.endCandidate,
            start: factSpan.start,
            end: factSpan.end,
            addressedText: rawSource.slice(factSpan.start, factSpan.end),
          },
        });
        continue;
      }
      regions.push({ kind: "saving_throws", ...region });
      continue;
    }

    const region = scalarFieldRangeFromFactSpan(
      rawSource,
      candidates,
      carved.startCandidate,
      carved.endCandidate,
      anchor.kind,
    );
    if (region === null) {
      issues.push({
        code: "singleline_header_field_coordinate_rejected",
        message:
          "A singleline Header fact span was rejected because it did not contain a complete compact printed label+mechanical-value fact of the claimed kind.",
        details: {
          kind: anchor.kind,
          startCandidate: carved.startCandidate,
          endCandidate: carved.endCandidate,
          modelStartCandidate: anchor.startCandidate,
          modelEndCandidate: anchor.endCandidate,
          start: factSpan.start,
          end: factSpan.end,
          addressedText: rawSource.slice(factSpan.start, factSpan.end),
        },
      });
      continue;
    }
    regions.push({ kind: essentialKindForField(anchor.kind), ...region });
  }

  const abilityLabels: ModelAbilityLabel[] =
    abilityRegion !== null && abilities.length === ABILITY_KEYS.length
      ? abilities.map(({ ability, labelQuote }) => ({ ability, labelQuote }))
      : [];
  const sortedRegions = [...regions].sort((left, right) => left.start - right.start || left.end - right.end);
  return {
    modelFacts: { abilityRows: [], abilityLabels, savingThrows: [], essentialRegions: sortedRegions, issues: [] },
    groundedRegions: sortedRegions,
    issues,
  };
}
