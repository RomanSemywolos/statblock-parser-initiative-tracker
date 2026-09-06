export type LeadingListMarker = {
  kind: "number" | "letter";
  ordinal: number;
};

export function leadingListMarker(line: string): LeadingListMarker | null {
  const match = line.match(/^(?:([0-9]{1,2})|([\p{Lu}]))[.)][ \t]+/u);
  if (match === null) return null;
  if (match[1] !== undefined) return { kind: "number", ordinal: Number(match[1]) };
  const ordinal = match[2]?.codePointAt(0);
  return ordinal === undefined ? null : { kind: "letter", ordinal };
}

export type BulletMarkerKind =
  "hyphen" | "en_dash" | "em_dash" | "plus" | "star" | "bullet" | "hollow_bullet" | "square_bullet" | "tri_bullet";

export function leadingBulletMarker(line: string): BulletMarkerKind | null {
  const match = line.match(/^[ \t]*([-–—+*•◦▪‣])[ \t]+\S/u);
  if (match === null) return null;
  switch (match[1]) {
    case "-":
      return "hyphen";
    case "–":
      return "en_dash";
    case "—":
      return "em_dash";
    case "+":
      return "plus";
    case "*":
      return "star";
    case "•":
      return "bullet";
    case "◦":
      return "hollow_bullet";
    case "▪":
      return "square_bullet";
    case "‣":
      return "tri_bullet";
    default:
      return null;
  }
}

/**
 * Returns physical-line index groups for source-proven nested bullet sequences.
 * The proof is deliberately surface-only: at least two repeated marker rows are
 * introduced by an immediately preceding non-empty row ending in a colon.
 * Wrapped physical rows are allowed within a small bounded window.
 */
function introducedBulletSequenceIndexGroups(lines: readonly string[]): number[][] {
  const groups: number[][] = [];
  const markers = lines.map(leadingBulletMarker);
  const maxWrappedRows = 8;

  for (let index = 1; index < lines.length; index += 1) {
    const first = markers[index];
    if (first === null) continue;
    if (!/:\s*$/u.test(lines[index - 1]!.trim())) continue;

    const group = [index];
    let previousIndex = index;
    for (let next = index + 1; next < lines.length && next - previousIndex <= maxWrappedRows; next += 1) {
      const marker = markers[next];
      if (marker === null) continue;
      if (marker !== first) break;
      group.push(next);
      previousIndex = next;
    }

    if (group.length < 2) continue;
    groups.push(group);
    index = group[group.length - 1]!;
  }

  return groups;
}

/** Compatibility surface used by boundary tests/callers that only need membership. */
export function introducedBulletSequenceLineIndexes(lines: readonly string[]): Set<number> {
  return new Set(introducedBulletSequenceIndexGroups(lines).flat());
}

export function introducedBulletSequenceStartGroups(rawSource: string): number[][] {
  const starts: number[] = [];
  const lines: string[] = [];
  const rawLines: Array<{ start: number; text: string; trimmedStart: number }> = [];
  for (const match of rawSource.matchAll(/[^\r\n]+/gu)) {
    if (match.index === undefined) continue;
    const rawLine = match[0];
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) continue;
    const leading = rawLine.match(/^[ \t]*/u)?.[0].length ?? 0;
    starts.push(match.index + leading);
    lines.push(trimmed);
    rawLines.push({ start: match.index, text: rawLine, trimmedStart: match.index + leading });
  }

  const groups: number[][] = [];
  for (const indexes of introducedBulletSequenceIndexGroups(lines)) {
    const group = indexes.map((index) => starts[index]!).filter((value) => value !== undefined);
    if (group.length >= 2) groups.push(group);
  }

  // Mixed HTML/PDF copies can keep the first bullet on the same physical row as
  // the introducing colon while subsequent bullets remain on their own rows:
  //   Rule. Intro: • First option.
  //   continuation
  //   • Second option.
  // Keep the exact confirmed marker starts as one source-proven sequence so the
  // transport does not need a candidate-count proximity heuristic.
  const markerKind = (marker: string): BulletMarkerKind | null => leadingBulletMarker(`${marker} x`);
  for (let index = 0; index + 1 < rawLines.length; index += 1) {
    const current = rawLines[index]!;
    const inlineMatches = Array.from(current.text.matchAll(/:\s*([-–—+*•◦▪‣])\s+\S/gu));
    for (const inline of inlineMatches) {
      if (inline.index === undefined || inline[1] === undefined) continue;
      const kind = markerKind(inline[1]);
      if (kind === null) continue;
      let confirmingIndex = -1;
      for (let next = index + 1; next < rawLines.length && next <= index + 6; next += 1) {
        const marker = leadingBulletMarker(lines[next]!);
        if (marker === kind) {
          confirmingIndex = next;
          break;
        }
        if (marker !== null) break;
      }
      if (confirmingIndex < 0) continue;
      const markerOffsetInsideMatch = inline[0].indexOf(inline[1]);
      const group = [current.start + inline.index + markerOffsetInsideMatch, rawLines[confirmingIndex]!.trimmedStart];
      let previousIndex = confirmingIndex;
      for (let next = confirmingIndex + 1; next < rawLines.length && next - previousIndex <= 8; next += 1) {
        const nextKind = leadingBulletMarker(lines[next]!);
        if (nextKind === null) continue;
        if (nextKind !== kind) break;
        group.push(rawLines[next]!.trimmedStart);
        previousIndex = next;
      }
      groups.push(group);
      break;
    }
  }

  return groups;
}

export function introducedBulletSequenceStarts(rawSource: string): Set<number> {
  return new Set(introducedBulletSequenceStartGroups(rawSource).flat());
}

export function introducedOrderedListSequenceStartGroups(rawSource: string): number[][] {
  const rawLines: Array<{ start: number; text: string; trimmedStart: number; trimmed: string }> = [];
  for (const match of rawSource.matchAll(/[^\r\n]+/gu)) {
    if (match.index === undefined) continue;
    const text = match[0];
    const trimmed = text.trim();
    if (trimmed.length === 0) continue;
    const leading = text.match(/^[ \t]*/u)?.[0].length ?? 0;
    rawLines.push({ start: match.index, text, trimmedStart: match.index + leading, trimmed });
  }

  const markerAt = (index: number): LeadingListMarker | null => leadingListMarker(rawLines[index]?.trimmed ?? "");
  const groups: number[][] = [];

  for (let index = 1; index < rawLines.length; index += 1) {
    const first = markerAt(index);
    if (first === null) continue;
    const expectedFirst = first.kind === "number" ? 1 : "A".codePointAt(0)!;
    if (first.ordinal !== expectedFirst) continue;
    if (!/:\s*$/u.test(rawLines[index - 1]!.trimmed)) continue;

    const group = [rawLines[index]!.trimmedStart];
    let previous = first;
    let previousIndex = index;

    for (let next = index + 1; next < rawLines.length; next += 1) {
      const marker = markerAt(next);
      if (marker === null) continue;
      if (marker.kind !== previous.kind || marker.ordinal !== previous.ordinal + 1) break;
      // Keep the proof local enough to avoid accidentally joining unrelated
      // numbered prose far later in the source, while allowing wrapped PDF rows.
      if (next - previousIndex > 8) break;
      if (rawLines[next]!.trimmedStart - rawLines[previousIndex]!.trimmedStart > 1800) break;
      group.push(rawLines[next]!.trimmedStart);
      previous = marker;
      previousIndex = next;
    }

    if (group.length >= 2) groups.push(group);
  }

  // Hybrid mixed/PDF geometry can keep item 1 on the introducing row while
  // later ordered items start physical rows. Treat it symmetrically with the
  // already-supported inline-first bullet form.
  const inlineOrdered = /:\s*(?:([0-9]{1,2})|([\p{Lu}]))[.)][ \t]+/gu;
  for (let index = 0; index < rawLines.length; index += 1) {
    const current = rawLines[index]!;
    for (const match of current.text.matchAll(inlineOrdered)) {
      if (match.index === undefined) continue;
      const first: LeadingListMarker | null =
        match[1] !== undefined
          ? { kind: "number", ordinal: Number(match[1]) }
          : match[2]?.codePointAt(0) !== undefined
            ? { kind: "letter", ordinal: match[2]!.codePointAt(0)! }
            : null;
      if (first === null) continue;
      const expectedFirst = first.kind === "number" ? 1 : "A".codePointAt(0)!;
      if (first.ordinal !== expectedFirst) continue;

      const markerText = match[1] ?? match[2]!;
      const markerOffset = match[0].indexOf(markerText);
      const group = [current.start + match.index + markerOffset];
      let previous = first;
      let previousIndex = index;
      for (let next = index + 1; next < rawLines.length; next += 1) {
        const marker = markerAt(next);
        if (marker === null) continue;
        if (marker.kind !== previous.kind || marker.ordinal !== previous.ordinal + 1) break;
        if (next - previousIndex > 8) break;
        if (rawLines[next]!.trimmedStart - rawLines[previousIndex]!.trimmedStart > 1800) break;
        group.push(rawLines[next]!.trimmedStart);
        previous = marker;
        previousIndex = next;
      }
      if (group.length >= 2) groups.push(group);
      break;
    }
  }

  return groups;
}

export function introducedListSequenceStartGroups(rawSource: string): number[][] {
  return [...introducedBulletSequenceStartGroups(rawSource), ...introducedOrderedListSequenceStartGroups(rawSource)];
}

export function introducedListSequenceStarts(rawSource: string): Set<number> {
  return new Set(introducedListSequenceStartGroups(rawSource).flat());
}

/*
 * A list marker is structural evidence only when adjacent non-empty physical
 * rows prove a sequence: 1 -> 2 (-> 3...) or A -> B (-> C...). A lone value
 * such as `23)` at the start of a wrapped continuation row is not a list.
 */
export function sequentialListLineIndexes(lines: readonly string[]): Set<number> {
  const markers = lines.map(leadingListMarker);
  const internal = new Set<number>();

  for (let index = 0; index < markers.length - 1; index += 1) {
    const first = markers[index];
    const second = markers[index + 1];
    if (first === null || second === null || first.kind !== second.kind) continue;
    const expectedFirst = first.kind === "number" ? 1 : "A".codePointAt(0)!;
    if (first.ordinal !== expectedFirst || second.ordinal !== first.ordinal + 1) continue;

    internal.add(index);
    internal.add(index + 1);
    let previous = second;
    for (let nextIndex = index + 2; nextIndex < markers.length; nextIndex += 1) {
      const next = markers[nextIndex];
      if (next === null || next.kind !== previous.kind || next.ordinal !== previous.ordinal + 1) break;
      internal.add(nextIndex);
      previous = next;
    }
  }

  return internal;
}

type InlineListMarker = {
  start: number;
  end: number;
  kind: "number" | "letter";
  ordinal: number;
};

function inlineListMarkers(text: string): InlineListMarker[] {
  const output: InlineListMarker[] = [];
  for (const match of text.matchAll(/(?<![\p{L}\p{N}_])(?:([0-9]{1,2})|([\p{Lu}]))[.)][ \t]+/gu)) {
    if (match.index === undefined) continue;
    if (match[1] !== undefined) {
      output.push({
        start: match.index,
        end: match.index + match[0].length,
        kind: "number",
        ordinal: Number(match[1]),
      });
      continue;
    }
    const ordinal = match[2]?.codePointAt(0);
    if (ordinal !== undefined)
      output.push({ start: match.index, end: match.index + match[0].length, kind: "letter", ordinal });
  }
  return output;
}

/*
 * Same sequence proof as sequentialListLineIndexes(), but for collapsed text
 * where list markers live inside one physical row. Returned offsets are source
 * coordinates only; callers decide whether they use them as boundary evidence
 * or presentation geometry.
 */
export function sequentialInlineListMarkerStarts(text: string): Set<number> {
  const markers = inlineListMarkers(text);
  const confirmed = new Set<number>();

  for (let index = 0; index < markers.length - 1; index += 1) {
    const first = markers[index]!;
    const second = markers[index + 1]!;
    const expectedFirst = first.kind === "number" ? 1 : "A".codePointAt(0)!;
    if (first.kind !== second.kind || first.ordinal !== expectedFirst || second.ordinal !== first.ordinal + 1) continue;
    if (text.slice(first.end, second.start).length > 1800) continue;

    confirmed.add(first.start);
    confirmed.add(second.start);
    let previous = second;
    for (let nextIndex = index + 2; nextIndex < markers.length; nextIndex += 1) {
      const next = markers[nextIndex]!;
      if (next.kind !== previous.kind || next.ordinal !== previous.ordinal + 1) break;
      if (text.slice(previous.end, next.start).length > 1800) break;
      confirmed.add(next.start);
      previous = next;
    }
  }

  return confirmed;
}
