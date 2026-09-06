import { sequentialCompactLabelLineIndexes, sequentialInlineCompactLabelStarts } from "./compactLabelSequence.js";
import {
  introducedListSequenceStartGroups,
  leadingListMarker,
  sequentialInlineListMarkerStarts,
  sequentialListLineIndexes,
} from "./listSequence.js";

/*
 * Нормалізатор працює лише з представленням. Оригінальний block.text і rawSource
 * не змінюються, тому будь-яке рішення про оформлення можна переглянути пізніше.
 */
export function normalizePresentationText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function isExplicitInternalRow(line: string, confirmedListItem: boolean, confirmedCompactLabelItem: boolean): boolean {
  const stripped = line.replace(/^[ \t]*(?:\*{1,3}|_{1,3})?/u, "").trim();
  if (confirmedListItem && leadingListMarker(stripped) !== null) return true;
  if (/^[-+•][ \t]+\S/u.test(stripped)) return true;

  // A lone compact `Label: payload` row is not enough presentation evidence to
  // preserve a physical PDF/web newline once semantic ownership has already
  // placed it inside the surrounding block. Repeated labelled rows are different:
  // their sequence is visible list/table-like geometry and is preserved below.
  if (confirmedCompactLabelItem) return true;
  return false;
}

/*
 * Body spans often come from narrow web/PDF columns where physical newlines are
 * merely visual wrapping. Product presentation therefore folds ordinary source
 * wraps back into spaces after semantic segmentation. Explicit internal rows
 * (numbered/bulleted items and compact label rows) keep a real newline.
 *
 * This is presentation-only: rawSource, source-map coordinates and evidence
 * spans remain lossless and unchanged.
 */
type ExposedInlineRows = {
  text: string;
  compactLabelStarts: Set<number>;
};

function exposeConfirmedInlineRows(text: string): ExposedInlineRows {
  const listStarts = sequentialInlineListMarkerStarts(text);
  const compactStarts = sequentialInlineCompactLabelStarts(text);
  const starts = [...new Set([...listStarts, ...compactStarts])].sort((a, b) => a - b);
  if (starts.length === 0) return { text, compactLabelStarts: new Set<number>() };

  let output = "";
  let cursor = 0;
  const exposedCompactStarts = new Set<number>();
  for (const start of starts) {
    if (start < cursor) continue;
    output += text.slice(cursor, start);
    const currentLine = output.match(/[^\r\n]*$/u)?.[0] ?? "";
    if (currentLine.trim().length > 0) output += "\n";
    if (compactStarts.has(start)) exposedCompactStarts.add(output.length);
    cursor = start;
  }
  output += text.slice(cursor);
  return { text: output, compactLabelStarts: exposedCompactStarts };
}

export type BodyPresentationOptions = {
  /**
   * Trusted multiline mode has already decided that physical source rows are
   * authoritative geometry. Preserve every non-empty physical row as exactly one
   * presentation row. Blank rows are still discarded and no synthetic row split
   * is introduced inside an existing physical row.
   */
  preservePhysicalLines?: boolean;
};

type PresentationLine = {
  text: string;
  introducedListItem: boolean;
  confirmedInlineCompactLabel: boolean;
};

function canonicalPhysicalLines(text: string): string[] {
  return text
    .replace(/\r\n|\r/gu, "\n")
    .split("\n")
    .map((rawLine) => rawLine.replace(/[\t \f\v]+/gu, " ").trim())
    .filter((line) => line.length > 0);
}

function bodyPresentationLines(text: string): PresentationLine[] {
  const exposed = exposeConfirmedInlineRows(text);
  const introducedStarts = new Set(introducedListSequenceStartGroups(exposed.text).flat());
  const lines: PresentationLine[] = [];

  for (const match of exposed.text.matchAll(/[^\r\n]+/gu)) {
    if (match.index === undefined) continue;
    const rawLine = match[0];
    const trimmed = rawLine.replace(/[\t \f\v]+/gu, " ").trim();
    if (trimmed.length === 0) continue;
    const leading = rawLine.match(/^[ \t]*/u)?.[0].length ?? 0;
    const contentStart = match.index + leading;
    lines.push({
      text: trimmed,
      introducedListItem: introducedStarts.has(contentStart),
      confirmedInlineCompactLabel: exposed.compactLabelStarts.has(contentStart),
    });
  }

  return lines;
}

export function normalizeBodyPresentationText(text: string, options: BodyPresentationOptions = {}): string {
  if (options.preservePhysicalLines === true) {
    // Multiline is a routing contract, not a weaker presentation hint. Once this
    // mode is selected, a later layer may remove blank rows but may not merge two
    // non-empty source rows or invent additional rows inside one source row.
    return canonicalPhysicalLines(text).join("\n");
  }

  const lines = bodyPresentationLines(text);
  if (lines.length === 0) return "";

  const plainLines = lines.map((line) => line.text.replace(/^[ \t]*(?:\*{1,3}|_{1,3})?/u, "").trim());
  const confirmedListLines = sequentialListLineIndexes(plainLines);
  const confirmedCompactLabelLines = sequentialCompactLabelLineIndexes(plainLines);

  let result = lines[0]!.text;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    const preserveBreak =
      line.introducedListItem ||
      isExplicitInternalRow(
        line.text,
        confirmedListLines.has(index),
        line.confirmedInlineCompactLabel || confirmedCompactLabelLines.has(index),
      );
    result += (preserveBreak ? "\n" : " ") + line.text;
  }
  return result.trim();
}
