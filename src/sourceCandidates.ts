import type { LosslessSourceMap, SourceUnit } from "./domain.js";
import { CANDIDATE_REASONS } from "./candidateTypes.js";
import type { CandidateReason, SourceCandidate } from "./candidateTypes.js";
import { sequentialInlineListMarkerStarts } from "./listSequence.js";
import { surfaceCollapsedTitleLead, surfaceTrustedTitleLead } from "./titleBoundaryShape.js";

export { CANDIDATE_REASONS } from "./candidateTypes.js";
export type { CandidateReason, SourceCandidate } from "./candidateTypes.js";

const PREVIEW_LIMIT = 120;

function lineBreakCount(text: string): number {
  return Array.from(text.matchAll(/\r\n|\r|\n/gu)).length;
}

function endsWithSentenceBoundary(text: string): boolean {
  return /[.!?]["')\]}»”’]*$/u.test(text);
}

function endsWithColon(text: string): boolean {
  return /:["')\]}»”’]*$/u.test(text);
}

function previewFrom(rawSource: string, start: number, end: number): string {
  const rawPiece = rawSource.slice(start, end);
  const rawPreview = rawPiece.slice(0, PREVIEW_LIMIT);

  return rawPreview.length < rawPiece.length ? `${rawPreview}...` : rawPreview;
}

function numericLikeToken(text: string): boolean {
  return /[0-9]/u.test(text) && /^[+\-−–—]?[^\s]*[0-9][^\s]*$/u.test(text);
}

function lineBounds(rawSource: string, start: number): { start: number; end: number } {
  let lineStart = start;

  while (lineStart > 0 && rawSource[lineStart - 1] !== "\n" && rawSource[lineStart - 1] !== "\r") {
    lineStart -= 1;
  }

  let lineEnd = start;

  while (lineEnd < rawSource.length && rawSource[lineEnd] !== "\n" && rawSource[lineEnd] !== "\r") {
    lineEnd += 1;
  }

  return { start: lineStart, end: lineEnd };
}

function nextNonEmptyLine(rawSource: string, after: number): string | null {
  let cursor = after;

  while (cursor < rawSource.length) {
    while (cursor < rawSource.length && (rawSource[cursor] === "\r" || rawSource[cursor] === "\n")) {
      cursor += 1;
    }

    const bounds = lineBounds(rawSource, cursor);
    const text = rawSource.slice(bounds.start, bounds.end).trim();

    if (text.length > 0) {
      return text;
    }

    if (bounds.end <= cursor) {
      break;
    }

    cursor = bounds.end;
  }

  return null;
}

function looksLikeTableHeader(rawSource: string, unit: SourceUnit): boolean {
  const bounds = lineBounds(rawSource, unit.start);
  const line = rawSource.slice(bounds.start, bounds.end).trim();
  const tokens = line.match(/[^\s]+/gu) ?? [];

  if (tokens.length < 3 || tokens.length > 12) return false;

  // A table-label row must itself look label-like. The previous detector only
  // checked whether the following row contained several numbers, which could
  // accidentally make ordinary header rows such as `Armor Class 18` or a
  // printed saving-throw row look like hard table geometry. Keep this purely
  // surface-based: no statblock vocabulary, just compact non-numeric labels.
  if (tokens.some(numericLikeToken)) return false;
  const lexicalTokens = tokens.filter((token) => /\p{L}/u.test(token));
  if (lexicalTokens.length < 3) return false;
  if (/[.,;:!?()]/u.test(line)) return false;

  const nextLine = nextNonEmptyLine(rawSource, bounds.end);
  if (nextLine === null) return false;

  const nextTokens = nextLine.match(/[^\s]+/gu) ?? [];
  const numericCount = nextTokens.filter(numericLikeToken).length;
  return numericCount >= Math.min(3, tokens.length);
}

function startsWithUppercaseLetter(text: string): boolean {
  const firstLetter = text.match(/\p{L}/u)?.[0];
  if (firstLetter === undefined) return false;
  const lower = firstLetter.toLocaleLowerCase();
  const upper = firstLetter.toLocaleUpperCase();
  // Scripts without letter case must not lose candidate coordinates merely
  // because English-style capitalization evidence is unavailable.
  return lower === upper || firstLetter === upper;
}

function titleLeadAt(rawSource: string, start: number, trustedPhysical = false): string | null {
  const remaining = rawSource.slice(start);
  if (!/^\p{L}/u.test(remaining)) return null;
  if (/^[\p{Lu}\p{N}]{1,8}\)/u.test(remaining)) return null;
  if (/^[\p{Lu}]{1,5}[ \t]+\d/u.test(remaining)) return null;
  const lead = trustedPhysical ? surfaceTrustedTitleLead(remaining) : surfaceCollapsedTitleLead(remaining);
  if (lead === null) return null;
  if (!startsWithUppercaseLetter(lead)) return null;
  const leadOutsideParentheses = lead.replace(/\([^)]*\)/gu, " ");
  const words = leadOutsideParentheses.match(/[\p{L}\p{N}'’_-]+/gu) ?? [];
  if (words.length < 1 || words.length > 8 || /[,;]/u.test(leadOutsideParentheses)) return null;

  const numericWordCount = words.filter((word) => /\d/u.test(word)).length;
  if (numericWordCount > 2) return null;

  const cased = words
    .map((word) => word.match(/\p{L}/u)?.[0])
    .filter((letter): letter is string => letter !== undefined);
  const uppercaseCount = cased.filter(
    (letter) => letter === letter.toLocaleUpperCase() && letter !== letter.toLocaleLowerCase(),
  ).length;
  if (uppercaseCount === 0) return null;
  if (words.length > 4 && uppercaseCount < 2) return null;

  const sameLineRemainder =
    remaining
      .slice(lead.length)
      .match(/^[^\r\n]*/u)?.[0]
      .trim() ?? "";
  if (sameLineRemainder.length === 0 && (lead.length > 40 || words.length > 6)) return null;
  return lead;
}

function looksLikeNamedBlockStart(rawSource: string, unit: SourceUnit): boolean {
  // A trusted physical row may contain one lost whitespace character after a
  // title terminator (`Title.Prose`). Preserve that source-visible title shape
  // without rewriting the immutable source text. Inline/collapsed discovery
  // remains stricter and still requires the ordinary delimiter.
  return titleLeadAt(rawSource, unit.start, true) !== null;
}

function looksLikeInlineNamedBlockStart(rawSource: string, unit: SourceUnit): boolean {
  const lead = titleLeadAt(rawSource, unit.start);
  if (lead === null) return false;

  // Same-line title proposals are deliberately stricter than trusted physical
  // line starts. Ordinary prose can contain several capitalized words and end
  // in a period (for example `The dragon uses its Dread Visage.`), which used
  // to look title-shaped enough to become a second feature candidate inside
  // Multiattack. Real collapsed rule names normally contain at most a couple
  // of lowercase connector words (`of`, `the`, `and`, ...). Keep the coordinate
  // only while that surface title still has compact label shape. This remains
  // vocabulary-free and does not affect named rules that begin on their own row.
  const lexicalWords = lead.match(/[\p{L}'’_-]+/gu) ?? [];
  const lowercaseWords = lexicalWords.filter((word) => {
    const first = word.match(/\p{L}/u)?.[0];
    return first !== undefined && first === first.toLocaleLowerCase() && first !== first.toLocaleUpperCase();
  });
  if (lowercaseWords.length > 2) return false;

  const afterLead = rawSource.slice(unit.start + lead.length);
  return /^[ \t]+[^\r\n]+/u.test(afterLead);
}

function looksLikeStandaloneBlockStart(rawSource: string, unit: SourceUnit): boolean {
  const bounds = lineBounds(rawSource, unit.start);
  const line = rawSource.slice(bounds.start, bounds.end).trim();
  if (line.length === 0 || line.length > 48 || /[.:;!?0-9]/u.test(line)) return false;
  if (!startsWithUppercaseLetter(line)) return false;
  const words = line.match(/[\p{L}'’_-]+/gu) ?? [];
  return words.length >= 1 && words.length <= 5;
}

function previousContentUnitAt(sourceMap: LosslessSourceMap, unitIndex: number): SourceUnit | null {
  for (let index = unitIndex - 1; index >= 0; index -= 1) {
    if (sourceMap.units[index].kind === "content") return sourceMap.units[index];
  }
  return null;
}

function sortedReasons(reasons: Set<CandidateReason>): CandidateReason[] {
  return CANDIDATE_REASONS.filter((reason) => reasons.has(reason));
}

/*
 * Генератор кандидатів навмисно не розпізнає поля D&D або назви секцій.
 * Він створює широку мовно-нейтральну сітку можливих початків за поверхневою
 * геометрією тексту. Зайвий candidate дешевий; пропущена реальна межа дорога.
 */
export function createSourceCandidates(rawSource: string, sourceMap: LosslessSourceMap): SourceCandidate[] {
  const contentUnits = sourceMap.units.filter((unit) => unit.kind === "content");
  if (contentUnits.length === 0) return [];

  const reasonsByUnitId = new Map<string, Set<CandidateReason>>();
  const addReason = (unit: SourceUnit, reason: CandidateReason): void => {
    const reasons = reasonsByUnitId.get(unit.id) ?? new Set<CandidateReason>();
    reasons.add(reason);
    reasonsByUnitId.set(unit.id, reasons);
  };

  addReason(contentUnits[0], "document_start");
  addReason(contentUnits[0], "line_start");

  // Header text benefits from fine line coordinates. Once source shape gives us
  // a credible body start, wrapped physical lines become noise: keep paragraph,
  // named-rule and short standalone boundaries, not every PDF line wrap.
  let bodyShapeStarted = false;
  let previousContentUnit: SourceUnit | null = null;

  for (let unitIndex = 0; unitIndex < sourceMap.units.length; unitIndex += 1) {
    const unit = sourceMap.units[unitIndex];
    if (unit.kind !== "content") continue;

    const previousUnit = sourceMap.units[unitIndex - 1] ?? null;
    if (previousUnit?.kind !== "separator") {
      previousContentUnit = unit;
      continue;
    }

    const breaks = lineBreakCount(previousUnit.text);
    const atLineStart = breaks >= 1;
    const atParagraphStart = breaks >= 2;
    const followsSentence = previousContentUnit !== null && endsWithSentenceBoundary(previousContentUnit.text);
    const standaloneStart = atLineStart && looksLikeStandaloneBlockStart(rawSource, unit);
    const previousLineWasStandalone =
      atLineStart && previousContentUnit !== null && looksLikeStandaloneBlockStart(rawSource, previousContentUnit);
    // In narrow web/PDF columns a wrapped continuation can itself have a
    // title-like shape ("Misty Step action."). Do not encode English connector
    // words to detect that case. Once body prose has started, an unterminated
    // non-heading physical row is structural evidence that the next row is a
    // continuation. Printed standalone headings such as "Actions" are exempt.
    const previousLooksOpen =
      bodyShapeStarted &&
      previousContentUnit !== null &&
      !previousLineWasStandalone &&
      !endsWithSentenceBoundary(previousContentUnit.text);
    const namedStart = atLineStart
      ? !previousLooksOpen && looksLikeNamedBlockStart(rawSource, unit)
      : followsSentence && looksLikeInlineNamedBlockStart(rawSource, unit);
    const tableStart = atLineStart && looksLikeTableHeader(rawSource, unit);

    // Do not let the creature name or the ability-label row flip us into body
    // mode. A named-rule signature is strong; a short standalone line becomes
    // strong only after enough header-shaped lines have already been seen.
    if (!bodyShapeStarted && namedStart) {
      bodyShapeStarted = true;
    }

    if (
      atLineStart &&
      (!bodyShapeStarted ||
        atParagraphStart ||
        namedStart ||
        standaloneStart ||
        previousLineWasStandalone ||
        tableStart)
    ) {
      addReason(unit, "line_start");
    }
    if (atParagraphStart) addReason(unit, "paragraph_start");
    if (namedStart) addReason(unit, "named_block_start");
    if (standaloneStart) addReason(unit, "standalone_block_start");
    if (tableStart) addReason(unit, "table_row_start");

    // Inside prose, punctuation is useful only when the following text itself
    // has a title-like opening. This keeps compact colon labels and ordinary sentences
    // inside their parent feature while still allowing multiple named rules on
    // one physical line to become separate proposals.
    if (followsSentence && namedStart) {
      addReason(unit, "sentence_start");
    }
    if (!bodyShapeStarted && previousContentUnit !== null && endsWithColon(previousContentUnit.text)) {
      addReason(unit, "colon_start");
    }

    previousContentUnit = unit;
  }

  // The document-start line has no preceding separator, so preserve table
  // evidence there explicitly.
  if (looksLikeTableHeader(rawSource, contentUnits[0])) addReason(contentUnits[0], "table_row_start");

  // Collapsed-input language anchors are intentionally added only after
  // routing selects the specialized singleline parser. The universal lattice
  // stays language-neutral even when physical line geometry is absent.
  if (lineBreakCount(rawSource) <= 1) {
    for (let unitIndex = 0; unitIndex < sourceMap.units.length; unitIndex += 1) {
      const unit = sourceMap.units[unitIndex];
      if (unit.kind !== "content") continue;
      const previous = previousContentUnitAt(sourceMap, unitIndex);
      const previousBlocksNestedTitle =
        previous !== null && startsWithUppercaseLetter(previous.text) && !/[.!?)]$/u.test(previous.text);
      if (!previousBlocksNestedTitle && looksLikeInlineNamedBlockStart(rawSource, unit)) {
        addReason(unit, "named_block_start");
      }
    }
  }

  const candidateUnits = contentUnits.filter((unit) => reasonsByUnitId.has(unit.id));
  return candidateUnits.map((unit, candidateIndex) => {
    const nextStart = candidateUnits[candidateIndex + 1]?.start ?? rawSource.length;
    return {
      id: `candidate-${candidateIndex}`,
      start: unit.start,
      startUnitId: unit.id,
      preview: previewFrom(rawSource, unit.start, nextStart),
      reasons: sortedReasons(reasonsByUnitId.get(unit.id)!),
    };
  });
}

/*
 * Multiline specialization layer.
 *
 * Once routing has selected multiline input, every non-empty physical line is
 * retained as a candidate coordinate for deterministic BODY reconstruction after
 * the universal header scan supplies the body boundary. Header ownership is never
 * inferred by this specialization. Physical geometry is preserved later by
 * presentation. In clean multiline BODY each non-empty physical row is one
 * immutable logical unit, though its semantic role may remain unresolved. No printed-language profile participates in candidate generation.
 */
/**
 * Generic/mixed specialization. Mixed web/PDF copies may collapse adjacent
 * canonical header fields onto one physical row even though the rest of the
 * document still contains line geometry. This enrichment is intentionally not
 * applied to clean multiline mode.
 */
export function enrichGenericCandidates(
  rawSource: string,
  sourceMap: LosslessSourceMap,
  baseCandidates: readonly SourceCandidate[],
): SourceCandidate[] {
  const contentUnits = sourceMap.units.filter((unit) => unit.kind === "content");
  if (contentUnits.length === 0) return [];

  const reasonsByStart = new Map<number, Set<CandidateReason>>();
  for (const candidate of baseCandidates) {
    reasonsByStart.set(candidate.start, new Set(candidate.reasons));
  }

  // Keep all base coordinates here. In mixed mode candidate existence and
  // boundary confidence are deliberately separate concerns: removing a
  // physical coordinate because a neighbouring line looks unfinished can hide
  // a real boundary in localized, uncased, or unusual source text. The
  // boundary/continuation evidence layer below is responsible for weakening
  // suspicious visual wraps without deleting their coordinates.

  // In mixed input, every non-empty physical line start remains available as a
  // candidate coordinate. A PDF/web newline is not itself evidence of a new
  // logical block, so boundaryEvidence keeps these starts weak unless an
  // independent title/section/table/block shape promotes them. This is crucial
  // for multilingual and uncased scripts: the model may still need the coordinate
  // even when capitalization-based title shape cannot fire.
  for (const unit of contentUnits) {
    const bounds = lineBounds(rawSource, unit.start);
    if (rawSource.slice(bounds.start, unit.start).trim().length > 0) continue;
    const reasons = reasonsByStart.get(unit.start) ?? new Set<CandidateReason>();
    reasons.add("line_start");
    reasonsByStart.set(unit.start, reasons);
  }

  // A mixed/localized header can itself contain several fields collapsed onto
  // one unusually long physical row. Without a language profile there is no
  // safe way to know which words are labels, so expose a bounded WEAK token
  // lattice only on long pre-body rows. This gives the multilingual model exact
  // coordinates without turning any token into a deterministic boundary.
  const firstNamedStart =
    [...reasonsByStart.entries()]
      .filter(([, reasons]) => reasons.has("named_block_start"))
      .map(([start]) => start)
      .sort((a, b) => a - b)[0] ?? rawSource.length;
  let denseGenericTokens = 0;
  for (const unit of contentUnits) {
    if (unit.start >= firstNamedStart || denseGenericTokens >= 96) break;
    const bounds = lineBounds(rawSource, unit.start);
    const line = rawSource.slice(bounds.start, bounds.end).trim();
    if (line.length < 96) continue;
    const reasons = reasonsByStart.get(unit.start) ?? new Set<CandidateReason>();
    reasons.add("sentence_start");
    reasonsByStart.set(unit.start, reasons);
    denseGenericTokens += 1;
  }

  // Mixed input may contain locally collapsed peer blocks on one physical row.
  // Preserve every punctuation-delimited content coordinate as an uncertain
  // proposal so localized/uncased titles remain representable even when title
  // capitalization heuristics cannot recognize them. Boundary evidence stays
  // weak unless independent shape evidence promotes the coordinate.
  for (let index = 1; index < sourceMap.units.length; index += 1) {
    const unit = sourceMap.units[index];
    if (unit.kind !== "content") continue;
    const previousContent = previousContentUnitAt(sourceMap, index);
    if (previousContent === null || !endsWithSentenceBoundary(previousContent.text)) continue;
    const reasons = reasonsByStart.get(unit.start) ?? new Set<CandidateReason>();
    reasons.add("sentence_start");
    reasonsByStart.set(unit.start, reasons);
  }

  const starts = [...reasonsByStart.keys()].sort((a, b) => a - b);
  const unitsByStart = new Map(contentUnits.map((unit) => [unit.start, unit] as const));
  return starts.map((start, index) => {
    const unit = unitsByStart.get(start)!;
    const nextStart = starts[index + 1] ?? rawSource.length;
    return {
      id: `candidate-${index}`,
      start,
      startUnitId: unit.id,
      preview: previewFrom(rawSource, start, nextStart),
      reasons: sortedReasons(reasonsByStart.get(start)!),
    };
  });
}

export function enrichMultilineCandidates(
  rawSource: string,
  sourceMap: LosslessSourceMap,
  baseCandidates: readonly SourceCandidate[],
): SourceCandidate[] {
  const contentUnits = sourceMap.units.filter((unit) => unit.kind === "content");
  if (contentUnits.length === 0) return [];

  const reasonsByStart = new Map<number, Set<CandidateReason>>();
  const unitsByStart = new Map(contentUnits.map((unit) => [unit.start, unit] as const));

  for (const candidate of baseCandidates) {
    const geometryReasons = candidate.reasons.filter(
      (reason) =>
        reason === "document_start" ||
        reason === "line_start" ||
        reason === "paragraph_start" ||
        reason === "table_row_start" ||
        (candidate.reasons.includes("line_start") &&
          (reason === "named_block_start" || reason === "standalone_block_start")),
    );
    if (geometryReasons.length > 0) reasonsByStart.set(candidate.start, new Set(geometryReasons));
  }

  const addReasonAt = (start: number, reason: CandidateReason): void => {
    if (!unitsByStart.has(start)) return;
    const reasons = reasonsByStart.get(start) ?? new Set<CandidateReason>();
    reasons.add(reason);
    reasonsByStart.set(start, reasons);
  };

  addReasonAt(contentUnits[0]!.start, "line_start");

  for (let index = 0; index < sourceMap.units.length; index += 1) {
    const unit = sourceMap.units[index];
    if (unit.kind !== "content") continue;
    const previous = sourceMap.units[index - 1] ?? null;
    if (previous?.kind !== "separator") continue;
    const breaks = lineBreakCount(previous.text);
    if (breaks >= 1) addReasonAt(unit.start, "line_start");
    if (breaks >= 2) addReasonAt(unit.start, "paragraph_start");
  }

  const starts = [...reasonsByStart.keys()].sort((a, b) => a - b);
  return starts.map((start, index) => {
    const unit = unitsByStart.get(start)!;
    const nextStart = starts[index + 1] ?? rawSource.length;
    return {
      id: `candidate-${index}`,
      start,
      startUnitId: unit.id,
      preview: previewFrom(rawSource, start, nextStart),
      reasons: sortedReasons(reasonsByStart.get(start)!),
    };
  });
}

/*
 * Single-line specialization layer.
 *
 * The base candidate lattice intentionally stays conservative because it is
 * shared by the universal parser. Collapsed input needs denser coordinates,
 * but those extra proposals must not change universal behavior. This helper
 * therefore adds only single-line evidence after routing has selected the
 * specialized parser.
 *
 * The enrichment is shape-based rather than vocabulary-based: it uses the
 * pre-header prefix, compact repeated label/value/modifier cells, punctuation,
 * numbered-list markers, and already-detected section spans. It never assigns
 * semantic ownership.
 */
export function enrichSinglelineCandidates(
  rawSource: string,
  sourceMap: LosslessSourceMap,
  baseCandidates: readonly SourceCandidate[],
): SourceCandidate[] {
  const contentUnits = sourceMap.units.filter((unit) => unit.kind === "content");
  if (contentUnits.length === 0) return [];

  const reasonsByStart = new Map<number, Set<CandidateReason>>();
  const startUnitByStart = new Map(contentUnits.map((unit) => [unit.start, unit] as const));
  const addAtStart = (offset: number, reason: CandidateReason): void => {
    const unit = startUnitByStart.get(offset);
    if (unit === undefined) return;
    const reasons = reasonsByStart.get(unit.start) ?? new Set<CandidateReason>();
    reasons.add(reason);
    reasonsByStart.set(unit.start, reasons);
  };
  // Preserve only geometry reasons that remain genuinely informative when the
  // whole source is collapsed. The universal lattice contains intentionally
  // noisy inline sentence/title proposals; single-line mode rebuilds those
  // below with stronger shape requirements instead of inheriting the noise.
  for (const candidate of baseCandidates) {
    for (const reason of candidate.reasons) {
      if (
        reason === "document_start" ||
        reason === "line_start" ||
        reason === "paragraph_start" ||
        reason === "table_row_start"
      ) {
        addAtStart(candidate.start, reason);
      }
    }
  }

  // Collapsed input gets an intentionally over-complete punctuation lattice.
  // This does not assume capitalization, script, or vocabulary; the model may
  // merge ordinary sentence coordinates back into their owning block.
  for (let index = 1; index < sourceMap.units.length; index += 1) {
    const unit = sourceMap.units[index];
    if (unit.kind !== "content") continue;
    const previousContent = previousContentUnitAt(sourceMap, index);
    if (previousContent === null || !endsWithSentenceBoundary(previousContent.text)) continue;
    addAtStart(unit.start, "sentence_start");
  }

  // In collapsed text there is no physical delimiter from which an unfamiliar
  // header label can be recovered deterministically. The safe language-neutral
  // answer is an over-complete WEAK token lattice through the pre-body prefix.
  // Candidate existence is cheap; ownership remains entirely with the model.
  // Keep a bounded prefix without trying to infer the body start from title
  // shape. In an unknown language, compact header labels can look exactly like
  // named rules. Candidate density is intentional here: coordinates are weak
  // addressability, never product boundaries.
  const prefixUnits = contentUnits.slice(0, 160);
  for (const unit of prefixUnits.slice(1)) addAtStart(unit.start, "sentence_start");

  // Shape-only compact repeated label + score + parenthesized modifier cells.
  // Several consecutive cells are required, so an isolated acronym/number pair
  // cannot manufacture a table boundary.
  const compactCell = /(?<![\p{L}\p{N}_])([\p{Lu}]{2,6})[ \t]+([+\-−–—]?\d{1,3})[ \t]+\(([+\-−–—]?\d{1,3})\)/gu;
  const cells = Array.from(rawSource.matchAll(compactCell)).filter((match) => match.index !== undefined);
  for (let i = 0; i < cells.length; i += 1) {
    const group = [cells[i]];
    let lastEnd = cells[i].index! + cells[i][0].length;
    for (let j = i + 1; j < cells.length && group.length < 8; j += 1) {
      const cellStart = cells[j].index!;
      const gap = rawSource.slice(lastEnd, cellStart);
      if (gap.length > 8 || /[\r\n.:;]/u.test(gap)) break;
      group.push(cells[j]);
      lastEnd = cellStart + cells[j][0].length;
    }
    if (group.length >= 4) {
      addAtStart(group[0].index!, "table_row_start");
      break;
    }
  }

  type CollapsedListMarker = {
    start: number;
    end: number;
  };

  const rawListMarkers: CollapsedListMarker[] = Array.from(
    rawSource.matchAll(/(?<![\p{L}\p{N}_])(?:[0-9]{1,2}|[\p{Lu}])[.)][ \t]+/gu),
  ).flatMap((match) => (match.index === undefined ? [] : [{ start: match.index, end: match.index + match[0].length }]));

  const confirmedListMarkerStarts = sequentialInlineListMarkerStarts(rawSource);
  const confirmedListTitleStarts = new Set<number>();
  for (const marker of rawListMarkers) {
    if (!confirmedListMarkerStarts.has(marker.start)) continue;
    const titleUnit = contentUnits.find((unit) => unit.start >= marker.end);
    if (titleUnit !== undefined) confirmedListTitleStarts.add(titleUnit.start);
  }

  // The over-complete punctuation lattice must not create a second candidate
  // inside a source-proven numbered/lettered list item. The marker coordinate
  // already represents that internal boundary; retaining the title word as a
  // sibling-capable coordinate would erase the hierarchy we just proved.
  for (const start of confirmedListTitleStarts) {
    const reasons = reasonsByStart.get(start);
    if (reasons === undefined) continue;
    reasons.delete("sentence_start");
    if (reasons.size === 0) reasonsByStart.delete(start);
  }

  const isImmediatelyNumbered = (offset: number): boolean => confirmedListTitleStarts.has(offset);

  const strongCollapsedTitleAt = (offset: number): boolean => {
    const lead = titleLeadAt(rawSource, offset);
    if (lead === null) return false;
    const outside = lead.replace(/\([^)]*\)/gu, " ").replace(/\.$/u, " ");
    const words = outside.match(/[\p{L}\p{N}'’_-]+/gu) ?? [];
    const lexical = words.filter((word) => /\p{L}/u.test(word));
    if (lexical.length === 0 || lexical.length > 8) return false;
    let cased = 0;
    let titleCased = 0;
    for (const word of lexical) {
      const first = word.match(/\p{L}/u)?.[0];
      if (first === undefined) continue;
      const lower = first.toLocaleLowerCase();
      const upper = first.toLocaleUpperCase();
      if (lower === upper) continue;
      cased += 1;
      if (first === upper) titleCased += 1;
    }
    if (cased === 0) return true;
    if (lexical.length === 1) return titleCased === 1;
    return titleCased / cased >= 0.75;
  };

  // Also expose exact token edges for an unpunctuated compact leading label run
  // at a sentence boundary, e.g. `Legendary Actions <section prose...>`. We do
  // not decide where the label ends; all tokens in the short capitalized run are
  // weak addresses so the model can place the semantic split exactly.
  for (let unitIndex = 0; unitIndex < contentUnits.length; unitIndex += 1) {
    const unit = contentUnits[unitIndex]!;
    if (confirmedListTitleStarts.has(unit.start)) continue;
    const previous = unitIndex > 0 ? contentUnits[unitIndex - 1]! : null;
    if (previous !== null && !endsWithSentenceBoundary(previous.text)) continue;
    const run: SourceUnit[] = [];
    for (let next = unitIndex; next < contentUnits.length && run.length < 4; next += 1) {
      const current = contentUnits[next]!;
      const first = current.text.match(/\p{L}/u)?.[0];
      if (first === undefined) break;
      const lower = first.toLocaleLowerCase();
      const upper = first.toLocaleUpperCase();
      if (lower !== upper && first !== upper) break;
      run.push(current);
    }
    if (run.length < 2) continue;
    const following = contentUnits[unitIndex + run.length];
    if (following === undefined) continue;
    const followingFirst = following.text.match(/\p{L}/u)?.[0];
    if (followingFirst === undefined) continue;
    const followingLower = followingFirst.toLocaleLowerCase();
    const followingUpper = followingFirst.toLocaleUpperCase();
    if (followingLower === followingUpper || followingFirst !== followingLower) continue;
    for (const address of run) addAtStart(address.start, "sentence_start");
    addAtStart(following.start, "sentence_start");
  }

  // A collapsed short structural lead can contain two logical labels with no
  // surviving layout delimiter, e.g. a section heading immediately followed by
  // its first named option. Preserve exact token addresses *inside* such compact
  // multiword leads throughout the source. These are weak address coordinates,
  // not deterministic splits; semantic ownership remains with the model.
  for (const unit of contentUnits) {
    const lead = titleLeadAt(rawSource, unit.start);
    if (lead === null || !strongCollapsedTitleAt(unit.start)) continue;
    const leadEnd = unit.start + lead.length;
    const lexicalUnits = contentUnits.filter((current) => current.start >= unit.start && current.start < leadEnd);
    if (lexicalUnits.length < 2 || lexicalUnits.length > 8) continue;
    for (const internal of lexicalUnits.slice(1)) addAtStart(internal.start, "sentence_start");
  }

  // Keep strong named-rule proposals throughout the collapsed body. Around each
  // such proposal also expose a short WEAK token look-back window. This gives a
  // multilingual model exact coordinates for an unfamiliar printed section
  // heading immediately before the first option (for example any translation or
  // homebrew equivalent of an Actions-like heading) without maintaining a word
  // list or making every token in the full body a candidate.
  let activeTitleEnd = -1;
  for (const unit of contentUnits) {
    if (unit.start < activeTitleEnd) continue;
    const lead = titleLeadAt(rawSource, unit.start);
    if (lead === null || !strongCollapsedTitleAt(unit.start)) continue;
    activeTitleEnd = unit.start + lead.length;
    if (isImmediatelyNumbered(unit.start)) continue;
    addAtStart(unit.start, "named_block_start");
    const unitIndex = contentUnits.findIndex((current) => current.start === unit.start);
    if (unitIndex > 0) {
      for (const previous of contentUnits.slice(Math.max(0, unitIndex - 6), unitIndex)) {
        addAtStart(previous.start, "sentence_start");
      }
    }
  }

  // Numbered/lettered list markers are hierarchy coordinates, not feature-title
  // coordinates. Keeping only the marker prevents nested option titles from
  // looking indistinguishable from top-level features while preserving exact
  // source ownership and allowing a genuinely top-level numbered block.
  for (const marker of rawListMarkers) {
    if (!confirmedListMarkerStarts.has(marker.start)) continue;
    addAtStart(marker.start, "sentence_start");
  }

  const candidateUnits = contentUnits.filter((unit) => reasonsByStart.has(unit.start));
  return candidateUnits.map((unit, index) => {
    const nextStart = candidateUnits[index + 1]?.start ?? rawSource.length;
    return {
      id: `candidate-${index}`,
      start: unit.start,
      startUnitId: unit.id,
      preview: previewFrom(rawSource, unit.start, nextStart),
      reasons: sortedReasons(reasonsByStart.get(unit.start)!),
    };
  });
}
