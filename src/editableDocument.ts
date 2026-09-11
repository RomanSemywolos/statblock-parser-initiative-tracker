import {
  type EditableAbilityFact,
  type EditableHeaderRow,
  type EditableStatblockDocument,
  type EditableStatblockNode,
  type ProductAbilityKey,
  type ProductHeaderField,
} from "./productModel.js";
import { findDeterministicHeaderLabel } from "./headerClassifier.js";
import { matchEnglishHeaderLabelAtStart } from "./headerLexicon.js";
import {
  surfaceCompactColonLabelLead,
  surfaceParenthesizedTitleLead,
  surfaceStandaloneHeadingRow,
  surfaceTrustedTitleLead,
} from "./titleBoundaryShape.js";

export type NodeIdFactory = () => string;

function cloneDocument(document: EditableStatblockDocument): EditableStatblockDocument {
  return structuredClone(document);
}

function stripAuthoringMarkup(text: string): string {
  return text.replace(/\*\*/gu, "").replace(/\*/gu, "");
}

function parseSignedToken(token: string): number | null {
  const value = Number(token.replace(/[−–—]/gu, "-"));
  return Number.isSafeInteger(value) ? value : null;
}

function parseUnsigned(text: string | null, expression: RegExp): number | null {
  if (text === null) return null;
  const match = expression.exec(stripAuthoringMarkup(text));
  if (match === null) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

function parseSigned(text: string | null, expression: RegExp): number | null {
  if (text === null) return null;
  const match = expression.exec(stripAuthoringMarkup(text));
  return match === null ? null : parseSignedToken(match[1]);
}

function rowText(document: EditableStatblockDocument, field: ProductHeaderField): string | null {
  return (
    [...document.header.primaryRows, ...document.header.secondaryRows].find((row) => row.field === field)?.text ?? null
  );
}

export function refreshEditableStatblockFacts(document: EditableStatblockDocument): EditableStatblockDocument {
  const next = cloneDocument(document);
  const initiativeRow =
    [...next.header.primaryRows, ...next.header.secondaryRows].find((row) => row.field === "initiative") ?? null;
  const initiativeModifier = parseSigned(initiativeRow?.text ?? null, /([+\-−–—]\d+)/u);
  const initiativeIsDerivedDex = initiativeRow?.id === "header-initiative-derived";
  const proficiencyText = rowText(next, "proficiency_bonus");
  const printedProficiency = parseSigned(proficiencyText, /([+\-−–—]\d+)/u);

  next.facts = {
    ...next.facts,
    name:
      next.header.name === null || stripAuthoringMarkup(next.header.name.text).trim().length === 0
        ? null
        : stripAuthoringMarkup(next.header.name.text),
    armorClass: parseUnsigned(rowText(next, "armor_class"), /\b(\d+)\b/u),
    hitPointMaximum: parseUnsigned(rowText(next, "hit_points"), /\b(\d+)\b/u),
    // Once the editable document exists, the Initiative row is authoritative.
    // A compiler-created row may remember that its initial value came from DEX,
    // but later DEX edits must not silently change the user's Initiative field.
    initiative:
      initiativeModifier === null
        ? null
        : { modifier: initiativeModifier, provenance: initiativeIsDerivedDex ? "dex_modifier" : "printed" },
    abilities: structuredClone(next.header.abilities),
    savingThrows: structuredClone(next.header.savingThrows),
    // The editable PB row is likewise authoritative after compilation. If a
    // user removes or clears it, do not resurrect a stale imported/derived fact.
    proficiencyBonus: printedProficiency,
  };
  return next;
}

function editRowCollection(rows: EditableHeaderRow[], rowId: string, text: string): boolean {
  const row = rows.find((entry) => entry.id === rowId);
  if (row === undefined) return false;
  row.text = text;
  return true;
}

export function editEditableHeaderText(
  document: EditableStatblockDocument,
  rowId: string,
  text: string,
): EditableStatblockDocument {
  const next = cloneDocument(document);
  if (next.header.name?.id === rowId) next.header.name.text = text;
  else if (next.header.subtitle?.id === rowId) next.header.subtitle.text = text;
  else if (
    !editRowCollection(next.header.primaryRows, rowId, text) &&
    !editRowCollection(next.header.secondaryRows, rowId, text)
  )
    return document;
  return refreshEditableStatblockFacts(next);
}

export function setEditableHeaderName(
  document: EditableStatblockDocument,
  text: string,
  idFactory: NodeIdFactory = () => crypto.randomUUID(),
): EditableStatblockDocument {
  const next = cloneDocument(document);
  if (next.header.name === null) {
    next.header.name = { id: idFactory(), field: "name", text };
  } else {
    next.header.name.text = text;
  }
  return refreshEditableStatblockFacts(next);
}

export function setEditableHeaderSubtitle(
  document: EditableStatblockDocument,
  text: string,
  idFactory: NodeIdFactory = () => crypto.randomUUID(),
): EditableStatblockDocument {
  const next = cloneDocument(document);
  if (text.length === 0) {
    next.header.subtitle = null;
  } else if (next.header.subtitle === null) {
    next.header.subtitle = { id: idFactory(), field: "size_type_alignment", text };
  } else {
    next.header.subtitle.text = text;
  }
  return refreshEditableStatblockFacts(next);
}

export function ensureEditableHeaderSubtitle(
  document: EditableStatblockDocument,
  idFactory: NodeIdFactory = () => crypto.randomUUID(),
): EditableStatblockDocument {
  if (document.header.subtitle !== null) return document;
  const next = cloneDocument(document);
  next.header.subtitle = { id: idFactory(), field: "size_type_alignment", text: "" };
  return refreshEditableStatblockFacts(next);
}

export function addEditableHeaderRow(
  document: EditableStatblockDocument,
  field: ProductHeaderField = "other_header",
  text = "",
  idFactory: NodeIdFactory = () => crypto.randomUUID(),
  afterRowId: string | null = null,
): EditableStatblockDocument {
  const next = cloneDocument(document);
  const created = { id: idFactory(), field, text };

  if (afterRowId !== null) {
    const primaryIndex = next.header.primaryRows.findIndex((row) => row.id === afterRowId);
    if (primaryIndex >= 0) {
      next.header.primaryRows.splice(primaryIndex + 1, 0, created);
      return refreshEditableStatblockFacts(next);
    }

    const secondaryIndex = next.header.secondaryRows.findIndex((row) => row.id === afterRowId);
    if (secondaryIndex >= 0) {
      next.header.secondaryRows.splice(secondaryIndex + 1, 0, created);
      return refreshEditableStatblockFacts(next);
    }
  }

  // With no row-local insertion point, put a manual row at the start of the
  // freely editable secondary header rather than silently appending it far away.
  next.header.secondaryRows.unshift(created);
  return refreshEditableStatblockFacts(next);
}

export function removeEditableHeaderRow(document: EditableStatblockDocument, rowId: string): EditableStatblockDocument {
  const next = cloneDocument(document);
  const primary = next.header.primaryRows.findIndex((row) => row.id === rowId);
  if (primary >= 0) {
    const row = next.header.primaryRows[primary];
    // AC and HP are permanent card-critical slots. "Removing" one clears its
    // value while keeping the labelled place where a human can repair parsing.
    if (row.field === "armor_class") row.text = "Armor Class";
    else if (row.field === "hit_points") row.text = "Hit Points";
    else next.header.primaryRows.splice(primary, 1);
  } else {
    const secondary = next.header.secondaryRows.findIndex((row) => row.id === rowId);
    if (secondary < 0) return document;
    next.header.secondaryRows.splice(secondary, 1);
  }
  return refreshEditableStatblockFacts(next);
}

export function editEditableAbility(
  document: EditableStatblockDocument,
  ability: ProductAbilityKey,
  value: EditableAbilityFact | null,
): EditableStatblockDocument {
  const next = cloneDocument(document);
  next.header.abilities[ability] =
    value === null || (value.score === null && value.modifier === null) ? null : { ...value };
  const previousSave = next.header.savingThrows[ability];
  const previousModifier = document.header.abilities[ability]?.modifier ?? null;
  if (previousSave === previousModifier || previousSave === null) {
    next.header.savingThrows[ability] = value?.modifier ?? null;
  }
  return refreshEditableStatblockFacts(next);
}

export function editEditableSavingThrow(
  document: EditableStatblockDocument,
  ability: ProductAbilityKey,
  bonus: number | null,
): EditableStatblockDocument {
  const next = cloneDocument(document);
  next.header.savingThrows[ability] = bonus;
  return refreshEditableStatblockFacts(next);
}

const LOCALIZED_AUTO_STYLE_HEADER_LABELS: Partial<Record<ProductHeaderField, readonly string[]>> = {
  armor_class: ["Клас Доспеху", "Класс Доспеха"],
  initiative: ["Ініціатива", "Инициатива"],
  hit_points: ["Хіти", "Хиты"],
  speed: ["Швидкість", "Скорость"],
  saving_throws: ["Ряткидки", "Рятувальні кидки", "Спасброски", "Спасительные броски"],
  skills: ["Навички", "Навыки"],
  damage_vulnerabilities: ["Вразливості до шкоди", "Уязвимость к урону"],
  damage_resistances: ["Опір шкоді", "Сопротивление урону"],
  damage_immunities: ["Імунітети до шкоди", "Иммунитет к урону", "Иммунитеты к урону"],
  condition_immunities: ["Імунітети до станів", "Иммунитет к состоянию", "Иммунитеты к состояниям"],
  senses: ["Чуття", "Чувства"],
  languages: ["Мови", "Языки"],
  habitat: ["Середовище", "Среда обитания"],
  challenge: ["Небезпека", "Опасность"],
  experience_points: ["Досвід", "Опыт"],
  proficiency_bonus: ["Бонус майстерності", "Бонус мастерства"],
};

function localizedPrintedHeaderLabel(plain: string, field: ProductHeaderField): string | null {
  const lowered = plain.toLocaleLowerCase();
  for (const alias of LOCALIZED_AUTO_STYLE_HEADER_LABELS[field] ?? []) {
    if (!lowered.startsWith(alias.toLocaleLowerCase())) continue;
    const boundary = plain.slice(alias.length, alias.length + 1);
    if (boundary.length > 0 && !/[\s:]/u.test(boundary)) continue;
    return plain.slice(0, alias.length);
  }
  return null;
}

function presentationPrintedHeaderLabel(plain: string, expectedField?: ProductHeaderField): string | null {
  const firstLetter = plain.match(/\p{L}/u)?.[0];
  if (
    firstLetter !== undefined &&
    firstLetter.toLocaleUpperCase() !== firstLetter.toLocaleLowerCase() &&
    firstLetter !== firstLetter.toLocaleUpperCase()
  )
    return null;

  const matches: string[] = [];

  // Presentation profiles may recognize the printed label without claiming
  // semantic ownership. Require a whitespace/colon/end boundary so a feature
  // such as `Senses. ...` cannot be styled as a header merely because its title
  // happens to equal a known field label.
  const english = matchEnglishHeaderLabelAtStart(plain, expectedField);
  if (english !== null) {
    const boundary = plain.slice(english.printedLabel.length, english.printedLabel.length + 1);
    if (boundary.length === 0 || /[\s:]/u.test(boundary)) matches.push(english.printedLabel);
  }

  const fields =
    expectedField === undefined
      ? (Object.keys(LOCALIZED_AUTO_STYLE_HEADER_LABELS) as ProductHeaderField[])
      : [expectedField];
  const lowered = plain.toLocaleLowerCase();
  for (const field of fields) {
    for (const alias of LOCALIZED_AUTO_STYLE_HEADER_LABELS[field] ?? []) {
      if (!lowered.startsWith(alias.toLocaleLowerCase())) continue;
      const boundary = plain.slice(alias.length, alias.length + 1);
      if (boundary.length > 0 && !/[\s:]/u.test(boundary)) continue;
      matches.push(plain.slice(0, alias.length));
    }
  }

  if (matches.length === 0) return null;
  return matches.sort((left, right) => right.length - left.length)[0] ?? null;
}

function stylePrintedHeaderLead(plain: string, printedLabel: string): string {
  const remainder = plain.slice(printedLabel.length).replace(/^[ \t]*:?[ \t]*/u, "");
  return remainder.length === 0 ? `**${printedLabel}**` : `**${printedLabel}** ${remainder}`;
}

function autoStyleHeaderRow(row: EditableHeaderRow): string {
  const plain = stripAuthoringMarkup(row.text).trim();
  if (plain.length === 0) return plain;

  // The semantic classifier is the single owner of canonical header vocabulary.
  // Auto Style only asks it for the exact label that was actually printed in
  // this row, so presentation does not maintain a second alias dictionary.
  const printedLabel =
    findDeterministicHeaderLabel(plain, row.field) ??
    localizedPrintedHeaderLabel(plain, row.field) ??
    // Presentation is deliberately weaker than semantics: if the source begins
    // with a known printed header label, style that exact substring even when
    // the row's semantic field is unresolved or disagrees. This never changes
    // row.field, ownership, facts, or source text.
    presentationPrintedHeaderLabel(plain);
  if (printedLabel === null) return plain;

  return stylePrintedHeaderLead(plain, printedLabel);
}

function autoStyleWhole(text: string, marker: "*" | "**"): string {
  const plain = stripAuthoringMarkup(text).trim();
  return plain.length === 0 ? plain : `${marker}${plain}${marker}`;
}

function looksLikeTitleLead(lead: string): boolean {
  const titleOnly = lead
    .slice(0, -1)
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .trim();
  const words = titleOnly.match(/[\p{L}\p{N}'’_-]+/gu) ?? [];
  if (words.length < 1 || words.length > 8) return false;
  if (lead.length > 120 || /[,;]/u.test(titleOnly)) return false;

  const cased = words
    .map((word) => word.match(/\p{L}/u)?.[0])
    .filter((letter): letter is string => letter !== undefined);
  if (cased.length === 0) return false;
  const uppercaseCount = cased.filter(
    (letter) => letter === letter.toLocaleUpperCase() && letter !== letter.toLocaleLowerCase(),
  ).length;
  if (uppercaseCount === 0) return false;

  // Parenthetical notes are metadata attached to the printed rule name and do
  // not count against the title-length test. This keeps long ordinary prose out
  // while still allowing compact or prose parenthetical title metadata.
  return words.length <= 4 || uppercaseCount >= 2;
}

function autoStyleFeatureMarker(lead: string): "**" | "***" {
  const parenthetical = lead.match(/\(([^)]*)\)[.!?]$/u)?.[1]?.trim() ?? "";
  if (parenthetical.length === 0) return "***";

  // Compact numeric metadata (counts, costs, frequencies, ranges, etc.) is
  // surface metadata attached to the printed title. No vocabulary is required:
  // a short parenthetical containing a number keeps peer-feature emphasis.
  const metadataWords = parenthetical.match(/[\p{L}\p{N}'’_-]+/gu) ?? [];
  if (/\d/u.test(parenthetical) && parenthetical.length <= 48 && metadataWords.length <= 8) {
    return "***";
  }

  // Longer prose-like parentheticals remain bold-only.
  if (/^\p{L}/u.test(parenthetical)) return "**";
  return "***";
}

function autoStyleFeatureLead(text: string): string {
  const plain = stripAuthoringMarkup(text).trim();
  if (plain.length === 0) return plain;

  // Auto Style operates at a trusted paragraph/physical-line boundary. Reuse
  // the same surface title evidence as multiline structural classification,
  // including the harmless copied-text defect `Name.Prose`. The source text is
  // never rewritten; only the proven title prefix receives authoring markup.
  const lead = surfaceParenthesizedTitleLead(plain, 160, 8) ?? surfaceTrustedTitleLead(plain, 120);
  if (lead === null || !looksLikeTitleLead(lead)) return plain;
  const marker = autoStyleFeatureMarker(lead);
  return `${marker}${lead}${marker}${plain.slice(lead.length)}`;
}

function autoStyleColonLead(text: string): string {
  const trimmed = text.trim();
  const plain = stripAuthoringMarkup(trimmed).trim();
  if (plain.length === 0 || trimmed !== plain) return trimmed;
  const lead = surfaceCompactColonLabelLead(plain, 80, 8);
  if (lead === null) return plain;
  return `*${lead}*${plain.slice(lead.length)}`;
}

function autoStyleSectionRuleColonLead(text: string): string {
  const trimmed = text.trim();
  const plain = stripAuthoringMarkup(trimmed).trim();
  if (plain.length === 0 || trimmed !== plain) return trimmed;
  const lead = surfaceCompactColonLabelLead(plain, 80, 8);
  if (lead === null) return plain;
  return `**${lead}**${plain.slice(lead.length)}`;
}

function autoStyleInlineColonLabels(text: string, scanStart: number): string {
  if (!Number.isSafeInteger(scanStart) || scanStart < 0 || scanStart >= text.length) return text;

  const ranges: Array<{ start: number; end: number }> = [];
  for (let boundary = scanStart; boundary < text.length; boundary += 1) {
    if (!/[.!?]/u.test(text[boundary]!)) continue;

    let start = boundary + 1;
    while (start < text.length && /[ \t]/u.test(text[start]!)) start += 1;
    if (start >= text.length) continue;

    const tail = text.slice(start);
    const lead = surfaceCompactColonLabelLead(tail, 80, 8);
    if (lead === null || tail.slice(lead.length).trim().length === 0) continue;

    ranges.push({ start, end: start + lead.length });
    boundary = start + lead.length - 1;
  }

  if (ranges.length === 0) return text;
  let output = "";
  let cursor = 0;
  for (const range of ranges) {
    output += text.slice(cursor, range.start);
    output += `*${text.slice(range.start, range.end)}*`;
    cursor = range.end;
  }
  output += text.slice(cursor);
  return output;
}

function autoStyleFeatureLine(text: string): string {
  const plain = stripAuthoringMarkup(text).trim();
  if (plain.length === 0) return plain;

  const lead = surfaceParenthesizedTitleLead(plain, 160, 8) ?? surfaceTrustedTitleLead(plain, 120);
  if (lead === null || !looksLikeTitleLead(lead)) return autoStyleInlineColonLabels(plain, 0);

  // The title terminator itself is not prose evidence. Start scanning after the
  // printed title so `Name. Label: ...` does not promote the first mechanics
  // clause, while a later completed sentence can expose `... sentence. Label:`.
  const bodyWithInlineLabels = autoStyleInlineColonLabels(plain, lead.length);
  const marker = autoStyleFeatureMarker(lead);
  return `${marker}${lead}${marker}${bodyWithInlineLabels.slice(lead.length)}`;
}

function autoStyleBulletedSubeffectLead(text: string): string {
  const trimmed = text.trim();
  const plain = stripAuthoringMarkup(trimmed).trim();
  if (plain.length === 0) return plain;

  const match = plain.match(/^([-+•][ \t]+)([^.!?\r\n]{1,80}[.!?])/u);
  if (match === null) return trimmed;

  const title = match[2]!;
  if (!looksLikeTitleLead(title)) return trimmed;
  const lead = `${match[1]!}${title}`;
  return `*${lead}*${plain.slice(lead.length)}`;
}

function autoStylePeerBulletedFeatureLead(text: string): string {
  const trimmed = text.trim();
  const plain = stripAuthoringMarkup(trimmed).trim();
  if (plain.length === 0) return plain;

  const match = plain.match(/^([-+•][ \t]+)(.+)$/u);
  if (match === null) return plain;
  const prefix = match[1]!;
  const body = match[2]!;
  const styledBody = autoStyleFeatureLead(body);
  if (styledBody === body) return plain;
  return `${prefix}${styledBody}`;
}

function autoStyleNumberedSubeffectLead(text: string): string {
  const trimmed = text.trim();
  const plain = stripAuthoringMarkup(trimmed).trim();
  if (plain.length === 0) return plain;

  const match = plain.match(/^([0-9]{1,2}[.)][ \t]+)([^.!?\r\n]{1,80}\.)/u);
  if (match === null) return trimmed;

  const title = match[2]!;
  if (!looksLikeTitleLead(title)) return trimmed;
  const lead = `${match[1]!}${title}`;
  return `*${lead}*${plain.slice(lead.length)}`;
}

function autoStyleBodyParagraph(
  text: string,
  options: { sectionRulesLead?: boolean; nestedBulletContinuation?: boolean } = {},
): string {
  // Physical source lines are presentation evidence, not semantic nodes. Apply
  // line-local styling without flattening them so a coarse semantic feature can
  // still degrade safely as visibly separated source lines. Blank lines are
  // preserved exactly. A bullet is treated as a nested subeffect only when it
  // occurs after content already owned by this semantic paragraph. A paragraph
  // whose first content line is itself bulleted may instead be a peer feature
  // exported with Markdown/list punctuation, so its title keeps peer styling.
  const lines = stripAuthoringMarkup(text)
    .replace(/\r\n|\r/gu, "\n")
    .split("\n");

  let hasPriorContent = false;
  const styled = lines.map((line) => {
    const plain = line.trim();
    if (plain.length === 0) return line;

    const isBullet = /^[-+•][ \t]+\S/u.test(plain);
    let next: string;
    if (isBullet && (hasPriorContent || options.nestedBulletContinuation === true)) {
      // Structural context says this row is inside an already-started feature.
      // Do not let the generic peer-feature formatter claim its title first.
      next = autoStyleNumberedSubeffectLead(autoStyleBulletedSubeffectLead(autoStyleColonLead(plain)));
    } else if (isBullet) {
      // The semantic paragraph itself begins with a list marker. Preserve the
      // marker while styling a title-shaped peer feature after it.
      next = autoStyleNumberedSubeffectLead(autoStyleColonLead(autoStylePeerBulletedFeatureLead(plain)));
    } else {
      // Presentation-only language profiles may style an exact printed header
      // label even when parser ownership is unresolved and the text therefore
      // lives in an ordinary editable paragraph. This never changes node type,
      // semantic field, facts, or source ownership.
      const presentationHeaderLabel = presentationPrintedHeaderLabel(plain);
      if (presentationHeaderLabel !== null) {
        next = stylePrintedHeaderLead(plain, presentationHeaderLabel);
      } else {
        const featureStyled = autoStyleFeatureLine(plain);
        const colonStyled =
          options.sectionRulesLead && !hasPriorContent && featureStyled === plain
            ? autoStyleSectionRuleColonLead(plain)
            : autoStyleColonLead(featureStyled);
        next = autoStyleNumberedSubeffectLead(colonStyled);
      }
    }

    hasPriorContent = true;
    return next;
  });

  return styled.join("\n").trim();
}

function establishesNestedBulletSequence(text: string): boolean {
  const plain = stripAuthoringMarkup(text).replace(/\r\n|\r/gu, "\n");
  const lines = plain.split("\n");
  let hasPriorContent = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (/^[-+•][ \t]+\S/u.test(trimmed)) {
      if (hasPriorContent) return true;
    } else {
      // Some importers fold the first printed bullet back onto the introducing
      // row. A marker after substantive text is still evidence that this
      // paragraph has already introduced a nested bullet sequence.
      if (/\S[ \t]*:[ \t]*[-+•][ \t]+\S/u.test(trimmed)) return true;
      hasPriorContent = true;
    }
  }
  return false;
}

function startsWithBullet(text: string): boolean {
  const plain = stripAuthoringMarkup(text).trim();
  return /^[-+•][ \t]+\S/u.test(plain);
}

function paragraphStartsWithNamedRuleShape(text: string): boolean {
  const plain = stripAuthoringMarkup(text).trim();
  if (plain.length === 0) return false;
  const lead = surfaceParenthesizedTitleLead(plain, 160, 8) ?? surfaceTrustedTitleLead(plain, 120);
  if (lead === null || !looksLikeTitleLead(lead)) return false;
  return plain.slice(lead.length).trim().length > 0;
}

/**
 * Presentation-only rescue for a standalone section-heading-shaped paragraph
 * whose following visible paragraph begins with a source-shaped named rule.
 *
 * The function deliberately knows no section vocabulary and never assigns a
 * semantic heading kind. It only restores visual hierarchy when semantic
 * ownership left an otherwise source-shaped heading row as an ordinary paragraph.
 * A heading-shaped word by itself is insufficient: contextual body evidence is
 * required, preventing wording alone from promoting arbitrary metadata labels.
 */
function shouldRescueStandalonePresentationHeading(nodes: readonly EditableStatblockNode[], index: number): boolean {
  const current = nodes[index];
  if (current?.type !== "paragraph") return false;
  const plain = stripAuthoringMarkup(current.text).trim();
  if (!surfaceStandaloneHeadingRow(plain)) return false;

  const next = nodes[index + 1];
  if (next?.type !== "paragraph") return false;
  if (paragraphStartsWithNamedRuleShape(next.text)) return true;

  // Section-like headings often have one ordinary explanatory paragraph before
  // the first named peer entry (for example the rules paragraph that follows a
  // legendary-actions heading). This is still presentation-only and vocabulary-
  // independent: the current node must have standalone heading shape, the middle
  // node must be ordinary prose rather than another heading/printed metadata row,
  // and the following node must begin with a source-shaped named rule.
  const nextPlain = stripAuthoringMarkup(next.text).trim();
  if (nextPlain.length === 0 || surfaceStandaloneHeadingRow(nextPlain)) return false;
  const nextPrintedHeaderLabel = presentationPrintedHeaderLabel(nextPlain);
  if (
    nextPrintedHeaderLabel !== null &&
    nextPlain
      .slice(nextPrintedHeaderLabel.length)
      .replace(/^[ \t]*:?[ \t]*/u, "")
      .trim().length > 0
  )
    return false;

  const afterNext = nodes[index + 2];
  return afterNext?.type === "paragraph" && paragraphStartsWithNamedRuleShape(afterNext.text);
}

/**
 * Idempotent authoring normalization to the standard statblock style. New imports
 * receive it once during product compilation, and the editor can invoke it again
 * explicitly. It removes stale authoring markup and wrong heading nodes before
 * rebuilding style from current text; ordinary later edits are never auto-restyled.
 */
export function applyEditableAutoStyle(document: EditableStatblockDocument): EditableStatblockDocument {
  const next = cloneDocument(document);

  if (next.header.name !== null) {
    next.header.name.text = autoStyleWhole(next.header.name.text, "**");
  }
  if (next.header.subtitle !== null) {
    next.header.subtitle.text = autoStyleWhole(next.header.subtitle.text, "*");
  }

  next.header.primaryRows = next.header.primaryRows.map((row) => ({
    ...row,
    text: autoStyleHeaderRow(row),
  }));
  next.header.secondaryRows = next.header.secondaryRows.map((row) => ({
    ...row,
    text: autoStyleHeaderRow(row),
  }));

  let immediatelyAfterSectionHeading = false;
  let nestedBulletContinuation = false;
  next.body = next.body.map((node, index, bodyNodes) => {
    const plain = stripAuthoringMarkup(node.text).trim();
    const structurallyHeadingShaped = surfaceStandaloneHeadingRow(plain);
    // Heading-vs-paragraph structure normally comes from the editable document.
    // If semantic ownership left a standalone printed heading as a paragraph,
    // Auto Style may restore presentation only when language-neutral source shape
    // is reinforced by the following paragraph beginning with a named rule. The
    // rescued heading stays semantically untyped (`headingKind: null`).
    const presentationHeadingRescue = shouldRescueStandalonePresentationHeading(bodyNodes, index);
    const printedHeaderLabel = presentationPrintedHeaderLabel(plain);
    const hasPrintedHeaderValue =
      printedHeaderLabel !== null &&
      plain
        .slice(printedHeaderLabel.length)
        .replace(/^[ \t]*:?[ \t]*/u, "")
        .trim().length > 0;
    // Presentation must not preserve a stale heading node when the same visible
    // line has the already-supported printed header-label + value shape. This is
    // intentionally presentation-only: it changes no source ownership or BODY
    // semantics, and it makes initial Auto Style match a manual demote + restyle.
    const preserveHeading =
      !hasPrintedHeaderValue && ((node.type === "heading" && structurallyHeadingShaped) || presentationHeadingRescue);
    if (preserveHeading) {
      immediatelyAfterSectionHeading = true;
      nestedBulletContinuation = false;
      return {
        id: node.id,
        type: "heading" as const,
        headingKind: node.type === "heading" ? node.headingKind : null,
        text: autoStyleWhole(plain, "**"),
      };
    }

    // A short `Label:` immediately following a section heading is section-wide
    // rules metadata, not an internal subeffect label. Give that lead bold
    // presentation while keeping the same colon label italic inside features.
    const sectionRulesLead = immediatelyAfterSectionHeading;
    immediatelyAfterSectionHeading = false;

    const continuesNestedBulletSequence = nestedBulletContinuation && startsWithBullet(plain);
    const establishesSequence = establishesNestedBulletSequence(plain);
    nestedBulletContinuation = establishesSequence || continuesNestedBulletSequence;

    // A stale or manually mistyped heading becomes an ordinary paragraph again.
    // Its font size therefore also returns to normal through the node type.
    return {
      id: node.id,
      type: "paragraph" as const,
      text: autoStyleBodyParagraph(node.text, {
        sectionRulesLead,
        nestedBulletContinuation: continuesNestedBulletSequence,
      }),
    };
  });

  return refreshEditableStatblockFacts(next);
}

export function editEditableNodeText(
  document: EditableStatblockDocument,
  nodeId: string,
  text: string,
): EditableStatblockDocument {
  const next = cloneDocument(document);
  const node = next.body.find((entry) => entry.id === nodeId);
  if (node === undefined) return document;
  node.text = text;
  return next;
}

export function insertEditableNodeAfter(
  document: EditableStatblockDocument,
  afterNodeId: string | null,
  node: Omit<EditableStatblockNode, "id">,
  idFactory: NodeIdFactory = () => crypto.randomUUID(),
): EditableStatblockDocument {
  const next = cloneDocument(document);
  const created = { ...structuredClone(node), id: idFactory() } as EditableStatblockNode;
  if (afterNodeId === null) next.body.unshift(created);
  else {
    const index = next.body.findIndex((entry) => entry.id === afterNodeId);
    if (index < 0) return document;
    next.body.splice(index + 1, 0, created);
  }
  return next;
}

export function removeEditableNode(document: EditableStatblockDocument, nodeId: string): EditableStatblockDocument {
  const next = cloneDocument(document);
  const index = next.body.findIndex((entry) => entry.id === nodeId);
  if (index < 0) return document;
  next.body.splice(index, 1);
  return next;
}

export function splitEditableNodeText(
  document: EditableStatblockDocument,
  nodeId: string,
  beforeText: string,
  afterText: string,
  idFactory: NodeIdFactory = () => crypto.randomUUID(),
): EditableStatblockDocument {
  const next = cloneDocument(document);
  const index = next.body.findIndex((entry) => entry.id === nodeId);
  if (index < 0) return document;

  const node = next.body[index];
  node.text = beforeText;
  next.body.splice(index + 1, 0, {
    id: idFactory(),
    type: "paragraph",
    text: afterText,
  });
  return next;
}

export function splitEditableNodeAt(
  document: EditableStatblockDocument,
  nodeId: string,
  offset: number,
  idFactory: NodeIdFactory = () => crypto.randomUUID(),
): EditableStatblockDocument {
  const next = cloneDocument(document);
  const index = next.body.findIndex((entry) => entry.id === nodeId);
  if (index < 0) return document;
  const node = next.body[index];
  if (!Number.isInteger(offset) || offset < 0 || offset > node.text.length) return document;

  const before = node.text.slice(0, offset);
  const after = node.text.slice(offset);
  node.text = before;
  next.body.splice(index + 1, 0, {
    id: idFactory(),
    type: "paragraph",
    text: after,
  });
  return next;
}

export function mergeEditableNodeWithPrevious(
  document: EditableStatblockDocument,
  nodeId: string,
): EditableStatblockDocument {
  const next = cloneDocument(document);
  const index = next.body.findIndex((entry) => entry.id === nodeId);
  if (index <= 0) return document;
  const previous = next.body[index - 1];
  const current = next.body[index];
  previous.text = `${previous.text}${current.text}`;
  next.body.splice(index, 1);
  return next;
}

export function mergeEditableNodeWithNext(
  document: EditableStatblockDocument,
  nodeId: string,
): EditableStatblockDocument {
  const next = cloneDocument(document);
  const index = next.body.findIndex((entry) => entry.id === nodeId);
  if (index < 0 || index >= next.body.length - 1) return document;
  const current = next.body[index];
  const following = next.body[index + 1];
  current.text = `${current.text}${following.text}`;
  next.body.splice(index + 1, 1);
  return next;
}

export function toggleEditableNodeHeading(
  document: EditableStatblockDocument,
  nodeId: string,
): EditableStatblockDocument {
  const next = cloneDocument(document);
  const index = next.body.findIndex((entry) => entry.id === nodeId);
  if (index < 0) return document;
  const node = next.body[index];
  if (node.type === "heading") {
    next.body[index] = { id: node.id, type: "paragraph", text: node.text };
    return next;
  }

  next.body[index] = {
    id: node.id,
    type: "heading",
    // Toggling presentation must not infer semantic section identity from wording.
    // Semantic kind is assigned only by an explicit semantic operation.
    headingKind: null,
    text: node.text,
  };
  return next;
}

export function replaceEditableBody(
  document: EditableStatblockDocument,
  body: EditableStatblockNode[],
): EditableStatblockDocument {
  const next = cloneDocument(document);
  next.body = structuredClone(body);
  return next;
}
