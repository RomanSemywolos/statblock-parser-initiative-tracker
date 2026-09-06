import type { CompiledAnnotation, DocumentBlock, LosslessStatblockDocument } from "./domain.js";
import { ABILITY_KEYS } from "./domain.js";
import { normalizeBodyPresentationText, normalizePresentationText } from "./normalizer.js";
import { applyEditableAutoStyle } from "./editableDocument.js";
import { TRANSLATION_GLOSSARY } from "./translationGlossaryData.js";
import type {
  EditableHeaderEvidence,
  EditableHeaderRow,
  EditableStatblockDocument,
  EditableStatblockHeader,
  EditableStatblockNode,
  ProductHeaderField,
  StatblockFacts,
} from "./productModel.js";

export type CompileEditableOptions = {
  language?: string;
  parserStructure?: "multiline" | "singleline" | "mixed";
};

type SourcePart = {
  annotationId: string | null;
  start: number;
  end: number;
  role: string;
  section: CompiledAnnotation["section"];
  field: CompiledAnnotation["field"];
  text: string;
};

const MULTILINE_BODY_ROLES = new Set([
  "section_heading",
  "section_rules",
  "feature",
  "section_content",
  "post_statblock_content",
  "unclassified",
]);

function splitTrustedMultilineBodyPart(rawSource: string, part: SourcePart): SourcePart[] {
  if (!MULTILINE_BODY_ROLES.has(part.role)) return [part];
  const raw = rawSource.slice(part.start, part.end);
  if (!/[\r\n]/u.test(raw)) return [part];

  const rows: SourcePart[] = [];
  for (const match of raw.matchAll(/[^\r\n]+/gu)) {
    if (match.index === undefined || match[0].trim().length === 0) continue;
    rows.push({
      ...part,
      start: part.start + match.index,
      end: part.start + match.index + match[0].length,
      text: normalizeBodyPresentationText(match[0], { preservePhysicalLines: true }),
    });
  }
  return rows;
}

function uiExactLabel(english: string, language: string): string {
  if (!language.toLocaleLowerCase("en").startsWith("uk")) return english;
  return (
    TRANSLATION_GLOSSARY.find(
      (entry) =>
        entry.level === "UI_EXACT" && entry.english.toLocaleLowerCase("en") === english.toLocaleLowerCase("en"),
    )?.uk ?? english
  );
}

function standardizedNumericRow(label: string, value: number, sourceText: string, language: string): string {
  const normalized = normalizePresentationText(sourceText).trim();
  const numeric = String(value);
  const match = new RegExp(`(?<!\\d)${numeric}(?!\\d)`, "u").exec(normalized);
  const suffix = match === null ? "" : normalized.slice(match.index + match[0].length).trim();
  return `${uiExactLabel(label, language)} ${numeric}${suffix.length > 0 ? ` ${suffix}` : ""}`;
}

function standardizedInitiativeRow(modifier: number, sourceText: string, language: string): string {
  const normalized = normalizePresentationText(sourceText).trim();
  const magnitude = Math.abs(modifier);
  const signedPattern = modifier < 0 ? `[−-]${magnitude}` : `\\+${magnitude}`;
  const match = new RegExp(`(?<!\\d)${signedPattern}(?!\\d)`, "u").exec(normalized);
  const printedModifierAndSuffix =
    match === null ? `${modifier >= 0 ? "+" : ""}${modifier}` : normalized.slice(match.index).trim();
  return `${uiExactLabel("Initiative", language)} ${printedModifierAndSuffix}`;
}

function standardizedChallengeRow(value: number, sourceText: string | null, language: string): string {
  const normalized = sourceText === null ? "" : normalizePresentationText(sourceText).trim();
  // Challenge presentation is deliberately independent from the printed label:
  // preserve the first printed rating token and everything after it, while the
  // product owns one stable field name.
  const match = /(?<!\d)(\d+(?:\s*\/\s*\d+)?)(?!\d)/u.exec(normalized);
  if (match !== null) {
    const printedRatingAndSuffix = normalized.slice(match.index).trim();
    return `${uiExactLabel("Challenge Rating", language)} ${printedRatingAndSuffix}`;
  }
  return `${uiExactLabel("Challenge Rating", language)} ${value}`;
}

function exactFactSourceText(
  document: LosslessStatblockDocument,
  source: { start: number; end: number; evidence: string },
): string {
  if (0 <= source.start && source.start < source.end && source.end <= document.rawSource.length) {
    const raw = document.rawSource.slice(source.start, source.end);
    if (raw.trim().length > 0) return raw;
  }
  // Backward-compatible defensive fallback for old persisted/test fixtures whose
  // fact coordinates predate exact source ranges. New parser output never needs it.
  return source.evidence;
}

const PRIMARY_FIELDS = new Set<ProductHeaderField>(["armor_class", "initiative", "hit_points"]);

// Product header rows are deliberately a closed set. Parser uncertainty is not
// a header field: unknown/unclassified source remains editable body content
// (implicit traits before the first explicit section) instead of becoming a
// brittle line in the structured header. A human can still create a custom
// header row explicitly with the editor's “+ Рядок хедера” action.
const ALLOWED_PRODUCT_HEADER_FIELDS = new Set<ProductHeaderField>([
  "armor_class",
  "initiative",
  "hit_points",
  "ability_scores",
  "ability_modifiers",
  "saving_throws",
  "challenge",
  "proficiency_bonus",
]);

function sourceParts(document: LosslessStatblockDocument, options: CompileEditableOptions): SourcePart[] {
  const annotatedBase: SourcePart[] = document.annotations.map((annotation) => ({
    annotationId: annotation.id,
    start: annotation.source.start,
    end: annotation.source.end,
    role: annotation.role === "supplementary" ? "post_statblock_content" : annotation.role,
    section: annotation.section,
    field: annotation.field,
    // Coordinates own imported text. Annotation.text is diagnostic redundancy;
    // product compilation always re-slices immutable rawSource so a stale or
    // corrupted semantic object cannot become a second text-authority path.
    text:
      annotation.role === "header_field" || annotation.role === "header_content"
        ? normalizePresentationText(document.rawSource.slice(annotation.source.start, annotation.source.end))
        : normalizeBodyPresentationText(document.rawSource.slice(annotation.source.start, annotation.source.end), {
            preservePhysicalLines: options.parserStructure === "multiline",
          }),
  }));
  const annotated =
    options.parserStructure === "multiline"
      ? annotatedBase.flatMap((part) => splitTrustedMultilineBodyPart(document.rawSource, part))
      : annotatedBase;
  const unclassifiedBase: SourcePart[] = document.blocks
    .filter((block): block is DocumentBlock => block.kind === "unclassified" && block.text.trim().length > 0)
    .map((block) => ({
      annotationId: null,
      start: block.start,
      end: block.end,
      role: "unclassified",
      section: null,
      field: null,
      text: normalizeBodyPresentationText(block.text, {
        preservePhysicalLines: options.parserStructure === "multiline",
      }),
    }));
  const unclassified =
    options.parserStructure === "multiline"
      ? unclassifiedBase.flatMap((part) => splitTrustedMultilineBodyPart(document.rawSource, part))
      : unclassifiedBase;
  const parts = [...annotated, ...unclassified].sort((left, right) => left.start - right.start || left.end - right.end);

  // Identity ownership must not duplicate the same grounded source interval into
  // both the product name and subtitle/type slots. If an identity annotation
  // overlaps source already owned by `name`, demote only the conflicting identity
  // annotation to visible unresolved content. This never deletes source text and
  // does not guess what the real subtitle should have been.
  const nameRanges = parts
    .filter((part) => part.field === "name")
    .map((part) => ({ start: part.start, end: part.end }));
  const identityFields = new Set<ProductHeaderField>([
    "size_type_alignment",
    "size",
    "creature_type",
    "creature_subtype",
    "alignment",
  ]);
  const identitySafe = parts.flatMap((part) => {
    if (part.field === null || !identityFields.has(part.field)) return [part];
    const fullyCoveredByName = nameRanges.some((range) => range.start <= part.start && range.end >= part.end);
    if (fullyCoveredByName) return [];
    const overlapsName = nameRanges.some((range) => part.start < range.end && range.start < part.end);
    return [overlapsName ? { ...part, role: "unclassified", field: null } : part];
  });

  // Product compilation starts from source coverage, not from semantic ownership.
  // Production lossless documents already contain explicit unclassified gap blocks,
  // but rebuilding any uncovered raw interval here makes the product boundary safe
  // even for legacy/corrupt fixtures: a missing annotation/block can only reduce
  // semantics, never make source text disappear.
  const covered = [...identitySafe].sort((left, right) => left.start - right.start || left.end - right.end);
  const gaps: SourcePart[] = [];
  let cursor = 0;
  for (const part of covered) {
    const boundedStart = Math.max(0, Math.min(document.rawSource.length, part.start));
    const boundedEnd = Math.max(boundedStart, Math.min(document.rawSource.length, part.end));
    if (boundedStart > cursor) {
      const raw = document.rawSource.slice(cursor, boundedStart);
      if (raw.trim().length > 0) {
        gaps.push({
          annotationId: null,
          start: cursor,
          end: boundedStart,
          role: "unclassified",
          section: null,
          field: null,
          text: normalizeBodyPresentationText(raw, {
            preservePhysicalLines: options.parserStructure === "multiline",
          }),
        });
      }
    }
    cursor = Math.max(cursor, boundedEnd);
  }
  if (cursor < document.rawSource.length) {
    const raw = document.rawSource.slice(cursor);
    if (raw.trim().length > 0) {
      gaps.push({
        annotationId: null,
        start: cursor,
        end: document.rawSource.length,
        role: "unclassified",
        section: null,
        field: null,
        text: normalizeBodyPresentationText(raw, {
          preservePhysicalLines: options.parserStructure === "multiline",
        }),
      });
    }
  }

  const complete = [...identitySafe, ...gaps].sort((left, right) => left.start - right.start || left.end - right.end);
  return options.parserStructure === "multiline"
    ? complete.flatMap((part) => splitTrustedMultilineBodyPart(document.rawSource, part))
    : complete;
}

function joinTexts(parts: readonly SourcePart[]): string {
  return parts
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}

function fieldParts(parts: readonly SourcePart[], fields: readonly ProductHeaderField[]): SourcePart[] {
  const accepted = new Set<ProductHeaderField>(fields);
  return parts.filter((part) => part.field !== null && accepted.has(part.field));
}

function firstId(parts: readonly SourcePart[], fallback: string): string {
  return parts[0] === undefined ? fallback : `header-${parts[0].start}-${parts[0].end}`;
}

function headerRow(parts: readonly SourcePart[], field: ProductHeaderField): EditableHeaderRow | null {
  if (parts.length === 0) return null;
  return { id: firstId(parts, `header-${field}`), field, text: joinTexts(parts) };
}

function isProductHeaderOwnedPart(document: LosslessStatblockDocument, part: SourcePart): boolean {
  if (part.field === null) return false;
  if (
    part.field === "name" ||
    part.field === "size_type_alignment" ||
    part.field === "size" ||
    part.field === "creature_type" ||
    part.field === "creature_subtype" ||
    part.field === "alignment"
  )
    return true;
  if (!ALLOWED_PRODUCT_HEADER_FIELDS.has(part.field)) return false;
  if (part.field === "saving_throws") {
    // Suppress the raw printed row only when the structured save representation
    // actually captured it. Otherwise keep the source visibly editable below.
    return document.structuredHeader.savingThrows.length > 0;
  }
  return true;
}

function evidenceFromSourceParts(
  document: LosslessStatblockDocument,
  parts: readonly SourcePart[],
): EditableHeaderEvidence[] {
  const items: EditableHeaderEvidence[] = [];

  function append(
    fields: EditableHeaderEvidence["fields"],
    matching: readonly SourcePart[],
    fallbackRanges: readonly { start: number; end: number; annotationId: string }[],
  ) {
    let start: number | null = null;
    let end: number | null = null;

    if (matching.length > 0) {
      start = Math.min(...matching.map((part) => part.start));
      end = Math.max(...matching.map((part) => part.end));
    } else if (fallbackRanges.length > 0) {
      // Fact/verifier coordinates are authoritative evidence coordinates.
      // Never widen them to the whole semantic annotation: one bad annotation
      // may own adjacent body prose (Baphomet 2.74.105 demonstrated exactly
      // that), and widening here would relocate unrelated source into Evidence.
      start = Math.min(...fallbackRanges.map((range) => range.start));
      end = Math.max(...fallbackRanges.map((range) => range.end));
    }

    if (start === null || end === null || !(start < end)) return;

    // Evidence is a placement surface, not a copy list. Overlapping exact source
    // claims are represented once by their union so the same source characters
    // cannot appear twice (for example a vertical ability region that touches a
    // separately verified Saving Throws row).
    const overlapping = items.filter((item) => {
      const match = /^evidence-(\d+)-(\d+)$/u.exec(item.id);
      if (match === null) return false;
      const itemStart = Number(match[1]);
      const itemEnd = Number(match[2]);
      return itemStart < end! && start! < itemEnd;
    });
    if (overlapping.length > 0) {
      start = Math.min(start, ...overlapping.map((item) => Number(/^evidence-(\d+)-(\d+)$/u.exec(item.id)![1])));
      end = Math.max(end, ...overlapping.map((item) => Number(/^evidence-(\d+)-(\d+)$/u.exec(item.id)![2])));
      const mergedFields = new Set<EditableHeaderEvidence["fields"][number]>(fields);
      for (const item of overlapping) for (const field of item.fields) mergedFields.add(field);
      for (const item of overlapping) items.splice(items.indexOf(item), 1);
      const text = document.rawSource.slice(start, end);
      if (text.trim().length > 0) items.push({ id: `evidence-${start}-${end}`, fields: [...mergedFields], text });
      return;
    }

    const text = document.rawSource.slice(start, end);
    if (text.trim().length === 0) return;
    items.push({ id: `evidence-${start}-${end}`, fields: [...new Set(fields)], text });
  }

  const armor = document.structuredHeader.armorClass ?? null;
  if (armor !== null) {
    append(["armor_class"], [], [armor.source]);
  }

  const hitPoints = document.structuredHeader.hitPoints ?? null;
  if (hitPoints !== null) {
    append(["hit_points"], [], [hitPoints.source]);
  }

  const abilityFacts = Object.values(document.structuredHeader.abilities).filter((fact) => fact !== null);
  const abilityAnnotationIds = new Set(abilityFacts.map((fact) => fact.source.annotationId));
  if (abilityFacts.length === ABILITY_KEYS.length) {
    const region = document.structuredHeader.abilityEvidence ?? null;
    if (region !== null) {
      append(["ability_scores"], [], [region]);
    } else {
      append(
        ["ability_scores"],
        parts.filter(
          (part) =>
            part.field === "ability_scores" &&
            part.annotationId !== null &&
            abilityAnnotationIds.has(part.annotationId),
        ),
        abilityFacts.map((fact) => ({
          start: fact.source.start,
          end: fact.source.end,
          annotationId: fact.source.annotationId,
        })),
      );
    }
  }

  const saveFacts = document.structuredHeader.savingThrows;
  if (saveFacts.length > 0) {
    const abilityEvidence = items.find((item) => item.fields.includes("ability_scores"));
    const abilityRangeMatch = abilityEvidence === undefined ? null : /^evidence-(\d+)-(\d+)$/u.exec(abilityEvidence.id);
    const savesInsideAbilityEvidence =
      abilityRangeMatch !== null &&
      saveFacts.every(
        (fact) => Number(abilityRangeMatch[1]) <= fact.source.start && fact.source.end <= Number(abilityRangeMatch[2]),
      );

    if (abilityEvidence !== undefined && savesInsideAbilityEvidence) {
      abilityEvidence.fields = [
        ...new Set<EditableHeaderEvidence["fields"][number]>([...abilityEvidence.fields, "saving_throws"]),
      ];
    } else if (
      document.structuredHeader.savingThrowEvidence !== null &&
      document.structuredHeader.savingThrowEvidence !== undefined
    ) {
      append(["saving_throws"], [], [document.structuredHeader.savingThrowEvidence]);
    } else {
      const saveAnnotationIds = new Set(saveFacts.map((fact) => fact.source.annotationId));
      const saveParts = parts.filter(
        (part) =>
          part.field === "saving_throws" && part.annotationId !== null && saveAnnotationIds.has(part.annotationId),
      );
      if (saveParts.length > 0) {
        append(
          ["saving_throws"],
          saveParts,
          saveFacts.map((fact) => ({
            start: fact.source.start,
            end: fact.source.end,
            annotationId: fact.source.annotationId,
          })),
        );
      } else {
        append(
          ["saving_throws"],
          [],
          saveFacts.map((fact) => ({
            start: fact.source.start,
            end: fact.source.end,
            annotationId: fact.source.annotationId,
          })),
        );
      }
    }
  }

  const challenge = document.structuredHeader.challenge ?? null;
  if (challenge !== null && challenge.provenance !== "deterministic_cr_derivation") {
    append(["challenge"], [], [challenge.source]);
  }

  const proficiencyBonus = document.structuredHeader.proficiencyBonus ?? null;
  if (proficiencyBonus !== null && proficiencyBonus.printed) {
    // The product row is normalized presentation. Preserve the complete exact
    // printed PB source in Evidence. If PB shares a combined CR/PB source row,
    // append() merges the overlapping claims into one evidence interval.
    append(["proficiency_bonus"], [], [proficiencyBonus.source]);
  }

  return items.sort((left, right) => {
    const leftStart = Number(left.id.split("-")[1] ?? 0);
    const rightStart = Number(right.id.split("-")[1] ?? 0);
    return leftStart - rightStart;
  });
}

function evidenceRanges(evidence: readonly EditableHeaderEvidence[]): Array<{ start: number; end: number }> {
  return evidence.flatMap((item) => {
    const match = /^evidence-(\d+)-(\d+)$/u.exec(item.id);
    if (match === null) return [];
    return [{ start: Number(match[1]), end: Number(match[2]) }];
  });
}

type SourcePlacementRange = { start: number; end: number };

function normalizeRanges(ranges: readonly SourcePlacementRange[]): SourcePlacementRange[] {
  const sorted = ranges
    .filter((range) => Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) && range.start < range.end)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: SourcePlacementRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous === undefined || range.start > previous.end) {
      merged.push({ ...range });
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

function partRanges(parts: readonly SourcePart[]): SourcePlacementRange[] {
  return parts.map((part) => ({ start: part.start, end: part.end }));
}

function sourceRange(source: { start: number; end: number } | null | undefined): SourcePlacementRange[] {
  return source === null || source === undefined ? [] : [{ start: source.start, end: source.end }];
}

type HeaderProjection = {
  header: EditableStatblockHeader;
  relocatedSourceRanges: SourcePlacementRange[];
};

function buildHeader(
  document: LosslessStatblockDocument,
  parts: readonly SourcePart[],
  language: string,
): HeaderProjection {
  const evidence = evidenceFromSourceParts(document, parts);
  const relocatedSourceRanges: SourcePlacementRange[] = [...evidenceRanges(evidence)];
  const firstBodyIndex = parts.findIndex(isBodyPart);
  const headerLimit = firstBodyIndex < 0 ? parts.length : firstBodyIndex;
  const sourceHeaderParts = parts.slice(0, headerLimit);
  const headerParts = sourceHeaderParts.filter((part) => isProductHeaderOwnedPart(document, part));

  // Fixed structured header: these slots are populated from verified structured
  // facts and therefore do not depend on any former global Header/BODY boundary guess.
  const fallbackNameParts = fieldParts(headerParts, ["name"]);
  const fallbackDirectSubtitle = fieldParts(headerParts, ["size_type_alignment"]);
  const fallbackSubtitleParts =
    fallbackDirectSubtitle.length > 0
      ? fallbackDirectSubtitle
      : fieldParts(headerParts, ["size", "creature_type", "creature_subtype", "alignment"]);

  const structuredName = document.structuredHeader.name ?? null;
  const structuredType = document.structuredHeader.sizeTypeAlignment ?? null;
  const nameText =
    structuredName === null ? joinTexts(fallbackNameParts) : exactFactSourceText(document, structuredName.source);
  const subtitleText =
    structuredType === null ? joinTexts(fallbackSubtitleParts) : exactFactSourceText(document, structuredType.source);
  relocatedSourceRanges.push(
    ...(structuredName === null ? partRanges(fallbackNameParts) : sourceRange(structuredName.source)),
  );
  if (subtitleText.trim().length > 0) {
    relocatedSourceRanges.push(
      ...(structuredType === null ? partRanges(fallbackSubtitleParts) : sourceRange(structuredType.source)),
    );
  }

  const rows: EditableHeaderRow[] = [];
  const armor = document.structuredHeader.armorClass ?? null;
  const hitPoints = document.structuredHeader.hitPoints ?? null;
  const printedInitiative = document.structuredHeader.initiative ?? null;
  const challenge = document.structuredHeader.challenge ?? null;

  // armor_type is not an independent fixed-header field, but when it is printed
  // beside AC it remains source-visible presentation and must be folded into the
  // AC row rather than discarded by the fixed-header allow-list.
  const sourceArmorRow = headerRow(fieldParts(sourceHeaderParts, ["armor_class", "armor_type"]), "armor_class");
  if (armor !== null) {
    rows.push({
      id: `header-fixed-ac-${armor.source.start}-${armor.source.end}`,
      field: "armor_class",
      // Standardize the product label while preserving the exact numeric value
      // and every printed qualifier after it. The original row lives in Evidence.
      text: standardizedNumericRow(
        "Armor Class",
        armor.value,
        sourceArmorRow?.text ?? exactFactSourceText(document, armor.source),
        language,
      ),
    });
  } else if (sourceArmorRow !== null) {
    rows.push(sourceArmorRow);
    relocatedSourceRanges.push(...partRanges(fieldParts(sourceHeaderParts, ["armor_class", "armor_type"])));
  }

  const sourceInitiativeRow = headerRow(fieldParts(headerParts, ["initiative"]), "initiative");
  if (printedInitiative !== null) {
    rows.push({
      id: `header-fixed-init-${printedInitiative.source.start}-${printedInitiative.source.end}`,
      field: "initiative",
      // The verifier may ground Initiative to a compact row shared with AC.
      // Product presentation owns the canonical label, while source evidence owns
      // the original row. Preserve the printed Initiative tail from its proven
      // signed modifier onward instead of leaking the preceding AC label/value.
      text: standardizedInitiativeRow(
        printedInitiative.value,
        sourceInitiativeRow?.text ?? exactFactSourceText(document, printedInitiative.source),
        language,
      ),
    });
    relocatedSourceRanges.push(...sourceRange(printedInitiative.source));
  } else if (sourceInitiativeRow !== null) {
    // Direct/legacy compiled documents may predate structuredHeader facts.
    // Semantic ownership is sufficient to preserve an explicitly printed row;
    // fact extraction below still validates its signed numeric shape.
    rows.push(sourceInitiativeRow);
    relocatedSourceRanges.push(...partRanges(fieldParts(headerParts, ["initiative"])));
  }

  const sourceHitPointsRow = headerRow(fieldParts(headerParts, ["hit_points"]), "hit_points");
  if (hitPoints !== null) {
    rows.push({
      id: `header-fixed-hp-${hitPoints.source.start}-${hitPoints.source.end}`,
      field: "hit_points",
      text: standardizedNumericRow(
        "Hit Points",
        hitPoints.value,
        sourceHitPointsRow?.text ?? exactFactSourceText(document, hitPoints.source),
        language,
      ),
    });
  } else if (sourceHitPointsRow !== null) {
    rows.push(sourceHitPointsRow);
    relocatedSourceRanges.push(...partRanges(fieldParts(headerParts, ["hit_points"])));
  }

  // Initiative is required by the combat card. If no printed field was verified,
  // derive it from the proven DEX modifier; this is an explicit product fallback,
  // not source ownership.
  if (!rows.some((row) => row.field === "initiative")) {
    const dexModifier = document.structuredHeader.abilities.dex?.modifier ?? null;
    if (dexModifier !== null) {
      const initiativeRow: EditableHeaderRow = {
        id: "header-initiative-derived",
        field: "initiative",
        text: `${uiExactLabel("Initiative", language)} ${dexModifier >= 0 ? "+" : ""}${dexModifier}`,
      };
      const armorIndex = rows.findIndex((row) => row.field === "armor_class");
      rows.splice(armorIndex >= 0 ? armorIndex + 1 : 0, 0, initiativeRow);
    }
  }

  // AC and HP are permanent card slots. Failed verification stays visibly empty
  // instead of allowing an unrelated source number to fill the card.
  if (!rows.some((row) => row.field === "armor_class")) {
    rows.unshift({
      id: "header-armor-class-required",
      field: "armor_class",
      text: uiExactLabel("Armor Class", language),
    });
  }
  if (!rows.some((row) => row.field === "hit_points")) {
    const armorIndex = rows.findIndex((row) => row.field === "armor_class");
    rows.splice(armorIndex + 1, 0, {
      id: "header-hit-points-required",
      field: "hit_points",
      text: uiExactLabel("Hit Points", language),
    });
  }

  const sourceChallengeRow = headerRow(fieldParts(headerParts, ["challenge"]), "challenge");
  if (challenge !== null) {
    const exactSource =
      challenge.provenance === "deterministic_cr_derivation" ? null : exactFactSourceText(document, challenge.source);
    rows.push({
      id: `header-fixed-cr-${challenge.source.start}-${challenge.source.end}`,
      field: "challenge",
      text: standardizedChallengeRow(challenge.value, exactSource ?? sourceChallengeRow?.text ?? null, language),
    });
  } else if (sourceChallengeRow !== null) {
    // Legacy documents without a structured CR still preserve their source row.
    rows.push(sourceChallengeRow);
    relocatedSourceRanges.push(...partRanges(fieldParts(headerParts, ["challenge"])));
  }

  if (document.structuredHeader.proficiencyBonus !== null) {
    const pb = document.structuredHeader.proficiencyBonus;
    const sourcePbParts = fieldParts(headerParts, ["proficiency_bonus"]);
    const sourcePbRow = headerRow(sourcePbParts, "proficiency_bonus");
    const generatedPb = `${uiExactLabel("Proficiency Bonus", language)} ${pb.value >= 0 ? "+" : ""}${pb.value}`;
    const challengeSourceRange =
      challenge === null ? null : { start: challenge.source.start, end: challenge.source.end };
    const dedicatedPbRow =
      sourcePbRow !== null &&
      sourcePbParts.every(
        (part) =>
          challengeSourceRange === null ||
          !(part.start < challengeSourceRange.end && challengeSourceRange.start < part.end),
      );
    rows.push({
      id: pb.printed ? `header-fixed-pb-${pb.source.start}-${pb.source.end}` : "header-proficiency-bonus-derived",
      field: "proficiency_bonus",
      // A verifier or semantic proposal may ground PB inside the same combined CR
      // row. Reprinting that row as the PB slot duplicates Challenge Rating. A
      // source PB row is used only when it is spatially independent from CR; all
      // combined/derived cases materialize the numeric PB deterministically.
      text: pb.printed && dedicatedPbRow && sourcePbRow !== null ? sourcePbRow.text : generatedPb,
    });
    if (pb.printed) relocatedSourceRanges.push(...sourceRange(pb.source));
  }

  const abilities: EditableStatblockHeader["abilities"] = {
    str: null,
    dex: null,
    con: null,
    int: null,
    wis: null,
    cha: null,
  };
  for (const ability of ABILITY_KEYS) {
    const fact = document.structuredHeader.abilities[ability];
    if (fact !== null) abilities[ability] = { score: fact.score, modifier: fact.modifier };
  }

  const savingThrows: EditableStatblockHeader["savingThrows"] = {
    str: null,
    dex: null,
    con: null,
    int: null,
    wis: null,
    cha: null,
  };
  const printed = new Map(document.structuredHeader.savingThrows.map((save) => [save.ability, save.bonus] as const));
  const printedSaveCount = ABILITY_KEYS.filter(
    (ability) => document.structuredHeader.abilities[ability]?.printedSave !== null,
  ).length;
  const sourceHasSaveColumn = printedSaveCount >= 4;
  for (const ability of ABILITY_KEYS) {
    const printedValue = printed.get(ability);
    if (printedValue !== undefined) savingThrows[ability] = printedValue;
    else if (sourceHasSaveColumn) savingThrows[ability] = null;
    else savingThrows[ability] = abilities[ability]?.modifier ?? null;
  }

  const header: EditableStatblockHeader = {
    name: {
      id:
        structuredName === null
          ? firstId(fallbackNameParts, "header-name")
          : `header-fixed-name-${structuredName.source.start}-${structuredName.source.end}`,
      field: "name",
      text: nameText,
    },
    subtitle:
      subtitleText.trim().length === 0
        ? null
        : {
            id:
              structuredType === null
                ? firstId(fallbackSubtitleParts, "header-subtitle")
                : `header-fixed-type-${structuredType.source.start}-${structuredType.source.end}`,
            field: "size_type_alignment",
            text: subtitleText,
          },
    primaryRows: rows.filter((row) => PRIMARY_FIELDS.has(row.field)),
    abilities,
    savingThrows,
    secondaryRows: rows.filter((row) => !PRIMARY_FIELDS.has(row.field)),
    evidence,
  };
  return { header, relocatedSourceRanges: normalizeRanges(relocatedSourceRanges) };
}

function isBodyPart(part: SourcePart): boolean {
  if (part.section !== null) return true;
  return (
    part.role === "section_heading" ||
    part.role === "section_rules" ||
    part.role === "feature" ||
    part.role === "section_content" ||
    part.role === "post_statblock_content"
  );
}

function subtractRelocatedRanges(
  document: LosslessStatblockDocument,
  part: SourcePart,
  relocated: readonly SourcePlacementRange[],
  options: CompileEditableOptions,
): SourcePart[] {
  let segments: Array<{ start: number; end: number }> = [{ start: part.start, end: part.end }];
  for (const range of relocated) {
    const next: Array<{ start: number; end: number }> = [];
    for (const segment of segments) {
      if (range.end <= segment.start || segment.end <= range.start) {
        next.push(segment);
        continue;
      }
      if (segment.start < range.start) next.push({ start: segment.start, end: range.start });
      if (range.end < segment.end) next.push({ start: range.end, end: segment.end });
    }
    segments = next;
    if (segments.length === 0) break;
  }

  return segments.flatMap((segment) => {
    const raw = document.rawSource.slice(segment.start, segment.end);
    if (raw.trim().length === 0) return [];
    const intact = segment.start === part.start && segment.end === part.end;
    const sliced: SourcePart = {
      ...part,
      start: segment.start,
      end: segment.end,
      // A partial semantic span is no longer allowed to inherit the original
      // annotation's narrower role. The remaining exact source stays visible,
      // but semantics abstain rather than pretending the cropped fragment is
      // still a complete header field/heading/feature.
      role: intact ? part.role : "unclassified",
      section: intact ? part.section : null,
      field: intact ? part.field : null,
      text: intact
        ? part.text
        : normalizeBodyPresentationText(raw, {
            preservePhysicalLines: options.parserStructure === "multiline",
          }),
    };
    return options.parserStructure === "multiline"
      ? splitTrustedMultilineBodyPart(document.rawSource, sliced)
      : [sliced];
  });
}

type BodyProjection = {
  nodes: EditableStatblockNode[];
  sourceRanges: SourcePlacementRange[];
};

function buildBody(
  document: LosslessStatblockDocument,
  parts: readonly SourcePart[],
  relocatedSourceRanges: readonly SourcePlacementRange[],
  options: CompileEditableOptions,
): BodyProjection {
  // The BODY is the default placement for source. Semantic ownership never has
  // omission authority. Exact ranges leave this stream only when buildHeader()
  // has already materialized that same source in another visible product surface
  // (name/subtitle/header row/Evidence). Wrong LLM roles can therefore damage
  // structure, but cannot make source content disappear.
  const ranges = normalizeRanges(relocatedSourceRanges);
  const bodyParts = parts.flatMap((part) => subtractRelocatedRanges(document, part, ranges, options));

  const visibleParts = bodyParts.filter((part) => part.text.trim().length > 0);
  const nodes = visibleParts.map((part, index): EditableStatblockNode =>
    part.role === "section_heading"
      ? {
          id: `node-${part.start}-${part.end}-${index}`,
          type: "heading",
          headingKind: part.section,
          text: part.text,
        }
      : {
          id: `node-${part.start}-${part.end}-${index}`,
          type: "paragraph",
          text: part.text,
        },
  );
  return {
    nodes,
    sourceRanges: normalizeRanges(visibleParts.map((part) => ({ start: part.start, end: part.end }))),
  };
}

function assertProductSourceCoverage(
  document: LosslessStatblockDocument,
  relocatedSourceRanges: readonly SourcePlacementRange[],
  bodySourceRanges: readonly SourcePlacementRange[],
): void {
  const visible = normalizeRanges([...relocatedSourceRanges, ...bodySourceRanges]);
  const missing = document.sourceMap.units.filter(
    (unit) => unit.kind === "content" && !visible.some((range) => range.start <= unit.start && unit.end <= range.end),
  );
  if (missing.length > 0) {
    throw new Error(`Product source projection lost ${missing.length} source content unit(s); compilation aborted.`);
  }
}

function stripMarkup(text: string): string {
  return text.replace(/\*\*/gu, "").replace(/\*/gu, "");
}

function parseUnsigned(text: string | null, expression: RegExp): number | null {
  if (text === null) return null;
  const match = expression.exec(stripMarkup(text));
  if (match === null) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

function parseSigned(text: string | null, expression: RegExp): number | null {
  if (text === null) return null;
  const match = expression.exec(stripMarkup(text));
  if (match === null) return null;
  const value = Number(match[1].replace(/[−–—]/gu, "-"));
  return Number.isSafeInteger(value) ? value : null;
}

function rowText(header: EditableStatblockHeader, field: ProductHeaderField): string | null {
  return [...header.primaryRows, ...header.secondaryRows].find((row) => row.field === field)?.text ?? null;
}

function buildFacts(document: LosslessStatblockDocument, header: EditableStatblockHeader): StatblockFacts {
  const dexModifier = header.abilities.dex?.modifier ?? null;
  const initiativeRow =
    [...header.primaryRows, ...header.secondaryRows].find((row) => row.field === "initiative") ?? null;
  // `initiativeRow` is already semantically owned as the initiative field, so
  // fact extraction must not require the English printed label a second time.
  // Initiative bonuses are normally explicitly signed; using that mechanical
  // shape also avoids mistaking the parenthesized initiative score for the bonus.
  const printedInitiative = parseSigned(initiativeRow?.text ?? null, /([+\-−–—]\d+)/u);
  const initiativeIsDerivedDex = initiativeRow?.id === "header-initiative-derived";

  return {
    name:
      header.name === null || stripMarkup(header.name.text).trim().length === 0 ? null : stripMarkup(header.name.text),
    armorClass: parseUnsigned(rowText(header, "armor_class"), /\b(\d+)\b/u),
    hitPointMaximum: parseUnsigned(rowText(header, "hit_points"), /\b(\d+)\b/u),
    initiative:
      printedInitiative !== null
        ? { modifier: printedInitiative, provenance: initiativeIsDerivedDex ? "dex_modifier" : "printed" }
        : dexModifier === null
          ? null
          : { modifier: dexModifier, provenance: "dex_modifier" },
    abilities: structuredClone(header.abilities),
    savingThrows: structuredClone(header.savingThrows),
    proficiencyBonus: document.structuredHeader.proficiencyBonus?.value ?? null,
  };
}

export function compileToEditableStatblock(
  document: LosslessStatblockDocument,
  options: CompileEditableOptions = {},
): EditableStatblockDocument {
  const parts = sourceParts(document, options);
  const language = options.language ?? "en";
  const projection = buildHeader(document, parts, language);
  const header = projection.header;
  const body = buildBody(document, parts, projection.relocatedSourceRanges, options);
  assertProductSourceCoverage(document, projection.relocatedSourceRanges, body.sourceRanges);
  const compiled: EditableStatblockDocument = {
    formatVersion: "editable-statblock-v2",
    language,
    header,
    body: body.nodes,
    facts: buildFacts(document, header),
  };

  // Parser-created documents receive the standard presentation exactly once,
  // after semantic compilation is complete. Opening/saving/editing an existing
  // document never re-runs Auto Style, so later human formatting stays authoritative.
  return applyEditableAutoStyle(compiled);
}
