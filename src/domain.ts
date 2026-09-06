export type SourceUnitKind = "content" | "separator";

export type SourceUnit = {
  id: string;
  start: number;
  end: number;
  text: string;
  kind: SourceUnitKind;
};

export type LosslessSourceMap = {
  version: "lossless-source-v1";
  encoding: "utf8";
  rawLength: number;
  sourceSha256: string;
  units: SourceUnit[];
};

export const STATBLOCK_SECTIONS = [
  "traits",
  "actions",
  "bonus_actions",
  "reactions",
  "legendary_actions",
  "mythic_actions",
  "lair_actions",
  "regional_effects",
  "description",
] as const;

export type StatblockSection = (typeof STATBLOCK_SECTIONS)[number];

export const HEADER_FIELDS = [
  "name",
  "size_type_alignment",
  "size",
  "creature_type",
  "creature_subtype",
  "alignment",
  "armor_class",
  "armor_type",
  "initiative",
  "hit_points",
  "speed",
  "ability_scores",
  "ability_modifiers",
  "saving_throws",
  "skills",
  "damage_vulnerabilities",
  "damage_resistances",
  "damage_immunities",
  "condition_immunities",
  "senses",
  "languages",
  "habitat",
  "challenge",
  "experience_points",
  "proficiency_bonus",
  "other_header",
] as const;

export type HeaderField = (typeof HEADER_FIELDS)[number];

export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export type AbilityKey = (typeof ABILITY_KEYS)[number];

export type HeaderFactProvenance = "model_evidence" | "deterministic_header_parse" | "deterministic_cr_derivation";

export type HeaderFactSource = {
  annotationId: string;
  start: number;
  end: number;
  evidence: string;
};

export type GroundedTextHeaderFact = {
  text: string;
  provenance: HeaderFactProvenance;
  source: HeaderFactSource;
};

export type GroundedIntegerHeaderFact = {
  value: number;
  provenance: HeaderFactProvenance;
  source: HeaderFactSource;
};

export type ChallengeRatingFact = {
  value: number;
  provenance: HeaderFactProvenance;
  source: HeaderFactSource;
};

export type AbilityScoreFact = {
  ability: AbilityKey;
  score: number;
  modifier: number;
  printedModifier: number | null;
  printedSave: number | null;
  provenance: HeaderFactProvenance;
  source: HeaderFactSource;
};

export type SavingThrowFact = {
  ability: AbilityKey;
  bonus: number;
  provenance: HeaderFactProvenance;
  source: HeaderFactSource;
};

export type ProficiencyBonusFact = {
  value: number;
  printed: boolean;
  challengeRating: number | null;
  provenance: HeaderFactProvenance;
  source: HeaderFactSource;
};

export type StructuredHeader = {
  /** Closed fixed-header contract. Optional only for backward-compatible fixtures/migrations. */
  name?: GroundedTextHeaderFact | null;
  sizeTypeAlignment?: GroundedTextHeaderFact | null;
  armorClass?: GroundedIntegerHeaderFact | null;
  initiative?: GroundedIntegerHeaderFact | null;
  hitPoints?: GroundedIntegerHeaderFact | null;
  challenge?: ChallengeRatingFact | null;
  /** Exact source region used to prove the structured six-ability table. */
  abilityEvidence?: HeaderFactSource | null;
  /** Exact standalone source region used to prove printed saving throws, when available. */
  savingThrowEvidence?: HeaderFactSource | null;
  abilities: Record<AbilityKey, AbilityScoreFact | null>;
  savingThrows: SavingThrowFact[];
  proficiencyBonus: ProficiencyBonusFact | null;
};

export type AnnotationRole =
  | "header_field"
  | "header_content"
  | "section_heading"
  | "section_rules"
  | "feature"
  | "section_content"
  | "supplementary";

export type AnnotationProvenance =
  | "model_span"
  | "deterministic_section_ownership"
  | "deterministic_section_heading"
  | "deterministic_region_gap"
  | "deterministic_post_statblock_gap"
  | "deterministic_header_continuation"
  | "deterministic_header_uncertainty"
  | "deterministic_header_split"
  | "deterministic_ability_table";

export type SourceSpan = {
  startUnitId: string;
  endUnitId: string;
  start: number;
  end: number;
};

export type CompiledAnnotation = {
  id: string;
  candidateIndex: number;
  provenance: AnnotationProvenance;
  role: AnnotationRole;
  field: HeaderField | null;
  section: StatblockSection | null;
  source: SourceSpan;
  text: string;
};

export type DocumentBlockKind = "annotated" | "unclassified" | "separator";

export type DocumentBlock = {
  id: string;
  kind: DocumentBlockKind;
  start: number;
  end: number;
  text: string;
  annotationId: string | null;
};

export type ParseIssueSeverity = "info" | "warning";

export type ParseIssue = {
  code: string;
  severity: ParseIssueSeverity;
  message: string;
  candidateIndex: number | null;
  details: Record<string, unknown>;
};

export type HeaderView = {
  fieldBlockIds: string[];
  contentBlockIds: string[];
  unclassifiedBlockIds: string[];
};

export type SectionView = {
  section: StatblockSection;
  headingBlockIds: string[];
  rulesBlockIds: string[];
  featureBlockIds: string[];
  contentBlockIds: string[];
  unclassifiedBlockIds: string[];
};

export type NormalizedView = {
  sourceOrderBlockIds: string[];
  sourceOrderContentBlockIds: string[];
  header: HeaderView;
  sections: SectionView[];
  supplementaryBlockIds: string[];
  topLevelUnclassifiedBlockIds: string[];
};

export type ModelRunSummary = {
  model: string;
  attempted: boolean;
  succeeded: boolean;
  elapsedSeconds: number | null;
  requestCount: number;
  succeededRequestCount: number;
  partialRequestCount: number;
  failedRequestCount: number;
  returnedCandidateCount: number;
  suppressedDuplicateCandidateCount: number;
  acceptedAnnotationCount: number;
  acceptedModelAnnotationCount: number;
  deterministicAnnotationCount: number;
  rejectedCandidateCount: number;
};

export type IntegritySummary = {
  sourceMapValid: boolean;
  blockPartitionValid: boolean;
  reconstructsRawSource: boolean;
};

export type LosslessStatblockDocument = {
  formatVersion: "lossless-statblock-v1";
  rawSource: string;
  sourceMap: LosslessSourceMap;
  annotations: CompiledAnnotation[];
  blocks: DocumentBlock[];
  view: NormalizedView;
  structuredHeader: StructuredHeader;
  model: ModelRunSummary;
  integrity: IntegritySummary;
  issues: ParseIssue[];
};

export type ParserReport = {
  formatVersion: "lossless-statblock-report-v1";
  sourceSha256: string;
  rawLength: number;
  sourceUnitCount: number;
  contentUnitCount: number;
  blockCount: number;
  annotatedBlockCount: number;
  unclassifiedBlockCount: number;
  separatorBlockCount: number;
  structuredHeader: StructuredHeader;
  model: ModelRunSummary;
  integrity: IntegritySummary;
  issues: ParseIssue[];
};
