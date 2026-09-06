import {
  ABILITY_KEYS,
  type AbilityKey,
  type AbilityScoreFact,
  type CompiledAnnotation,
  type HeaderFactProvenance,
  type HeaderFactSource,
  type LosslessStatblockDocument,
  type ParseIssue,
  type SavingThrowFact,
} from "./domain.js";
import type { ModelAbilityLabel } from "./modelSchema.js";

export type AbilityTableResolution = {
  abilities: AbilityScoreFact[];
  savingThrows: SavingThrowFact[];
  region: { start: number; end: number } | null;
  issues: ParseIssue[];
};

export type AbilityTableRegionProbe = {
  region: { start: number; end: number } | null;
  evidenceAtomCount: number;
  /** Structured facts proven from the exact source region, independent of ownership. */
  resolution: AbilityTableResolution | null;
  issues: ParseIssue[];
};

type SourceAbilityWindow = { start: number; end: number };

function temporaryAbilityRegionDocument(
  document: LosslessStatblockDocument,
  region: SourceAbilityWindow,
): LosslessStatblockDocument | null {
  const contentUnits = document.sourceMap.units.filter(
    (unit) => unit.kind === "content" && unit.start >= region.start && unit.end <= region.end,
  );
  if (contentUnits.length === 0) return null;
  const first = contentUnits[0]!;
  const last = contentUnits[contentUnits.length - 1]!;
  if (first.start !== region.start || last.end !== region.end) return null;

  const annotation: CompiledAnnotation = {
    id: "ability-source-probe",
    candidateIndex: -1,
    provenance: "deterministic_ability_table",
    role: "header_field",
    field: "ability_scores",
    section: null,
    source: {
      startUnitId: first.id,
      endUnitId: last.id,
      start: region.start,
      end: region.end,
    },
    text: document.rawSource.slice(region.start, region.end),
  };

  return { ...document, annotations: [annotation] };
}

function resolutionEvidenceAtomCount(resolution: AbilityTableResolution): number {
  return (
    resolution.abilities.length +
    resolution.abilities.filter((ability) => ability.printedModifier !== null).length +
    resolution.savingThrows.length
  );
}

function remapResolutionSources(
  document: LosslessStatblockDocument,
  resolution: AbilityTableResolution,
): AbilityTableResolution {
  const remapSource = (source: HeaderFactSource): HeaderFactSource => {
    const owner = document.annotations.find(
      (annotation) => annotation.source.start <= source.start && annotation.source.end >= source.end,
    );
    return { ...source, annotationId: owner?.id ?? source.annotationId };
  };
  return {
    ...resolution,
    abilities: resolution.abilities.map((ability) => ({ ...ability, source: remapSource(ability.source) })),
    savingThrows: resolution.savingThrows.map((save) => ({ ...save, source: remapSource(save.source) })),
    issues: [...resolution.issues],
  };
}

/**
 * Validate one model-grounded ability region without assigning it header
 * ownership. The model supplies only the semantic region; the ordinary
 * constraint solver must still prove six abilities and every accepted number.
 */
export function resolveVerifiedAbilityRegionFromSource(
  document: LosslessStatblockDocument,
  region: { start: number; end: number },
  modelHints: readonly ModelAbilityLabel[],
  proficiencyBonus: number | null,
  allowRightEdgeExtension = true,
  preferSmallestCompleteExtension = false,
): AbilityTableResolution | null {
  if (!(0 <= region.start && region.start < region.end && region.end <= document.rawSource.length)) return null;

  /*
   * The verifier supplies semantic evidence, not authoritative numeric
   * boundaries. Dense candidate lattices can stop an `ab` claim before the
   * final modifier/save cell. We therefore treat its left edge as the grounded
   * semantic anchor and let the same constraint solver used for Rak Tulkhesh
   * test progressively wider right edges.
   *
   * A valid six-score solution is not necessarily the richest valid solution:
   * the next source cell can still be the printed CHA save. Among all proven
   * local windows prefer the one containing the most independent mechanical
   * evidence (scores + printed modifiers + printed saves), then the shortest
   * equally-rich window. This mirrors the source-only recovery policy.
   *
   * We deliberately never move the left edge. A bad semantic start could
   * otherwise swallow unrelated metadata. Widening is bounded by the next
   * source-proven section heading and by a compact local window.
   */
  const tryRegion = (candidate: SourceAbilityWindow): AbilityTableResolution | null => {
    const temporary = temporaryAbilityRegionDocument(document, candidate);
    if (temporary === null) return null;
    const resolution = resolveAbilityTableFromHeader(temporary, modelHints, proficiencyBonus);
    if (resolution.region === null || resolution.abilities.length !== ABILITY_KEYS.length) return null;

    if (preferSmallestCompleteExtension) {
      const prefix = resolution.abilities.slice(0, -1);
      const last = resolution.abilities.at(-1)!;
      if (prefix.every((ability) => ability.printedModifier !== null) && last.printedModifier === null) return null;
      if (prefix.every((ability) => ability.printedSave !== null) && last.printedSave === null) return null;
    }

    return remapResolutionSources(document, resolution);
  };

  if (!allowRightEdgeExtension) {
    return tryRegion({ start: region.start, end: region.end });
  }

  // Ownership-first callers use the smallest complete extension: this repairs
  // weak-model off-by-one truncation (for example a final CHA label without its
  // value) without continuing into the following standalone metadata row. Legacy
  // callers may still prefer the richest proven table so printed save columns
  // that are genuinely part of the same table are retained.

  const nextSectionHeading = document.annotations
    .filter((annotation) => annotation.role === "section_heading" && annotation.source.start > region.start)
    .reduce((minimum, annotation) => Math.min(minimum, annotation.source.start), document.rawSource.length);
  const LOCAL_EXTENSION_LIMIT = 1024;
  const ceiling = Math.min(nextSectionHeading, region.start + LOCAL_EXTENSION_LIMIT, document.rawSource.length);
  const extensionEnds = document.sourceMap.units
    .filter((unit) => unit.kind === "content" && unit.end > region.end && unit.end <= ceiling)
    .map((unit) => unit.end);
  const candidateEnds = [...new Set([region.end, ...extensionEnds])].sort((left, right) => left - right);

  const proven: AbilityTableResolution[] = [];
  for (const end of candidateEnds) {
    const resolved = tryRegion({ start: region.start, end });
    if (resolved === null) continue;
    if (preferSmallestCompleteExtension) return resolved;
    proven.push(resolved);
  }
  if (proven.length === 0) return null;

  const maximumEvidence = Math.max(...proven.map(resolutionEvidenceAtomCount));
  const richest = proven.filter((candidate) => resolutionEvidenceAtomCount(candidate) === maximumEvidence);
  richest.sort((left, right) => {
    const leftLength = (left.region?.end ?? region.end) - (left.region?.start ?? region.start);
    const rightLength = (right.region?.end ?? region.end) - (right.region?.start ?? region.start);
    return leftLength - rightLength;
  });
  return richest[0]!;
}

/**
 * Source-only recovery probe for canonical six-ability regions that semantic
 * ownership may have fragmented or left partly unclassified. Source scanning
 * proposes only ordered STR→DEX→CON→INT→WIS→CHA windows at content-unit
 * boundaries. Every window is then proved (or rejected) by the ordinary
 * layout-independent constraint resolver.
 *
 * When several nested windows solve the same table, prefer the one containing
 * the greatest amount of independently grounded printed mechanical evidence
 * (scores + printed modifiers + printed saves), then the shortest equally-rich
 * window. This lets a final save cell survive model fragmentation without
 * making line/column shape itself semantic.
 */
export function probeConstraintProvenAbilityRegionFromHeaderSource(
  _document: LosslessStatblockDocument,
): AbilityTableRegionProbe {
  // Deliberately no source-only semantic discovery. Without model-grounded
  // printed-label -> canonical-ability mappings, the parser must not interpret
  // STR/DEX/... (or any other language-specific labels) as ability identities.
  return { region: null, evidenceAtomCount: 0, resolution: null, issues: [] };
}

/**
 * Recover an exact six-ability source region from six model-supplied printed
 * label mappings. The model owns only label semantics (for example Сил -> str);
 * deterministic code owns occurrence grounding, source order, numeric proof and
 * the exact recovered range. No printed-language vocabulary is consulted.
 */
export function probeModelGuidedAbilityRegionFromSource(
  document: LosslessStatblockDocument,
  modelHints: readonly ModelAbilityLabel[],
  proficiencyBonus: number | null,
): AbilityTableRegionProbe {
  const issues: ParseIssue[] = [];
  if (modelHints.length !== ABILITY_KEYS.length || document.rawSource.length === 0) {
    return { region: null, evidenceAtomCount: 0, resolution: null, issues };
  }

  const synthetic: CompiledAnnotation = {
    id: "model-guided-ability-source",
    candidateIndex: -1,
    provenance: "deterministic_ability_table",
    role: "header_field",
    field: "ability_scores",
    section: null,
    source: {
      startUnitId: document.sourceMap.units[0]?.id ?? "unit-0",
      endUnitId: document.sourceMap.units.at(-1)?.id ?? "unit-0",
      start: 0,
      end: document.rawSource.length,
    },
    text: document.rawSource,
  };

  const labels = validateModelLabels(modelLabels([synthetic], modelHints, issues));
  if (labels === null || labels.length !== ABILITY_KEYS.length) {
    return { region: null, evidenceAtomCount: 0, resolution: null, issues };
  }

  const semanticSeed = { start: labels[0]!.start, end: labels.at(-1)!.end };
  let resolution = resolveVerifiedAbilityRegionFromSource(
    document,
    semanticSeed,
    modelHints,
    proficiencyBonus,
    true,
    true,
  );

  // A physically collapsed source has no useful line end for the ordinary
  // smallest-extension repair. In that case probe exact content-unit ends in
  // ascending order and accept the first region that the normal table solver
  // can fully prove.
  if (resolution === null && !/[\r\n]/u.test(document.rawSource)) {
    const ceiling = Math.min(document.rawSource.length, semanticSeed.start + 1024);
    const candidateEnds = document.sourceMap.units
      .filter((unit) => unit.kind === "content" && unit.end > semanticSeed.end && unit.end <= ceiling)
      .map((unit) => unit.end);
    for (const end of candidateEnds) {
      resolution = resolveVerifiedAbilityRegionFromSource(
        document,
        { start: semanticSeed.start, end },
        modelHints,
        proficiencyBonus,
        false,
        false,
      );
      if (resolution !== null) break;
    }
  }

  if (resolution === null || resolution.region === null || resolution.abilities.length !== ABILITY_KEYS.length) {
    return { region: null, evidenceAtomCount: 0, resolution: null, issues };
  }

  const evidenceAtomCount = resolutionEvidenceAtomCount(resolution);
  issues.push(
    parseIssue(
      "model_guided_ability_region_proven",
      "info",
      "Six model-grounded printed ability labels were used only to establish semantic identity; deterministic constraints proved the exact six-ability source region.",
      { start: resolution.region.start, end: resolution.region.end, evidenceAtomCount },
    ),
  );
  return { region: resolution.region, evidenceAtomCount, resolution, issues };
}

type GroundedLabel = {
  ability: AbilityKey;
  text: string;
  start: number;
  end: number;
  provenance: "canonical" | "model";
};

type NumberAtom = {
  value: number;
  start: number;
  end: number;
  annotation: CompiledAnnotation;
  text: string;
};

type ResolvedCell = {
  label: GroundedLabel;
  score: NumberAtom;
  modifier: number;
  printedModifier: NumberAtom | null;
  printedSave: NumberAtom | null;
};

const ELIGIBLE_FIELDS = new Set(["ability_scores", "ability_modifiers", "other_header"]);
const UNSIGNED_INTEGER = /(?<![\d+\-−‒–—﹣－＋])(\d{1,3})(?!\d)/gu;
const SIGNED_INTEGER = /([+\-−‒–—﹣－＋]\d{1,3})/gu;

function parseIssue(
  code: string,
  severity: ParseIssue["severity"],
  message: string,
  details: Record<string, unknown>,
): ParseIssue {
  return { code, severity, message, candidateIndex: null, details };
}

function modifierFor(score: number): number {
  return Math.floor((score - 10) / 2);
}

function signedValue(text: string): number {
  return Number(text.replace(/[−‒–—﹣－]/gu, "-").replace(/＋/gu, "+"));
}

function eligibleHeaderAnnotations(document: LosslessStatblockDocument): CompiledAnnotation[] {
  const firstBodyStart = document.annotations
    .filter((annotation) => annotation.role !== "header_field" && annotation.role !== "header_content")
    .reduce((minimum, annotation) => Math.min(minimum, annotation.source.start), document.rawSource.length);

  return document.annotations
    .filter(
      (annotation) =>
        annotation.role === "header_field" &&
        annotation.field !== null &&
        ELIGIBLE_FIELDS.has(annotation.field) &&
        annotation.source.start < firstBodyStart,
    )
    .sort((left, right) => left.source.start - right.source.start || left.source.end - right.source.end);
}

function annotationContaining(
  annotations: readonly CompiledAnnotation[],
  start: number,
  end: number,
): CompiledAnnotation | null {
  return annotations.find((annotation) => annotation.source.start <= start && annotation.source.end >= end) ?? null;
}

function modelLabels(
  annotations: readonly CompiledAnnotation[],
  hints: readonly ModelAbilityLabel[],
  issues: ParseIssue[],
): GroundedLabel[] {
  const hintByAbility = new Map(hints.map((hint) => [hint.ability, hint] as const));
  if (ABILITY_KEYS.some((ability) => !hintByAbility.has(ability))) return [];

  const occurrencesByAbility = new Map<AbilityKey, GroundedLabel[]>();

  for (const ability of ABILITY_KEYS) {
    const hint = hintByAbility.get(ability)!;
    const occurrences: GroundedLabel[] = [];

    for (const annotation of annotations) {
      let from = 0;
      while (from <= annotation.text.length - hint.labelQuote.length) {
        const index = annotation.text.indexOf(hint.labelQuote, from);
        if (index < 0) break;
        occurrences.push({
          ability,
          text: hint.labelQuote,
          start: annotation.source.start + index,
          end: annotation.source.start + index + hint.labelQuote.length,
          provenance: "model",
        });
        from = index + Math.max(1, hint.labelQuote.length);
      }
    }

    occurrences.sort((left, right) => left.start - right.start || left.end - right.end);
    occurrencesByAbility.set(ability, occurrences);
  }

  /*
   * Localized ability abbreviations can legitimately repeat later in the header
   * (most commonly inside a printed saving-throw row). Global quote uniqueness
   * therefore rejects good model hints. Ground the SIX labels as one ordered
   * source pattern instead: STR→DEX→CON→INT→WIS→CHA identities are semantic
   * evidence from the model, while source order is deterministic evidence.
   *
   * We still abstain if there is no unique tight monotonic chain. This avoids
   * selecting an arbitrary occurrence merely because it appears first.
   */
  type Chain = GroundedLabel[];
  const chains: Chain[] = [];
  const MAX_CHAINS = 256;

  function visit(index: number, previousEnd: number, chain: Chain): void {
    if (chains.length >= MAX_CHAINS) return;
    if (index >= ABILITY_KEYS.length) {
      chains.push([...chain]);
      return;
    }

    const ability = ABILITY_KEYS[index]!;
    for (const occurrence of occurrencesByAbility.get(ability) ?? []) {
      if (occurrence.start < previousEnd) continue;
      chain.push(occurrence);
      visit(index + 1, occurrence.end, chain);
      chain.pop();
      if (chains.length >= MAX_CHAINS) return;
    }
  }

  visit(0, -1, []);

  if (chains.length === 0 || chains.length >= MAX_CHAINS) {
    for (const ability of ABILITY_KEYS) {
      const hint = hintByAbility.get(ability)!;
      const count = occurrencesByAbility.get(ability)?.length ?? 0;
      if (count !== 1) {
        issues.push(
          parseIssue(
            "ungrounded_ability_label_hint",
            "warning",
            "A model ability-label hint could not be grounded as part of one unique ordered six-label ability region.",
            { ability, labelQuote: hint.labelQuote, occurrenceCount: count },
          ),
        );
      }
    }
    return [];
  }

  const span = (chain: Chain): number => chain[chain.length - 1]!.end - chain[0]!.start;
  const minimumSpan = Math.min(...chains.map(span));
  const tightest = chains.filter((chain) => span(chain) === minimumSpan);

  if (tightest.length !== 1) {
    issues.push(
      parseIssue(
        "ambiguous_ability_label_sequence",
        "warning",
        "More than one equally tight ordered six-label sequence matched the localized ability hints, so recovery was abandoned.",
        { chainCount: tightest.length, minimumSpan },
      ),
    );
    return [];
  }

  return tightest[0]!;
}

function validateModelLabels(model: GroundedLabel[]): GroundedLabel[] | null {
  const byAbility = new Map<AbilityKey, GroundedLabel[]>();
  for (const label of model) byAbility.set(label.ability, [...(byAbility.get(label.ability) ?? []), label]);

  if (ABILITY_KEYS.some((ability) => (byAbility.get(ability)?.length ?? 0) !== 1)) return null;

  const selected = ABILITY_KEYS.map((ability) => byAbility.get(ability)![0]);
  const positions = new Set(selected.map((label) => `${label.start}:${label.end}`));
  if (positions.size !== ABILITY_KEYS.length) return null;

  return selected.sort((left, right) => left.start - right.start);
}

function clusterEnd(
  document: LosslessStatblockDocument,
  annotations: readonly CompiledAnnotation[],
  labels: readonly GroundedLabel[],
): number {
  const lastLabel = labels[labels.length - 1];
  const firstBodyStart = document.annotations
    .filter(
      (annotation) =>
        annotation.role !== "header_field" &&
        annotation.role !== "header_content" &&
        annotation.source.start > lastLabel.start,
    )
    .reduce((minimum, annotation) => Math.min(minimum, annotation.source.start), document.rawSource.length);

  const nextSpecificHeader = document.annotations
    .filter(
      (annotation) =>
        annotation.role === "header_field" &&
        annotation.source.start > lastLabel.start &&
        (annotation.field === null || !ELIGIBLE_FIELDS.has(annotation.field)),
    )
    .reduce((minimum, annotation) => Math.min(minimum, annotation.source.start), firstBodyStart);

  const lastEligibleEnd = annotations
    .filter((annotation) => annotation.source.end > lastLabel.end && annotation.source.start < nextSpecificHeader)
    .reduce((maximum, annotation) => Math.max(maximum, annotation.source.end), lastLabel.end);

  return Math.min(nextSpecificHeader, Math.max(lastLabel.end, lastEligibleEnd));
}

function clusterStart(
  _document: LosslessStatblockDocument,
  annotations: readonly CompiledAnnotation[],
  labels: readonly GroundedLabel[],
): number {
  const firstLabel = labels[0];
  // Recovery may only claim source that is already owned by the annotation
  // containing the first grounded ability label. `other_header` is deliberately
  // eligible evidence for localized ability tables, but that must never let the
  // resolver walk backward through unrelated unresolved metadata such as AC, HP
  // or Speed and then delete it during deterministic region promotion.
  //
  // When a whole ability table is one annotation (including leading Mod/Save
  // column labels), this still preserves the complete annotation. When localized
  // abilities are one physical row per annotation, the region begins exactly at
  // the first ability row.
  const owner = annotationContaining(annotations, firstLabel.start, firstLabel.end);
  return owner?.source.start ?? firstLabel.start;
}

function unsignedAtoms(
  document: LosslessStatblockDocument,
  annotations: readonly CompiledAnnotation[],
  start: number,
  end: number,
): NumberAtom[] {
  const text = document.rawSource.slice(start, end);
  const atoms: NumberAtom[] = [];

  for (const match of text.matchAll(UNSIGNED_INTEGER)) {
    const absoluteStart = start + match.index;
    const absoluteEnd = absoluteStart + match[0].length;
    const annotation = annotationContaining(annotations, absoluteStart, absoluteEnd);
    if (annotation === null) continue;
    const value = Number(match[1]);
    if (!Number.isInteger(value) || value < 0 || value > 99) continue;
    atoms.push({ value, start: absoluteStart, end: absoluteEnd, annotation, text: match[0] });
  }

  return atoms;
}

function signedAtoms(
  document: LosslessStatblockDocument,
  annotations: readonly CompiledAnnotation[],
  start: number,
  end: number,
): NumberAtom[] {
  const text = document.rawSource.slice(start, end);
  const atoms: NumberAtom[] = [];

  for (const match of text.matchAll(SIGNED_INTEGER)) {
    const absoluteStart = start + match.index;
    const absoluteEnd = absoluteStart + match[0].length;
    const annotation = annotationContaining(annotations, absoluteStart, absoluteEnd);
    if (annotation === null) continue;
    atoms.push({ value: signedValue(match[1]), start: absoluteStart, end: absoluteEnd, annotation, text: match[0] });
  }

  return atoms;
}

function classifySignedFacts(
  score: NumberAtom,
  signed: NumberAtom[],
  proficiencyBonus: number | null,
): { modifier: NumberAtom | null; save: NumberAtom | null } | null {
  const modifier = modifierFor(score.value);
  const matching = signed.filter((atom) => atom.value === modifier);

  if (signed.length === 0) return { modifier: null, save: null };

  if (signed.length === 1) {
    if (matching.length === 1) return { modifier: signed[0], save: null };
    if (proficiencyBonus !== null && signed[0].value === modifier + proficiencyBonus)
      return { modifier: null, save: signed[0] };
    return null;
  }

  if (signed.length === 2 && matching.length >= 1) {
    if (matching.length === 2) return { modifier: matching[0], save: matching[1] };
    const modAtom = matching[0];
    return { modifier: modAtom, save: signed.find((atom) => atom !== modAtom) ?? null };
  }

  // With more columns, accept only when PB makes exactly one non-modifier atom
  // a provable saving throw. Otherwise the extra numeric columns are ambiguous.
  if (matching.length >= 1 && proficiencyBonus !== null) {
    const saveCandidates = signed.filter((atom) => atom.value === modifier + proficiencyBonus && atom !== matching[0]);
    if (saveCandidates.length === 1) return { modifier: matching[0], save: saveCandidates[0] };
  }

  return null;
}

function solveInterleaved(
  document: LosslessStatblockDocument,
  annotations: readonly CompiledAnnotation[],
  labels: readonly GroundedLabel[],
  end: number,
  proficiencyBonus: number | null,
): ResolvedCell[] | null {
  const cells: ResolvedCell[] = [];

  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    const regionEnd = labels[index + 1]?.start ?? end;
    const scores = unsignedAtoms(document, annotations, label.end, regionEnd);
    if (scores.length !== 1) return null;

    const score = scores[0];
    const facts = classifySignedFacts(
      score,
      signedAtoms(document, annotations, score.end, regionEnd),
      proficiencyBonus,
    );
    if (facts === null) return null;
    if (facts.modifier !== null && facts.modifier.value !== modifierFor(score.value)) return null;

    cells.push({
      label,
      score,
      modifier: modifierFor(score.value),
      printedModifier: facts.modifier,
      printedSave: facts.save,
    });
  }

  return cells;
}

function solveMatrix(
  document: LosslessStatblockDocument,
  annotations: readonly CompiledAnnotation[],
  labels: readonly GroundedLabel[],
  end: number,
  proficiencyBonus: number | null,
): ResolvedCell[] | null {
  const firstFiveHaveScores = labels
    .slice(0, -1)
    .some((label, index) => unsignedAtoms(document, annotations, label.end, labels[index + 1].start).length > 0);
  if (firstFiveHaveScores) return null;

  const scores = unsignedAtoms(document, annotations, labels[labels.length - 1].end, end);
  if (scores.length !== ABILITY_KEYS.length) return null;

  const cells: ResolvedCell[] = [];
  let intervalMode = true;

  for (let index = 0; index < scores.length; index += 1) {
    const intervalEnd = scores[index + 1]?.start ?? end;
    const facts = classifySignedFacts(
      scores[index],
      signedAtoms(document, annotations, scores[index].end, intervalEnd),
      proficiencyBonus,
    );
    if (facts === null || (facts.modifier !== null && facts.modifier.value !== modifierFor(scores[index].value))) {
      intervalMode = false;
      break;
    }
    cells.push({
      label: labels[index],
      score: scores[index],
      modifier: modifierFor(scores[index].value),
      printedModifier: facts.modifier,
      printedSave: facts.save,
    });
  }

  if (intervalMode && cells.some((cell) => cell.printedModifier !== null || cell.printedSave !== null)) return cells;

  // Row-major fallback: six scores first, then one six-value modifier row and
  // optionally one six-value save row. This is still solved by constraints, not
  // by line breaks or column names.
  const trailing = signedAtoms(document, annotations, scores[scores.length - 1].end, end);
  if (trailing.length !== 6 && trailing.length !== 12) return intervalMode ? cells : null;

  const modifierRow = trailing.slice(0, 6);
  if (!modifierRow.every((atom, index) => atom.value === modifierFor(scores[index].value))) return null;
  const saveRow = trailing.length === 12 ? trailing.slice(6) : [];

  return labels.map((label, index) => ({
    label,
    score: scores[index],
    modifier: modifierFor(scores[index].value),
    printedModifier: modifierRow[index],
    printedSave: saveRow[index] ?? null,
  }));
}

function sourceForAtom(atom: NumberAtom): HeaderFactSource {
  return {
    annotationId: atom.annotation.id,
    start: atom.start,
    end: atom.end,
    evidence: atom.text,
  };
}

function cellsEqual(left: readonly ResolvedCell[], right: readonly ResolvedCell[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (cell, index) =>
        cell.label.ability === right[index].label.ability &&
        cell.score.value === right[index].score.value &&
        cell.printedModifier?.value === right[index].printedModifier?.value &&
        cell.printedSave?.value === right[index].printedSave?.value,
    )
  );
}

export function resolveAbilityTableFromHeader(
  document: LosslessStatblockDocument,
  modelHints: readonly ModelAbilityLabel[],
  proficiencyBonus: number | null,
): AbilityTableResolution {
  const issues: ParseIssue[] = [];
  const annotations = eligibleHeaderAnnotations(document);
  if (annotations.length === 0) return { abilities: [], savingThrows: [], region: null, issues };

  const groundedModelLabels = modelLabels(annotations, modelHints, issues);
  const labels = validateModelLabels(groundedModelLabels);
  if (labels === null || labels.length !== ABILITY_KEYS.length) {
    if (modelHints.length > 0) {
      issues.push(
        parseIssue(
          "incomplete_ability_label_set",
          "warning",
          "Ability-table recovery requires one uniquely grounded label for each of the six canonical abilities; the available evidence was incomplete or ambiguous.",
          { groundedLabelCount: labels?.length ?? 0 },
        ),
      );
    }
    return { abilities: [], savingThrows: [], region: null, issues };
  }

  const start = clusterStart(document, annotations, labels);
  const maximumEnd = clusterEnd(document, annotations, labels);

  // Search outward from the final label and accept the smallest source region
  // that admits exactly one six-ability solution. This prevents unrelated later
  // header prose (especially localized Saving Throws/Skills rows that remain
  // `other_header`) from poisoning an otherwise self-contained ability table.
  const endCandidates = [
    ...new Set(
      annotations
        .filter(
          (annotation) => annotation.source.end > labels[labels.length - 1]!.end && annotation.source.end <= maximumEnd,
        )
        .map((annotation) => annotation.source.end)
        .concat(maximumEnd),
    ),
  ].sort((left, right) => left - right);

  let cells: ResolvedCell[] | null = null;
  let end: number | null = null;
  let ambiguousSolutionCount = 0;

  for (const candidateEnd of endCandidates) {
    const solutions = [
      solveInterleaved(document, annotations, labels, candidateEnd, proficiencyBonus),
      solveMatrix(document, annotations, labels, candidateEnd, proficiencyBonus),
    ].filter((solution): solution is ResolvedCell[] => solution !== null);

    const unique = solutions.filter(
      (solution, index) => solutions.findIndex((candidate) => cellsEqual(candidate, solution)) === index,
    );
    if (unique.length === 1) {
      cells = unique[0]!;
      end = candidateEnd;
      break;
    }
    ambiguousSolutionCount = Math.max(ambiguousSolutionCount, unique.length);
  }

  if (cells === null || end === null) {
    if (ambiguousSolutionCount > 1) {
      issues.push(
        parseIssue(
          "ambiguous_ability_table_constraints",
          "warning",
          "More than one distinct label/value assignment satisfies the local ability-table constraints, so no structured abilities were selected.",
          { solutionCount: ambiguousSolutionCount },
        ),
      );
    } else {
      issues.push(
        parseIssue(
          "unresolved_ability_table_constraints",
          "warning",
          "Six grounded ability labels were found, but the surrounding numeric facts did not admit a safe ability-table solution.",
          { labels: labels.map((label) => label.text) },
        ),
      );
    }
    return { abilities: [], savingThrows: [], region: null, issues };
  }
  const abilities: AbilityScoreFact[] = cells.map((cell) => {
    const provenance: HeaderFactProvenance = "model_evidence";
    return {
      ability: cell.label.ability,
      score: cell.score.value,
      modifier: cell.modifier,
      printedModifier: cell.printedModifier?.value ?? null,
      printedSave: cell.printedSave?.value ?? null,
      provenance,
      source: sourceForAtom(cell.score),
    };
  });

  const savingThrows: SavingThrowFact[] = cells.flatMap((cell) =>
    cell.printedSave === null
      ? []
      : [
          {
            ability: cell.label.ability,
            bonus: cell.printedSave.value,
            provenance: "model_evidence" as const,
            source: sourceForAtom(cell.printedSave),
          },
        ],
  );

  issues.push(
    parseIssue(
      "ability_table_constraint_recovered",
      "info",
      "A six-ability table was reconstructed from grounded labels and numeric consistency without relying on line or column layout.",
      { recoveredAbilities: abilities.map((ability) => ability.ability), recoveredSaveCount: savingThrows.length },
    ),
  );
  return { abilities, savingThrows, region: { start, end }, issues };
}
