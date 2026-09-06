/*
 * Presentation-only proof for collapsed compact labelled rows such as:
 *   ... spells: At will: alpha 3/day each: beta 1/day each: gamma
 *   ... spells: Cantrips (at will): alpha 1st level (4 slots): beta ...
 *
 * This deliberately knows no D&D vocabulary. The first row must be introduced
 * by an immediately preceding colon, while later row labels must carry visible
 * mechanical structure (a digit). That keeps ordinary prose pairs such as
 * `Melee Weapon Attack: ... Hit: ...` out without maintaining a spell-word
 * dictionary. Callers use the returned offsets only as presentation geometry.
 */

function compactLabelShape(label: string): boolean {
  const plain = label.replace(/(?:\*{1,3}|_{1,3})/gu, "").trim();
  if (plain.length < 1 || plain.length > 80) return false;
  if (/[\r\n:;,.!?]/u.test(plain)) return false;
  const words = plain.match(/[\p{L}\p{N}'’/+()_-]+/gu) ?? [];
  return words.length >= 1 && words.length <= 8;
}

type LabelStart = {
  start: number;
  colon: number;
};

function introducedFirstLabel(text: string, introColon: number): LabelStart | null {
  let start = introColon + 1;
  while (start < text.length && /[ \t]/u.test(text[start]!)) start += 1;

  // An introducing clause may end at the physical line edge while the first
  // compact labelled row begins on the immediately following source line.
  // Permit exactly one physical newline here; two newlines would cross a real
  // paragraph break and are intentionally not treated as one introduced list.
  if (start < text.length && /[\r\n]/u.test(text[start]!)) {
    if (text[start] === "\r" && text[start + 1] === "\n") start += 2;
    else start += 1;
    while (start < text.length && /[ \t]/u.test(text[start]!)) start += 1;
    if (start < text.length && /[\r\n]/u.test(text[start]!)) return null;
  }
  if (start >= text.length) return null;

  const colon = text.indexOf(":", start);
  if (colon < 0 || colon - start > 80) return null;
  const label = text.slice(start, colon);
  return compactLabelShape(label) ? { start, colon } : null;
}

function nextDigitLedLabel(text: string, after: number): LabelStart | null {
  // A later collapsed row has no source delimiter before its label. Requiring a
  // digit-led label gives us a source-visible mechanical cue without knowing
  // words such as `day`, `level`, or `slots`.
  const tail = text.slice(after);
  for (const match of tail.matchAll(/(?<![\p{L}\p{N}_])([0-9][^\r\n:;,.!?]{0,79}):/gu)) {
    if (match.index === undefined) continue;
    const start = after + match.index;
    const colon = start + match[0].lastIndexOf(":");
    const label = text.slice(start, colon);
    if (!compactLabelShape(label)) continue;
    return { start, colon };
  }
  return null;
}

export function sequentialInlineCompactLabelStarts(text: string): Set<number> {
  const confirmed = new Set<number>();

  for (let introColon = text.indexOf(":"); introColon >= 0; introColon = text.indexOf(":", introColon + 1)) {
    const first = introducedFirstLabel(text, introColon);
    if (first === null) continue;

    const second = nextDigitLedLabel(text, first.colon + 1);
    if (second === null) continue;
    if (second.start - first.colon > 1200) continue;

    confirmed.add(first.start);
    confirmed.add(second.start);

    let previous = second;
    while (true) {
      const next = nextDigitLedLabel(text, previous.colon + 1);
      if (next === null || next.start - previous.colon > 1200) break;
      confirmed.add(next.start);
      previous = next;
    }

    // One confirmed sequence is sufficient; nested colons inside its payload
    // should not start competing presentation sequences.
    break;
  }

  return confirmed;
}

/**
 * Presentation-only proof for physical compact-labelled row sequences. A lone
 * `Label: payload` row inside a feature is folded back into prose in mixed input;
 * two or more adjacent labelled rows preserve row geometry because the repeated
 * shape is itself visible list/table-like presentation evidence. No vocabulary is
 * used.
 */
export function sequentialCompactLabelLineIndexes(lines: readonly string[]): Set<number> {
  const output = new Set<number>();

  const isCompact = (line: string): boolean => {
    const plain = line.replace(/^[ \t]*(?:\*{1,3}|_{1,3})?/u, "").trim();
    const colon = plain.indexOf(":");
    if (colon < 1 || colon > 80) return false;
    const label = plain
      .slice(0, colon)
      .replace(/(?:\*{1,3}|_{1,3})+$/u, "")
      .trim();
    const payload = plain.slice(colon + 1).trim();
    return payload.length > 0 && compactLabelShape(label);
  };

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!isCompact(lines[index]!) || !isCompact(lines[index + 1]!)) continue;
    output.add(index);
    output.add(index + 1);
    for (let next = index + 2; next < lines.length; next += 1) {
      if (!isCompact(lines[next]!)) break;
      output.add(next);
    }
    index += 1;
  }

  return output;
}
