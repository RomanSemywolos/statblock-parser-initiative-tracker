import {
  ABILITY_KEYS,
  type CompiledAnnotation,
  type HeaderFactSource,
  type LosslessStatblockDocument,
  type ParseIssue,
} from "./domain.js";

import type { ParsedModelHeaderFacts } from "./modelSchema.js";
import {
  probeConstraintProvenAbilityRegionFromHeaderSource,
  probeModelGuidedAbilityRegionFromSource,
  resolveAbilityTableFromHeader,
  resolveVerifiedAbilityRegionFromSource,
} from "./abilityTableResolver.js";
import { rebuildDocumentFromAnnotations } from "./annotationCompiler.js";

import { headerAnnotations, issue } from "./headerFactPrimitives.js";

export { abilityModifier, proficiencyBonusForChallenge } from "./headerFactPrimitives.js";

import {
  deterministicAbilityRows,
  deterministicSavingThrows,
  deterministicStandaloneSavingThrows,
  groundModelSavingThrows,
  modelGuidedAdjacentSavingThrows,
  resolveAbilities,
  resolveSavingThrows,
  sharedPhysicalSavingThrowRowEvidence,
  verifiedEssentialStandaloneSavingThrows,
} from "./headerAbilityFacts.js";

import {
  challengeFactFromEvidence,
  challengeFactFromHeader,
  compactEvidence,
  essentialRegion,
  fallbackInitiativeFact,
  fallbackIntegerFact,
  fallbackTextFact,
  structuredProficiencyBonus,
  trimmedEssentialEvidence,
  verifiedInitiativeFact,
  verifiedIntegerFact,
  verifiedTextFact,
} from "./headerScalarFacts.js";

function promoteRecoveredAbilityRegion(
  document: LosslessStatblockDocument,
  region: { start: number; end: number } | null,
  issues: ParseIssue[],
): LosslessStatblockDocument {
  if (region === null) return document;
  const { start, end } = region;
  if (!(start < end)) return document;

  const overlapping = document.annotations.filter(
    (annotation) => annotation.source.start < end && start < annotation.source.end,
  );
  if (overlapping.some((annotation) => annotation.role !== "header_field" && annotation.role !== "header_content")) {
    issues.push(
      issue(
        "ability_table_region_conflicts_with_body",
        "warning",
        "A proven ability-table solution overlapped non-header structure, so it was not promoted into source ownership.",
        { start, end },
      ),
    );
    return document;
  }

  const contentUnits = document.sourceMap.units.filter(
    (unit) => unit.kind === "content" && unit.start >= start && unit.end <= end,
  );
  if (contentUnits.length === 0) return document;
  const startUnit = contentUnits[0];
  const endUnit = contentUnits[contentUnits.length - 1];
  const exactStart = startUnit.start;
  const exactEnd = endUnit.end;

  const retained = document.annotations.filter(
    (annotation) => !(annotation.source.start < exactEnd && exactStart < annotation.source.end),
  );
  const candidateIndex =
    overlapping.length > 0 ? Math.min(...overlapping.map((annotation) => annotation.candidateIndex)) : -1;
  const promoted: CompiledAnnotation = {
    id: "annotation-promoted-ability-table",
    candidateIndex,
    provenance: "deterministic_ability_table",
    role: "header_field",
    field: "ability_scores",
    section: null,
    source: {
      startUnitId: startUnit.id,
      endUnitId: endUnit.id,
      start: exactStart,
      end: exactEnd,
    },
    text: document.rawSource.slice(exactStart, exactEnd),
  };

  const rebuilt = rebuildDocumentFromAnnotations(
    document,
    [...retained, promoted],
    [
      issue(
        "ability_table_region_promoted",
        "info",
        "A constraint-proven ability table replaced fragmented generic header ownership with one deterministic ability_scores block.",
        { start: exactStart, end: exactEnd, replacedAnnotationCount: overlapping.length },
      ),
    ],
  );

  return {
    ...rebuilt,
    model: {
      ...rebuilt.model,
      acceptedAnnotationCount: rebuilt.annotations.length,
      acceptedModelAnnotationCount: rebuilt.annotations.filter(
        (annotation) =>
          annotation.provenance !== "deterministic_ability_table" &&
          annotation.provenance !== "deterministic_section_heading" &&
          annotation.provenance !== "deterministic_region_gap",
      ).length,
      deterministicAnnotationCount: rebuilt.annotations.filter(
        (annotation) =>
          annotation.provenance === "deterministic_ability_table" ||
          annotation.provenance === "deterministic_section_heading" ||
          annotation.provenance === "deterministic_region_gap",
      ).length,
    },
  };
}

export type EnrichStructuredHeaderOptions = {
  /**
   * Validate only verifier-grounded fixed-header evidence. This mode is used by
   * the ownership-first multiline pipeline. Ability evidence may repair only a
   * truncated right edge to the smallest constraint-proven complete six-ability
   * region; it may not scan arbitrary BODY source for a richer table.
   */
  essentialOnly?: boolean;
};

export function enrichStructuredHeader(
  document: LosslessStatblockDocument,
  modelFacts: ParsedModelHeaderFacts,
  options: EnrichStructuredHeaderOptions = {},
): LosslessStatblockDocument {
  const initialIssues = [
    ...document.issues,
    ...modelFacts.issues.map((current) => issue(current.code, "warning", current.message, current.details)),
  ];

  // First pass proves only whether a whole ability-table source region exists.
  // Facts are recalculated after promotion so annotation IDs and provenance refer
  // to the final document rather than stale pre-promotion ownership.
  const probeIssues = [...initialIssues];
  const probeProficiency = structuredProficiencyBonus(document, probeIssues, modelFacts.essentialRegions ?? []);
  const probe = resolveAbilityTableFromHeader(document, modelFacts.abilityLabels, probeProficiency?.value ?? null);
  const verifiedProbeTables = (modelFacts.essentialRegions ?? [])
    .filter((region) => region.kind === "ability_scores")
    .flatMap((region) => {
      const resolved = resolveVerifiedAbilityRegionFromSource(
        document,
        region,
        modelFacts.abilityLabels,
        probeProficiency?.value ?? null,
        true,
        options.essentialOnly === true,
      );
      return resolved === null ? [] : [resolved];
    });
  const verifiedProbe = verifiedProbeTables[0] ?? null;
  const modelGuidedProbe = probeModelGuidedAbilityRegionFromSource(
    document,
    modelFacts.abilityLabels,
    probeProficiency?.value ?? null,
  );
  const sourceProbe =
    options.essentialOnly === true
      ? { region: null, resolution: null, evidenceAtomCount: 0, issues: [] as ParseIssue[] }
      : probeConstraintProvenAbilityRegionFromHeaderSource(document);
  const probeEvidenceAtomCount =
    probe.abilities.length +
    probe.abilities.filter((ability) => ability.printedModifier !== null).length +
    probe.savingThrows.length;
  const probeHasCompleteAbilities = probe.region !== null && probe.abilities.length === ABILITY_KEYS.length;
  const sourceAddsEvidence = sourceProbe.region !== null && sourceProbe.evidenceAtomCount > probeEvidenceAtomCount;
  if (options.essentialOnly !== true && (!probeHasCompleteAbilities || sourceAddsEvidence))
    initialIssues.push(...sourceProbe.issues);
  if (verifiedProbe === null && modelGuidedProbe.region !== null) initialIssues.push(...modelGuidedProbe.issues);
  const provenRegion =
    options.essentialOnly === true
      ? (verifiedProbe?.region ?? modelGuidedProbe.region ?? null)
      : sourceAddsEvidence || !probeHasCompleteAbilities
        ? (sourceProbe.region ?? modelGuidedProbe.region)
        : probe.region;
  const promotedDocument = promoteRecoveredAbilityRegion(document, provenRegion, initialIssues);

  const issues = [...promotedDocument.issues.filter((current) => !initialIssues.includes(current)), ...initialIssues];
  const proficiencyBonus = structuredProficiencyBonus(promotedDocument, issues, modelFacts.essentialRegions ?? []);
  const deterministicRows = deterministicAbilityRows(promotedDocument, modelFacts.abilityRows, issues);
  const recoveredTable = resolveAbilityTableFromHeader(
    promotedDocument,
    modelFacts.abilityLabels,
    proficiencyBonus?.value ?? null,
  );
  issues.push(...recoveredTable.issues);
  const sourceRecoveredTable =
    options.essentialOnly === true
      ? modelGuidedProbe.resolution
      : (sourceProbe.resolution ?? modelGuidedProbe.resolution);
  const verifiedAbilityTables = (modelFacts.essentialRegions ?? [])
    .filter((region) => region.kind === "ability_scores")
    .flatMap((region) => {
      const resolved = resolveVerifiedAbilityRegionFromSource(
        promotedDocument,
        region,
        modelFacts.abilityLabels,
        proficiencyBonus?.value ?? null,
        true,
        options.essentialOnly === true,
      );
      if (resolved === null) {
        issues.push(
          issue(
            "unproven_verified_ability_region",
            "warning",
            "A verifier-proposed ability region remained visible source but was rejected because the numeric/label constraints did not prove a complete six-ability table.",
            { start: region.start, end: region.end },
          ),
        );
        return [];
      }
      if (resolved.region !== null && resolved.region.end > region.end) {
        issues.push(
          issue(
            "verified_ability_region_constraint_extended",
            "info",
            "A verifier-proposed ability region ended before the complete numeric table; deterministic constraints extended only its right edge to the smallest complete six-ability region.",
            {
              proposedStart: region.start,
              proposedEnd: region.end,
              provenStart: resolved.region.start,
              provenEnd: resolved.region.end,
            },
          ),
        );
      }
      return [resolved];
    });
  const abilities = resolveAbilities(
    [
      ...deterministicRows,
      ...recoveredTable.abilities,
      ...(sourceRecoveredTable?.abilities ?? []),
      ...verifiedAbilityTables.flatMap((table) => table.abilities),
    ],
    issues,
  );

  const abilityEvidenceRegion =
    verifiedAbilityTables.find((table) => table.region !== null)?.region ??
    sourceRecoveredTable?.region ??
    recoveredTable.region;
  const abilityEvidence: HeaderFactSource | null =
    abilityEvidenceRegion === null || abilityEvidenceRegion === undefined
      ? null
      : {
          annotationId: "structured-ability-evidence",
          start: abilityEvidenceRegion.start,
          end: abilityEvidenceRegion.end,
          evidence: promotedDocument.rawSource.slice(abilityEvidenceRegion.start, abilityEvidenceRegion.end),
        };

  const deterministicSaves = deterministicSavingThrows(promotedDocument, deterministicRows);
  const standaloneSaves = deterministicStandaloneSavingThrows(promotedDocument, modelFacts.abilityLabels, issues);
  const verifiedEssentialSaves = verifiedEssentialStandaloneSavingThrows(
    promotedDocument,
    modelFacts.essentialRegions ?? [],
    modelFacts.abilityLabels,
    issues,
  );
  const adjacentModelGuidedSaves =
    verifiedEssentialSaves.length > 0 || standaloneSaves.length > 0
      ? []
      : modelGuidedAdjacentSavingThrows(promotedDocument, abilityEvidenceRegion, modelFacts.abilityLabels, issues);
  const verifiedSavingThrowEvidence =
    verifiedEssentialSaves.length === 0
      ? null
      : compactEvidence(
          trimmedEssentialEvidence(
            promotedDocument,
            essentialRegion(modelFacts.essentialRegions ?? [], "saving_throws"),
          ),
          640,
        );
  const standaloneKeys = new Set(standaloneSaves.map((save) => `${save.ability}:${save.bonus}`));
  const unmatchedModelSaves = modelFacts.savingThrows.filter(
    (save) => !standaloneKeys.has(`${save.ability}:${save.bonus}`),
  );
  const modelSaves = groundModelSavingThrows(promotedDocument, unmatchedModelSaves, issues);
  const savingThrows = resolveSavingThrows(
    [
      ...standaloneSaves,
      ...verifiedEssentialSaves,
      ...adjacentModelGuidedSaves,
      ...modelSaves,
      ...deterministicSaves,
      ...recoveredTable.savingThrows,
      ...(sourceRecoveredTable?.savingThrows ?? []),
      ...verifiedAbilityTables.flatMap((table) => table.savingThrows),
    ],
    issues,
  );

  const savingThrowEvidence =
    verifiedSavingThrowEvidence ??
    sharedPhysicalSavingThrowRowEvidence(promotedDocument, savingThrows, abilityEvidence);

  const hasAbilityBlock =
    headerAnnotations(promotedDocument, ["ability_scores"]).length > 0 ||
    recoveredTable.abilities.length > 0 ||
    modelFacts.abilityLabels.length > 0;
  const missingAbilities = ABILITY_KEYS.filter((ability) => abilities[ability] === null);

  if (hasAbilityBlock && missingAbilities.length > 0) {
    issues.push(
      issue(
        "incomplete_structured_abilities",
        "warning",
        "The exact ability-score block was preserved, but some scores could not be structured without guessing.",
        { missingAbilities },
      ),
    );
  }

  const essentialRegions = modelFacts.essentialRegions ?? [];
  const name =
    verifiedTextFact(promotedDocument, essentialRegions, "name") ?? fallbackTextFact(promotedDocument, "name");
  const sizeTypeAlignment =
    verifiedTextFact(promotedDocument, essentialRegions, "size_type_alignment") ??
    fallbackTextFact(promotedDocument, "size_type_alignment");
  const armorClass =
    verifiedIntegerFact(promotedDocument, essentialRegions, "armor_class") ??
    fallbackIntegerFact(promotedDocument, "armor_class");
  const hitPoints =
    verifiedIntegerFact(promotedDocument, essentialRegions, "hit_points") ??
    fallbackIntegerFact(promotedDocument, "hit_points");
  const initiative =
    verifiedInitiativeFact(promotedDocument, essentialRegions) ?? fallbackInitiativeFact(promotedDocument);
  const challenge =
    challengeFactFromEvidence(promotedDocument, essentialRegions) ?? challengeFactFromHeader(promotedDocument);

  return {
    ...promotedDocument,
    structuredHeader: {
      name,
      sizeTypeAlignment,
      armorClass,
      initiative,
      hitPoints,
      challenge,
      abilityEvidence,
      savingThrowEvidence,
      abilities,
      savingThrows,
      proficiencyBonus,
    },
    issues,
  };
}
