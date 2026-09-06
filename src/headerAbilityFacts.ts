import {
  ABILITY_KEYS,
  type AbilityKey,
  type AbilityScoreFact,
  type CompiledAnnotation,
  type HeaderFactSource,
  type LosslessStatblockDocument,
  type ParseIssue,
  type SavingThrowFact,
  type StructuredHeader,
} from "./domain.js";
import type { ModelAbilityLabel, ModelAbilityRow, ModelSavingThrow, ParsedModelHeaderFacts } from "./modelSchema.js";
import {
  ABILITY_VALUE_PATTERN,
  abilityModifier,
  countNumber,
  headerAnnotations,
  issue,
  locateQuote,
  normalizeSignedNumber,
  type AbilityLabel,
  type AbilityValue,
} from "./headerFactPrimitives.js";
export function groundedModelAbilityLabels(
  document: LosslessStatblockDocument,
  rows: ModelAbilityRow[],
  issues: ParseIssue[],
): Map<string, AbilityLabel[]> {
  const annotations = headerAnnotations(document, ["ability_scores"]);
  const grounded = new Map<string, AbilityLabel[]>();

  for (const row of rows) {
    const tableOccurrences = annotations.flatMap((annotation) => {
      const source = locateQuote(annotation, row.sourceQuote);
      return source === null ? [] : [{ annotation, source }];
    });

    if (tableOccurrences.length !== 1) {
      issues.push(
        issue(
          "ungrounded_header_ability",
          "warning",
          "A model-proposed ability label was rejected because its exact ability-table evidence was not uniquely grounded.",
          { ability: row.ability, labelQuote: row.labelQuote, sourceQuote: row.sourceQuote },
        ),
      );
      continue;
    }

    const { annotation, source: tableSource } = tableOccurrences[0];
    const labelSource = locateQuote(annotation, row.labelQuote);

    if (labelSource === null || labelSource.start < tableSource.start || labelSource.end > tableSource.end) {
      issues.push(
        issue(
          "ungrounded_header_ability",
          "warning",
          "A model-proposed ability label was rejected because its exact label was not uniquely grounded inside the claimed ability table.",
          { ability: row.ability, labelQuote: row.labelQuote, sourceQuote: row.sourceQuote },
        ),
      );
      continue;
    }

    const current = grounded.get(annotation.id) ?? [];
    current.push({
      ability: row.ability,
      text: labelSource.evidence,
      start: labelSource.start - annotation.source.start,
      end: labelSource.end - annotation.source.start,
      provenance: "model",
    });
    grounded.set(annotation.id, current);
  }

  return grounded;
}

/*
 * Канонічний STR/DEX/... є сильнішим доказом за модельний mapping. Модель додає лише
 * ті labels, яких код сам не розуміє. Будь-яка суперечність position→ability або
 * ability→position робить весь набір labels непридатним для позиційного розбору.
 */
export function validateModelAbilityLabels(model: AbilityLabel[]): AbilityLabel[] | null {
  const abilities = new Set<AbilityKey>();
  const positions = new Set<string>();

  for (const label of model) {
    const position = `${label.start}:${label.end}`;
    if (abilities.has(label.ability) || positions.has(position)) return null;
    abilities.add(label.ability);
    positions.add(position);
  }

  return [...model].sort((left, right) => left.start - right.start);
}

export function parseAbilityValueMatch(match: RegExpMatchArray): AbilityValue | null {
  if (match.index === undefined) return null;

  const score = Number(match[1]);
  if (!Number.isInteger(score)) return null;

  const printedModifierText = match[2] ?? match[3] ?? null;
  const printedModifier = printedModifierText === null ? null : normalizeSignedNumber(printedModifierText);
  const printedSave = match[4] === undefined ? null : normalizeSignedNumber(match[4]);
  const modifier = abilityModifier(score);

  if (printedModifier !== null && printedModifier !== modifier) return null;

  return {
    score,
    modifier,
    printedModifier,
    printedSave,
    start: match.index,
    end: match.index + match[0].length,
  };
}

export function abilityFact(
  annotation: CompiledAnnotation,
  label: AbilityLabel,
  value: AbilityValue,
  start: number,
  end: number,
): AbilityScoreFact {
  return {
    ability: label.ability,
    score: value.score,
    modifier: value.modifier,
    printedModifier: value.printedModifier,
    printedSave: value.printedSave,
    provenance: label.provenance === "model" ? "model_evidence" : "deterministic_header_parse",
    source: {
      annotationId: annotation.id,
      start: annotation.source.start + start,
      end: annotation.source.start + end,
      evidence: annotation.text.slice(start, end),
    },
  };
}

/*
 * Row layout: label і його numeric cell стоять поруч у потоці тексту.
 * Працює для STR 21 (+5), вертикальних STR\n21 (+5), а також Mod/Save таблиць.
 * Для кожного label між ним і наступним label мусить існувати рівно один numeric cell.
 */
export function parseRowAbilityTable(
  annotation: CompiledAnnotation,
  labels: AbilityLabel[],
): AbilityScoreFact[] | null {
  if (labels.length === 0) return null;

  const hasSaveColumn = /\bmod\b[\s\S]*?\bsave\b/iu.test(annotation.text);
  const rows: AbilityScoreFact[] = [];

  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    const nextLabelStart = labels[index + 1]?.start ?? annotation.text.length;
    const region = annotation.text.slice(label.end, nextLabelStart);
    const rawMatches = Array.from(region.matchAll(ABILITY_VALUE_PATTERN));

    if (rawMatches.length !== 1) return null;

    const value = parseAbilityValueMatch(rawMatches[0]);
    if (value === null) return null;
    if (hasSaveColumn && value.printedSave === null) return null;

    const valueEnd = label.end + value.end;
    rows.push(abilityFact(annotation, label, value, label.start, valueEnd));
  }

  return rows;
}

/*
 * Matrix layout: спочатку надруковані всі шість labels, після них — рівно шість
 * numeric cells. Позиція cell N однозначно відповідає label N. Переноси рядків
 * не мають значення, тому підтримуються і звичайні дворядкові таблиці, і PDF-wrap.
 */
export function parseMatrixAbilityTable(
  annotation: CompiledAnnotation,
  labels: AbilityLabel[],
): AbilityScoreFact[] | null {
  if (labels.length !== ABILITY_KEYS.length) return null;

  const lastLabelEnd = labels[labels.length - 1].end;
  const tail = annotation.text.slice(lastLabelEnd);
  const rawMatches = Array.from(tail.matchAll(ABILITY_VALUE_PATTERN));

  if (rawMatches.length !== ABILITY_KEYS.length) return null;

  const values = rawMatches.map(parseAbilityValueMatch);
  if (values.some((value) => value === null)) return null;

  const groundedValues = values as AbilityValue[];
  const firstValueStart = lastLabelEnd + groundedValues[0].start;
  const betweenLabelsAndValues = annotation.text.slice(lastLabelEnd, firstValueStart);

  if (!/^[\s|,:;()[\]{}\-–—]*$/u.test(betweenLabelsAndValues)) return null;

  const hasSaveColumn = /\bmod\b[\s\S]*?\bsave\b/iu.test(annotation.text);
  if (hasSaveColumn && groundedValues.some((value) => value.printedSave === null)) return null;

  return labels.map((label, index) => {
    const value = groundedValues[index];
    const valueStart = lastLabelEnd + value.start;
    const valueEnd = lastLabelEnd + value.end;
    return abilityFact(annotation, label, value, Math.min(label.start, valueStart), Math.max(label.end, valueEnd));
  });
}

/*
 * Числові ability facts завжди походять із детермінованого layout parse.
 * Модель може лише grounded-підказкою зіставити нестандартний надрукований label
 * з canonical ability key; вона не постачає score/modifier/save.
 */
export function deterministicAbilityRows(
  document: LosslessStatblockDocument,
  modelRows: ModelAbilityRow[],
  issues: ParseIssue[],
): AbilityScoreFact[] {
  const rows: AbilityScoreFact[] = [];
  const modelLabelsByAnnotation = groundedModelAbilityLabels(document, modelRows, issues);

  for (const annotation of headerAnnotations(document, ["ability_scores"])) {
    const labels = validateModelAbilityLabels(modelLabelsByAnnotation.get(annotation.id) ?? []);

    if (labels === null || labels.length === 0) {
      if (labels === null) {
        issues.push(
          issue(
            "conflicting_ability_labels",
            "warning",
            "Grounded ability labels conflict about their canonical identities or positions, so the ability block was left unstructured.",
            { evidence: annotation.text },
          ),
        );
      }
      continue;
    }

    const rowLayout = parseRowAbilityTable(annotation, labels);
    if (rowLayout !== null) {
      rows.push(...rowLayout);
      continue;
    }

    const matrixLayout = parseMatrixAbilityTable(annotation, labels);
    if (matrixLayout !== null) {
      rows.push(...matrixLayout);
      continue;
    }

    issues.push(
      issue(
        "unrecognized_ability_layout",
        "warning",
        "The ability-score block and its labels were grounded, but the label/value layout could not be proven safely.",
        { evidence: annotation.text },
      ),
    );
  }

  return rows;
}

export function groundModelSavingThrows(
  document: LosslessStatblockDocument,
  saves: ModelSavingThrow[],
  issues: ParseIssue[],
): SavingThrowFact[] {
  const annotations = headerAnnotations(document, ["ability_scores", "saving_throws"]);
  const grounded: SavingThrowFact[] = [];

  for (const save of saves) {
    const occurrences = annotations.flatMap((annotation) => {
      const source = locateQuote(annotation, save.sourceQuote);
      return source === null ? [] : [source];
    });

    if (occurrences.length !== 1 || countNumber(occurrences[0].evidence, save.bonus, true) < 1) {
      issues.push(
        issue(
          "ungrounded_header_save",
          "warning",
          "A model-proposed saving throw was rejected because its exact local evidence or signed bonus was not uniquely grounded.",
          { ability: save.ability, bonus: save.bonus, sourceQuote: save.sourceQuote },
        ),
      );
      continue;
    }

    grounded.push({ ability: save.ability, bonus: save.bonus, provenance: "model_evidence", source: occurrences[0] });
  }

  return grounded;
}

export function deterministicStandaloneSavingThrows(
  document: LosslessStatblockDocument,
  modelLabels: readonly ModelAbilityLabel[],
  issues: ParseIssue[],
): SavingThrowFact[] {
  const annotations = headerAnnotations(document, ["saving_throws"]);
  if (annotations.length === 0) return [];

  const labelClaims: Array<{ ability: AbilityKey; text: string }> = modelLabels.map((label) => ({
    ability: label.ability,
    text: label.labelQuote,
  }));
  const byPrintedLabel = new Map<string, AbilityKey | null>();
  for (const claim of labelClaims) {
    const key = claim.text.normalize("NFKC").toLocaleLowerCase();
    const previous = byPrintedLabel.get(key);
    if (previous === undefined) byPrintedLabel.set(key, claim.ability);
    else if (previous !== claim.ability) byPrintedLabel.set(key, null);
  }

  const facts: SavingThrowFact[] = [];
  const seenAbility = new Map<AbilityKey, number>();
  for (const annotation of annotations) {
    for (const claim of labelClaims) {
      const key = claim.text.normalize("NFKC").toLocaleLowerCase();
      if (byPrintedLabel.get(key) !== claim.ability) continue;
      const escaped = claim.text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])\\s*([+\\-−‒–—﹣－＋]\\d{1,3})`,
        "giu",
      );
      const matches = Array.from(annotation.text.matchAll(pattern));
      if (matches.length !== 1) continue;
      const match = matches[0]!;
      const bonus = normalizeSignedNumber(match[1]!);
      const previous = seenAbility.get(claim.ability);
      if (previous !== undefined) {
        if (previous !== bonus) {
          issues.push(
            issue(
              "conflicting_printed_header_save",
              "warning",
              "More than one different explicitly printed saving-throw bonus was grounded for the same ability; the ambiguous extra value was ignored.",
              { ability: claim.ability, first: previous, second: bonus },
            ),
          );
        }
        continue;
      }
      seenAbility.set(claim.ability, bonus);
      facts.push({
        ability: claim.ability,
        bonus,
        provenance: "deterministic_header_parse",
        source: {
          annotationId: annotation.id,
          start: annotation.source.start + match.index!,
          end: annotation.source.start + match.index! + match[0].length,
          evidence: match[0],
        },
      });
    }
  }
  return facts;
}

export function physicalRowEvidenceFromSource(
  document: LosslessStatblockDocument,
  source: HeaderFactSource | null | undefined,
  annotationId: string,
): HeaderFactSource | null {
  if (source === null || source === undefined) return null;
  if (!(0 <= source.start && source.start < source.end && source.end <= document.rawSource.length)) return null;

  let start = source.start;
  while (start > 0 && !/[\r\n]/u.test(document.rawSource[start - 1] ?? "")) start -= 1;
  let end = source.end;
  while (end < document.rawSource.length && !/[\r\n]/u.test(document.rawSource[end] ?? "")) end += 1;

  while (start < end && /[ \t]/u.test(document.rawSource[start] ?? "")) start += 1;
  while (end > start && /[ \t]/u.test(document.rawSource[end - 1] ?? "")) end -= 1;
  if (!(start < end)) return null;

  return {
    annotationId,
    start,
    end,
    evidence: document.rawSource.slice(start, end),
  };
}

export function sharedPhysicalSavingThrowRowEvidence(
  document: LosslessStatblockDocument,
  savingThrows: readonly SavingThrowFact[],
  abilityEvidence: HeaderFactSource | null,
): HeaderFactSource | null {
  if (savingThrows.length === 0) return null;
  const row = physicalRowEvidenceFromSource(document, savingThrows[0]?.source, "structured-saving-throw-row");
  if (row === null || row.evidence.length > 640) return null;
  if (!savingThrows.every((save) => row.start <= save.source.start && save.source.end <= row.end)) return null;

  // A save column embedded in the proven ability table is already owned by the
  // ability evidence. Do not manufacture a duplicate wider evidence row there.
  if (abilityEvidence !== null && row.start < abilityEvidence.end && abilityEvidence.start < row.end) return null;
  return row;
}

export function modelGuidedAdjacentSavingThrows(
  document: LosslessStatblockDocument,
  abilityRegion: { start: number; end: number } | null | undefined,
  modelLabels: readonly ModelAbilityLabel[],
  issues: ParseIssue[],
): SavingThrowFact[] {
  if (abilityRegion === null || abilityRegion === undefined || modelLabels.length !== ABILITY_KEYS.length) return [];
  if (!/[\r\n]/u.test(document.rawSource)) return [];

  let start = abilityRegion.end;
  while (start < document.rawSource.length && /\s/u.test(document.rawSource[start]!)) start += 1;
  if (start >= document.rawSource.length) return [];
  const lineBreak = document.rawSource.slice(start).search(/[\r\n]/u);
  const end = lineBreak < 0 ? document.rawSource.length : start + lineBreak;
  const text = document.rawSource.slice(start, end);
  if (text.trim().length === 0 || text.length > 640) return [];

  const byPrintedLabel = new Map<string, AbilityKey | null>();
  for (const claim of modelLabels) {
    const key = claim.labelQuote.normalize("NFKC").toLocaleLowerCase();
    const previous = byPrintedLabel.get(key);
    if (previous === undefined) byPrintedLabel.set(key, claim.ability);
    else if (previous !== claim.ability) byPrintedLabel.set(key, null);
  }

  const matches: Array<{ ability: AbilityKey; bonus: number; start: number; end: number; evidence: string }> = [];
  const consumed = new Set<string>();
  for (const claim of modelLabels) {
    const key = claim.labelQuote.normalize("NFKC").toLocaleLowerCase();
    const claimKey = `${claim.ability}:${key}`;
    if (consumed.has(claimKey) || byPrintedLabel.get(key) !== claim.ability) continue;
    consumed.add(claimKey);
    const escaped = claim.labelQuote.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])\\s*([+\\-−‒–—﹣－＋]\\d{1,3})`,
      "giu",
    );
    for (const match of text.matchAll(pattern)) {
      matches.push({
        ability: claim.ability,
        bonus: normalizeSignedNumber(match[1]!),
        start: start + match.index!,
        end: start + match.index! + match[0].length,
        evidence: match[0],
      });
    }
  }

  const signedTokens = Array.from(text.matchAll(/[+\-−‒–—﹣－＋]\d{1,3}/gu));
  const uniqueAbilities = new Set(matches.map((match) => match.ability));
  if (matches.length === 0 || uniqueAbilities.size !== matches.length || signedTokens.length !== matches.length)
    return [];

  issues.push(
    issue(
      "model_guided_adjacent_save_region_proven",
      "info",
      "The first compact physical row after the proven ability table contained only model-grounded ability labels paired with signed values, so those exact printed values were retained as saving throws without a language dictionary.",
      { start, end, matchedPairs: matches.length },
    ),
  );
  return matches.map((match) => {
    const owner = document.annotations.find(
      (annotation) => annotation.source.start <= match.start && annotation.source.end >= match.end,
    );
    return {
      ability: match.ability,
      bonus: match.bonus,
      provenance: "model_evidence" as const,
      source: {
        annotationId: owner?.id ?? "model-guided-adjacent-save",
        start: match.start,
        end: match.end,
        evidence: match.evidence,
      },
    };
  });
}

export function verifiedEssentialStandaloneSavingThrows(
  document: LosslessStatblockDocument,
  regions: NonNullable<ParsedModelHeaderFacts["essentialRegions"]>,
  modelLabels: readonly ModelAbilityLabel[],
  issues: ParseIssue[],
): SavingThrowFact[] {
  const labelClaims: Array<{ ability: AbilityKey; text: string }> = modelLabels.map((label) => ({
    ability: label.ability,
    text: label.labelQuote,
  }));
  const byPrintedLabel = new Map<string, AbilityKey | null>();
  for (const claim of labelClaims) {
    const key = claim.text.normalize("NFKC").toLocaleLowerCase();
    const previous = byPrintedLabel.get(key);
    if (previous === undefined) byPrintedLabel.set(key, claim.ability);
    else if (previous !== claim.ability) byPrintedLabel.set(key, null);
  }

  const facts: SavingThrowFact[] = [];
  for (const region of regions.filter((candidate) => candidate.kind === "saving_throws")) {
    if (!(0 <= region.start && region.start < region.end && region.end <= document.rawSource.length)) continue;
    const text = document.rawSource.slice(region.start, region.end);
    if (text.trim().length === 0 || text.length > 640) {
      issues.push(
        issue(
          "invalid_verified_save_region",
          "warning",
          "A verifier-proposed saving-throw region was rejected because its grounded span was empty or implausibly large.",
          { start: region.start, end: region.end },
        ),
      );
      continue;
    }

    const matches: Array<{ ability: AbilityKey; bonus: number; start: number; end: number; evidence: string }> = [];
    const consumedClaims = new Set<string>();
    for (const claim of labelClaims) {
      const key = claim.text.normalize("NFKC").toLocaleLowerCase();
      const claimKey = `${claim.ability}:${key}`;
      if (consumedClaims.has(claimKey)) continue;
      consumedClaims.add(claimKey);
      if (byPrintedLabel.get(key) !== claim.ability) continue;
      const escaped = claim.text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])\\s*([+\\-−‒–—﹣－＋]\\d{1,3})`,
        "giu",
      );
      for (const match of text.matchAll(pattern)) {
        matches.push({
          ability: claim.ability,
          bonus: normalizeSignedNumber(match[1]!),
          start: region.start + match.index!,
          end: region.start + match.index! + match[0].length,
          evidence: match[0],
        });
      }
    }

    const signedTokens = Array.from(text.matchAll(/[+\-−‒–—﹣－＋]\d{1,3}/gu));
    const uniqueAbilities = new Set(matches.map((match) => match.ability));
    if (matches.length === 0 || uniqueAbilities.size !== matches.length || signedTokens.length !== matches.length) {
      issues.push(
        issue(
          "unproven_verified_save_region",
          "warning",
          "A verifier-proposed saving-throw region was preserved as source but rejected for structured facts because its ability/bonus structure was incomplete, duplicated, or contained unexplained signed numbers.",
          { start: region.start, end: region.end, matchedPairs: matches.length, signedTokenCount: signedTokens.length },
        ),
      );
      continue;
    }

    for (const match of matches) {
      const owner = document.annotations.find(
        (annotation) => annotation.source.start <= match.start && annotation.source.end >= match.end,
      );
      facts.push({
        ability: match.ability,
        bonus: match.bonus,
        provenance: "model_evidence",
        source: {
          annotationId: owner?.id ?? "verified-essential-region",
          start: match.start,
          end: match.end,
          evidence: match.evidence,
        },
      });
    }
  }
  return facts;
}

export function deterministicSavingThrows(
  _document: LosslessStatblockDocument,
  rows: AbilityScoreFact[],
): SavingThrowFact[] {
  // Ability identity must already have been supplied by model-grounded labels.
  // Deterministic code may validate and carry printed numeric saves, but must not
  // infer semantics from English STR/DEX/... abbreviations in source text.
  return rows
    .filter((row) => row.printedSave !== null)
    .map((row) => ({
      ability: row.ability,
      bonus: row.printedSave as number,
      provenance: row.provenance,
      source: row.source,
    }));
}

export function resolveAbilities(candidates: AbilityScoreFact[], issues: ParseIssue[]): StructuredHeader["abilities"] {
  const abilities = Object.fromEntries(ABILITY_KEYS.map((ability) => [ability, null])) as StructuredHeader["abilities"];

  for (const ability of ABILITY_KEYS) {
    const current = candidates.filter((candidate) => candidate.ability === ability);
    const scores = new Set(current.map((candidate) => candidate.score));

    if (scores.size > 1) {
      issues.push(
        issue(
          "conflicting_header_ability",
          "warning",
          "Conflicting grounded ability scores were found; no value was selected automatically.",
          { ability, values: [...scores], evidence: current.map((candidate) => candidate.source.evidence) },
        ),
      );
      continue;
    }

    if (current.length === 0) continue;

    const modelCandidate = current.find((candidate) => candidate.provenance === "model_evidence");
    const selected = modelCandidate ?? current[0];
    const printedSave = current.find((candidate) => candidate.printedSave !== null)?.printedSave ?? null;

    abilities[ability] = { ...selected, printedSave };
  }

  return abilities;
}

/*
 * Однакові grounded факти безпечно дедуплікуються. Різні значення для тієї самої
 * характеристики чи ряткидка блокують автоматичний вибір, а не запускають евристику.
 */
export function resolveSavingThrows(candidates: SavingThrowFact[], issues: ParseIssue[]): SavingThrowFact[] {
  const resolved: SavingThrowFact[] = [];

  for (const ability of ABILITY_KEYS) {
    const current = candidates.filter((candidate) => candidate.ability === ability);
    const bonuses = new Set(current.map((candidate) => candidate.bonus));

    if (bonuses.size > 1) {
      issues.push(
        issue(
          "conflicting_header_save",
          "warning",
          "Conflicting grounded saving-throw bonuses were found; no value was selected automatically.",
          { ability, values: [...bonuses], evidence: current.map((candidate) => candidate.source.evidence) },
        ),
      );
      continue;
    }

    if (current.length === 0) continue;
    resolved.push(current.find((candidate) => candidate.provenance === "model_evidence") ?? current[0]);
  }

  return resolved;
}
