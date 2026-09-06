/*
 * Surface-only collapsed title evidence shared by candidate proposal and
 * boundary-strength layers. It deliberately knows no statblock vocabulary.
 *
 * `.`, `!`, and `?` are equivalent surface terminators for a compact title.
 * Whether that surface shape is strong enough to change ownership remains the
 * responsibility of the existing candidate/boundary safety layers.
 */
export function surfaceCollapsedTitleLead(text: string, maxLength = 80): string | null {
  if (!Number.isSafeInteger(maxLength) || maxLength < 2) return null;
  const match = text.match(/^([^\r\n.:;!?]+[.!?])(?=[ \t]|\r|\n|$)[ \t]*/u);
  const lead = match?.[1]?.trim() ?? null;
  return lead !== null && lead.length <= maxLength ? lead : null;
}

/**
 * Surface-only title lead for a trusted physical boundary. In addition to the
 * ordinary whitespace-delimited form, tolerate a single missing whitespace
 * character after `.`, `!`, or `?` when the following source character is an
 * uppercase letter. This does not decide that the lead is a real feature title;
 * callers must still apply their normal title-shape proof.
 */
export function surfaceTrustedTitleLead(text: string, maxLength = 120): string | null {
  const ordinary = surfaceCollapsedTitleLead(text, maxLength);
  if (ordinary !== null) return ordinary;
  if (!Number.isSafeInteger(maxLength) || maxLength < 2) return null;
  const compact = text.match(/^([^\r\n.:;!?]+[.!?])(?=[\p{Lu}])/u)?.[1]?.trim() ?? null;
  return compact !== null && compact.length >= 4 && compact.length <= maxLength ? compact : null;
}

/**
 * Shape-only feature lead consisting of a short printed name followed by one
 * balanced parenthetical metadata phrase and a sentence terminator. Punctuation
 * inside the parentheses (including semicolons) is allowed; only the base name
 * is constrained to remain compact. This is presentation evidence only and
 * assigns no D&D meaning.
 */
export function surfaceParenthesizedTitleLead(text: string, maxLength = 160, maxBaseWords = 8): string | null {
  if (!Number.isSafeInteger(maxLength) || maxLength < 4) return null;
  if (!Number.isSafeInteger(maxBaseWords) || maxBaseWords < 1) return null;
  if (text.includes("\n") || text.includes("\r")) return null;

  const open = text.indexOf("(");
  if (open <= 0) return null;
  const base = text.slice(0, open).trimEnd();
  if (base.length === 0 || /[.:;!?()[\]{}]/u.test(base)) return null;
  const words = base.match(/[\p{L}\p{N}'’_-]+/gu) ?? [];
  if (words.length < 1 || words.length > maxBaseWords) return null;

  let depth = 0;
  let close = -1;
  for (let index = open; index < text.length; index += 1) {
    const ch = text[index]!;
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        close = index;
        break;
      }
      if (depth < 0) return null;
    }
  }
  if (close < 0 || close + 1 >= text.length || !/[.!?]/u.test(text[close + 1]!)) return null;
  const lead = text.slice(0, close + 2).trim();
  if (lead.length > maxLength) return null;
  const after = text[close + 2];
  if (after !== undefined && !/[ \t\r\n]/u.test(after)) return null;
  return lead;
}

/**
 * Compact source-visible `Label:` shape. The helper intentionally knows no
 * vocabulary or field names; it only constrains punctuation and lexical size.
 */
export function surfaceCompactColonLabelLead(text: string, maxLength = 80, maxWords = 8): string | null {
  if (!Number.isSafeInteger(maxLength) || maxLength < 2) return null;
  if (!Number.isSafeInteger(maxWords) || maxWords < 1) return null;
  const colon = text.indexOf(":");
  if (colon <= 0 || colon + 1 > maxLength) return null;
  const lead = text.slice(0, colon + 1);
  const titleOnly = lead
    .slice(0, -1)
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .trim();
  if (titleOnly.length === 0 || /[.;!?]/u.test(titleOnly)) return null;
  const words = titleOnly.match(/[\p{L}\p{N}'’_-]+/gu) ?? [];
  return words.length >= 1 && words.length <= maxWords ? lead : null;
}

/**
 * Shape-only standalone heading row for trusted physical-line geometry. This
 * deliberately assigns no section meaning and knows no language vocabulary.
 * It is presentation/boundary evidence only.
 */
export function surfaceStandaloneHeadingRow(text: string): boolean {
  const plain = text.replace(/\r\n|\r/gu, "\n").trim();
  if (plain.length < 2 || plain.length > 80 || plain.includes("\n")) return false;
  if (/[\d,.:;!?()[\]{}]/u.test(plain)) return false;
  const words = plain.match(/[\p{L}'’_-]+/gu) ?? [];
  if (words.length < 1 || words.length > 8) return false;

  // For scripts with letter case, a section-heading-shaped row starts with an
  // uppercase letter. This rejects lowercase table/noise labels such as `mod`
  // and `save` without knowing any language vocabulary. Scripts without case
  // remain eligible because upper/lower transformations are identical there.
  const firstLetter = plain.match(/\p{L}/u)?.[0] ?? "";
  if (!firstLetter) return false;
  const upper = firstLetter.toLocaleUpperCase();
  const lower = firstLetter.toLocaleLowerCase();
  if (upper !== lower && firstLetter !== upper) return false;
  return true;
}
