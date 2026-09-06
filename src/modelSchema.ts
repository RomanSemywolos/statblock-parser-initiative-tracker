import { z } from "zod";

import { ABILITY_KEYS, HEADER_FIELDS, STATBLOCK_SECTIONS, type AbilityKey, type HeaderField } from "./domain.js";

const UnitIdSchema = z.string().regex(/^unit-\d+$/, "Expected a source unit id such as unit-12.");
const SourceRangeShape = { startUnitId: UnitIdSchema, endUnitId: UnitIdSchema };

const HeaderAnnotationSchema = z
  .object({
    role: z.literal("header_field"),
    field: z.enum(HEADER_FIELDS),
    ...SourceRangeShape,
  })
  .strict();
const SectionHeadingAnnotationSchema = z
  .object({
    role: z.literal("section_heading"),
    section: z.enum(STATBLOCK_SECTIONS).nullable(),
    ...SourceRangeShape,
  })
  .strict();
const SectionRulesAnnotationSchema = z
  .object({
    role: z.literal("section_rules"),
    section: z.enum(STATBLOCK_SECTIONS).nullable(),
    ...SourceRangeShape,
  })
  .strict();
const FeatureAnnotationSchema = z
  .object({
    role: z.literal("feature"),
    section: z.enum(STATBLOCK_SECTIONS).nullable(),
    ...SourceRangeShape,
  })
  .strict();
const SectionContentAnnotationSchema = z
  .object({
    role: z.literal("section_content"),
    section: z.enum(STATBLOCK_SECTIONS).nullable(),
    ...SourceRangeShape,
  })
  .strict();
const SupplementaryAnnotationSchema = z
  .object({
    role: z.literal("supplementary"),
    ...SourceRangeShape,
  })
  .strict();

const ModelAnnotationSchema = z.discriminatedUnion("role", [
  HeaderAnnotationSchema,
  SectionHeadingAnnotationSchema,
  SectionRulesAnnotationSchema,
  FeatureAnnotationSchema,
  SectionContentAnnotationSchema,
  SupplementaryAnnotationSchema,
]);

export type ModelAnnotation = z.infer<typeof ModelAnnotationSchema>;
export type ParsedModelResponse = {
  candidates: Array<{
    candidateIndex: number;
    annotation: ModelAnnotation;
    provenance?:
      | "model_span"
      | "deterministic_section_ownership"
      | "deterministic_section_heading"
      | "deterministic_region_gap"
      | "deterministic_post_statblock_gap"
      | "deterministic_header_continuation";
  }>;
  returnedCandidateCount: number;
  issues: ModelResponseIssue[];
};

export type ModelAbilityLabel = { ability: AbilityKey; labelQuote: string };
export type ModelAbilityRow = ModelAbilityLabel & { sourceQuote: string };
export type ModelSavingThrow = { ability: AbilityKey; bonus: number; sourceQuote: string };
export type ModelHeaderFactIssue = {
  code:
    | "invalid_model_ability_row"
    | "invalid_model_saving_throw"
    | "verified_identity_overlap_carved"
    | "verified_identity_prefix_carved"
    | "verified_identity_identical_span_rejected";
  message: string;
  details: Record<string, unknown>;
};
export type ParsedModelHeaderFacts = {
  abilityRows: ModelAbilityRow[];
  abilityLabels: ModelAbilityLabel[];
  savingThrows: ModelSavingThrow[];
  essentialRegions?: Array<{
    kind:
      | "name"
      | "size_type_alignment"
      | "armor_class"
      | "initiative"
      | "hit_points"
      | "ability_scores"
      | "saving_throws"
      | "challenge"
      | "proficiency_bonus";
    start: number;
    end: number;
  }>;
  issues: ModelHeaderFactIssue[];
};
export type ModelResponseIssue = {
  candidateIndex: number | null;
  message: string;
  details: Record<string, unknown>;
};

function validationMessage(error: z.ZodError): string {
  return error.issues.map((entry) => `${entry.path.join(".") || "<root>"}: ${entry.message}`).join("; ");
}

export type CandidateRunClassification =
  | "name"
  | "size_type_alignment"
  | "header_field"
  | "traits_heading"
  | "actions_heading"
  | "bonus_actions_heading"
  | "reactions_heading"
  | "legendary_actions_heading"
  | "mythic_actions_heading"
  | "lair_actions_heading"
  | "regional_effects_heading"
  | "description_heading"
  | "unknown_section_heading"
  | "section_rules"
  | "feature"
  | "body_metadata"
  | "body_paragraph"
  | "section_content"
  | "supplementary"
  | "unclassified";

const CANDIDATE_MODEL_RUN_CODES = ["u", "n", "sta", "h", "m", "sh", "r", "f", "sc", "sup"] as const;
type CandidateModelRunCode = (typeof CANDIDATE_MODEL_RUN_CODES)[number];
const CANDIDATE_SECTION_CODE_MAP = {
  t: "traits_heading",
  a: "actions_heading",
  ba: "bonus_actions_heading",
  r: "reactions_heading",
  la: "legendary_actions_heading",
  ma: "mythic_actions_heading",
  lair: "lair_actions_heading",
  reg: "regional_effects_heading",
  desc: "description_heading",
} as const satisfies Record<string, CandidateRunClassification>;
type CandidateSectionCode = keyof typeof CANDIDATE_SECTION_CODE_MAP;
const CANDIDATE_SECTION_CODES = Object.keys(CANDIDATE_SECTION_CODE_MAP) as CandidateSectionCode[];
const CANDIDATE_HEADER_FIELD_CODE_MAP = {
  ac: "armor_class",
  init: "initiative",
  hp: "hit_points",
  spd: "speed",
  ab: "ability_scores",
  sv: "saving_throws",
  sk: "skills",
  dv: "damage_vulnerabilities",
  dr: "damage_resistances",
  di: "damage_immunities",
  ci: "condition_immunities",
  se: "senses",
  lang: "languages",
  hab: "habitat",
  cr: "challenge",
  xp: "experience_points",
  pb: "proficiency_bonus",
  oth: "other_header",
} as const satisfies Record<string, HeaderField>;
type CandidateHeaderFieldCode = keyof typeof CANDIDATE_HEADER_FIELD_CODE_MAP;
const CANDIDATE_HEADER_FIELD_CODES = Object.keys(CANDIDATE_HEADER_FIELD_CODE_MAP) as CandidateHeaderFieldCode[];

export type CandidateRun = {
  classification: CandidateRunClassification;
  startCandidate: number;
  endCandidate: number;
  field: HeaderField | null;
};
export type CandidateAbilityLabel = { ability: AbilityKey; labelQuote: string };
type CandidateSavingThrow = { ability: AbilityKey; bonus: number; evidenceQuote: string };
type CandidateEssentialFactKind =
  | "name"
  | "size_type_alignment"
  | "armor_class"
  | "initiative"
  | "hit_points"
  | "ability_scores"
  | "saving_throws"
  | "challenge"
  | "proficiency_bonus";
export type CandidateEssentialFact = {
  kind: CandidateEssentialFactKind;
  startCandidate: number;
  endCandidate: number;
};
export type ParsedCandidateModelResponse = {
  runs: CandidateRun[];
  debugRuns: CandidateRun[];
  abilityLabels: CandidateAbilityLabel[];
  savingThrows: CandidateSavingThrow[];
  essentialFacts?: CandidateEssentialFact[];
  returnedCandidateCount: number;
  issues: ModelResponseIssue[];
};

export type SinglelineHeaderIdentityCoordinateKind = "name" | "size_type_alignment";
export type SinglelineHeaderFieldCoordinateKind = "ac" | "init" | "hp" | "sv" | "cr" | "pb";
export type ParsedSinglelineHeaderCoordinatesResponse = {
  identity: Array<{ kind: SinglelineHeaderIdentityCoordinateKind; startCandidate: number; endCandidate: number }>;
  fields: Array<{ kind: SinglelineHeaderFieldCoordinateKind; startCandidate: number; endCandidate: number }>;
  abilityLabels: Array<{ ability: AbilityKey; startCandidate: number; endCandidate: number }>;
  issues: ModelResponseIssue[];
};

const CandidateModelRunCodeSchema = z.enum(
  CANDIDATE_MODEL_RUN_CODES as unknown as [CandidateModelRunCode, ...CandidateModelRunCode[]],
);
const CandidateSectionCodeSchema = z.enum(CANDIDATE_SECTION_CODES as [CandidateSectionCode, ...CandidateSectionCode[]]);
const CandidateHeaderFieldCodeSchema = z.enum(
  CANDIDATE_HEADER_FIELD_CODES as [CandidateHeaderFieldCode, ...CandidateHeaderFieldCode[]],
);
const CandidateHeaderFieldOutputCodeSchema = z.union([CandidateHeaderFieldCodeSchema, z.literal("none")]);
const CandidateSpanSchema = z
  .object({
    k: CandidateModelRunCodeSchema,
    s: z.string().regex(/^C\d+$/u),
    e: z.string().regex(/^C\d+$/u),
    v: CandidateSectionCodeSchema.optional(),
    f: CandidateHeaderFieldOutputCodeSchema.optional(),
  })
  .strict();
const CandidateAbilityLabelSchema = z.union([
  z.object({ ability: z.enum(ABILITY_KEYS), labelQuote: z.string().min(1) }).strict(),
  z.object({ a: z.enum(ABILITY_KEYS), q: z.string().min(1) }).strict(),
]);
const CandidateSavingThrowSchema = z
  .object({ ability: z.enum(ABILITY_KEYS), bonus: z.number().int(), evidenceQuote: z.string().min(1) })
  .strict();
const CandidateEssentialFactSchema = z
  .object({
    k: z.enum(["n", "sta", "ac", "init", "hp", "ab", "sv", "cr", "pb"]),
    s: z.string().regex(/^C\d+$/u),
    e: z.string().regex(/^C\d+$/u),
  })
  .strict();
const CandidateResponseEnvelopeSchema = z
  .object({
    blocks: z.array(z.unknown()),
    abilityLabels: z.array(z.unknown()).optional().default([]),
    essentialFacts: z.array(z.unknown()).optional().default([]),
    savingThrows: z.array(z.unknown()).optional().default([]),
  })
  .strict();

function candidateId(index: number): string {
  return `C${String(index).padStart(3, "0")}`;
}
function parseCandidateId(id: string): number | null {
  const match = /^C(\d+)$/u.exec(id);
  if (match === null) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

type ParsedBodyLineStartsResponse = { starts: number[]; returnedCandidateCount: number; issues: ModelResponseIssue[] };
const BodyLineStartsEnvelopeSchema = z.object({ starts: z.array(z.object({ s: z.string() }).strict()) }).strict();
const NumericBodyLineStartsEnvelopeSchema = z
  .object({ starts: z.array(z.object({ s: z.number().int().nonnegative() }).strict()) })
  .strict();

function createBodyLineStartsGenerationJsonSchema(
  expectedCandidateCount: number,
  allowedCandidateIndexes?: readonly number[],
): Record<string, unknown> {
  const allIds = Array.from({ length: expectedCandidateCount }, (_, index) => candidateId(index));
  const allowedIds =
    allowedCandidateIndexes === undefined
      ? allIds
      : [...new Set(allowedCandidateIndexes)]
          .filter((index) => Number.isInteger(index) && index >= 0 && index < expectedCandidateCount)
          .sort((left, right) => left - right)
          .map(candidateId);
  return {
    type: "object",
    properties: {
      starts: {
        type: "array",
        minItems: 0,
        maxItems: allowedIds.length,
        uniqueItems: true,
        items: {
          type: "object",
          properties: { s: { type: "string", enum: allowedIds } },
          required: ["s"],
          additionalProperties: false,
        },
      },
    },
    required: ["starts"],
    additionalProperties: false,
  } as const;
}

export function createNumericBodyLineStartsGenerationJsonSchema(
  expectedCandidateCount: number,
  allowedCandidateIndexes?: readonly number[],
): Record<string, unknown> {
  const allowedCount =
    allowedCandidateIndexes === undefined
      ? expectedCandidateCount
      : new Set(
          allowedCandidateIndexes.filter(
            (index) => Number.isInteger(index) && index >= 0 && index < expectedCandidateCount,
          ),
        ).size;
  const maximum = Math.max(0, expectedCandidateCount - 1);
  return {
    type: "object",
    properties: {
      starts: {
        type: "array",
        minItems: 0,
        maxItems: allowedCount,
        uniqueItems: true,
        items: {
          type: "object",
          properties: { s: { type: "integer", minimum: 0, maximum } },
          required: ["s"],
          additionalProperties: false,
        },
      },
    },
    required: ["starts"],
    additionalProperties: false,
  } as const;
}

export function parseNumericBodyLineStartsResponse(
  value: unknown,
  expectedCandidateCount: number,
  allowedCandidateIndexes: readonly number[],
  diagnosticLabel = "BODY multiline-normalization",
): ParsedBodyLineStartsResponse {
  const envelope = NumericBodyLineStartsEnvelopeSchema.safeParse(value);
  if (!envelope.success)
    return {
      starts: [],
      returnedCandidateCount: 0,
      issues: [
        {
          candidateIndex: null,
          message: `The ${diagnosticLabel} response does not have the required numeric-start envelope.`,
          details: { validation: validationMessage(envelope.error) },
        },
      ],
    };
  const allowed = new Set(allowedCandidateIndexes);
  const seen = new Set<number>();
  const starts: number[] = [];
  const issues: ModelResponseIssue[] = [];
  for (const item of envelope.data.starts) {
    const index = item.s;
    if (index < 0 || index >= expectedCandidateCount || !allowed.has(index)) {
      issues.push({
        candidateIndex: index,
        message: `A ${diagnosticLabel} logical-line start used a candidate outside the BODY-owned coordinate set and was ignored.`,
        details: { start: index },
      });
      continue;
    }
    if (seen.has(index)) {
      issues.push({
        candidateIndex: index,
        message: `A ${diagnosticLabel} logical-line start was returned more than once; the duplicate was collapsed.`,
        details: { start: index },
      });
      continue;
    }
    seen.add(index);
    starts.push(index);
  }
  starts.sort((left, right) => left - right);
  return { starts, returnedCandidateCount: starts.length, issues };
}

function parseBodyLineStartsResponse(
  value: unknown,
  expectedCandidateCount: number,
  allowedCandidateIndexes: readonly number[],
  diagnosticLabel: string,
): ParsedBodyLineStartsResponse {
  const envelope = BodyLineStartsEnvelopeSchema.safeParse(value);
  if (!envelope.success)
    return {
      starts: [],
      returnedCandidateCount: 0,
      issues: [
        {
          candidateIndex: null,
          message: `The ${diagnosticLabel} response does not have the required envelope.`,
          details: { validation: validationMessage(envelope.error) },
        },
      ],
    };
  const allowed = new Set(allowedCandidateIndexes);
  const seen = new Set<number>();
  const starts: number[] = [];
  const issues: ModelResponseIssue[] = [];
  for (const item of envelope.data.starts) {
    const index = parseCandidateId(item.s);
    if (index === null || index < 0 || index >= expectedCandidateCount || !allowed.has(index)) {
      issues.push({
        candidateIndex: index,
        message: `A ${diagnosticLabel} logical-line start used a candidate outside the BODY-owned coordinate set and was ignored.`,
        details: { start: item.s },
      });
      continue;
    }
    if (seen.has(index)) {
      issues.push({
        candidateIndex: index,
        message: `A ${diagnosticLabel} logical-line start was returned more than once; the duplicate was collapsed.`,
        details: { start: item.s },
      });
      continue;
    }
    seen.add(index);
    starts.push(index);
  }
  starts.sort((left, right) => left - right);
  return { starts, returnedCandidateCount: starts.length, issues };
}

export function createMixedBodyBoundaryGenerationJsonSchema(
  expectedCandidateCount: number,
  allowedCandidateIndexes?: readonly number[],
): Record<string, unknown> {
  return createBodyLineStartsGenerationJsonSchema(expectedCandidateCount, allowedCandidateIndexes);
}

export function parseMixedBodyBoundaryResponse(
  value: unknown,
  expectedCandidateCount: number,
  allowedCandidateIndexes: readonly number[],
): ParsedBodyLineStartsResponse {
  return parseBodyLineStartsResponse(
    value,
    expectedCandidateCount,
    allowedCandidateIndexes,
    "mixed BODY multiline-normalization",
  );
}

const SinglelineHeaderIdentityCoordinateSchema = z
  .object({
    k: z.enum(["n", "sta"]),
    s: z.string().regex(/^C\d+$/u),
    e: z.string().regex(/^C\d+$/u),
  })
  .strict();
const SinglelineHeaderFieldCoordinateSchema = z
  .object({
    k: z.enum(["ac", "init", "hp", "sv", "cr", "pb"]),
    s: z.string().regex(/^C\d+$/u),
    e: z.string().regex(/^C\d+$/u),
  })
  .strict();
const SinglelineHeaderAbilityCoordinateSchema = z
  .object({
    a: z.enum(ABILITY_KEYS),
    s: z.string().regex(/^C\d+$/u),
    e: z.string().regex(/^C\d+$/u),
  })
  .strict();
const SinglelineHeaderCoordinatesEnvelopeSchema = z
  .object({
    identity: z.array(z.unknown()),
    fields: z.array(z.unknown()),
    abilityLabels: z.array(z.unknown()),
  })
  .strict();

function singlelineCoordinateIndex(id: string): number | null {
  const match = /^C(\d+)$/u.exec(id);
  if (match === null) return null;
  const value = Number.parseInt(match[1]!, 10);
  return Number.isSafeInteger(value) ? value : null;
}

export function createSinglelineHeaderCoordinatesGenerationJsonSchema(
  _expectedCandidateCount: number,
): Record<string, unknown> {
  // Dense singleline input can contain hundreds of addresses. Repeating every Cxxx
  // value in three per-request enums bloats the structured prompt and competes with
  // the source itself. The response parser still proves every returned ID against
  // the actual lattice, so the generation schema only constrains the lexical shape.
  const coordinateId = { type: "string", pattern: "^C[0-9]+$", minLength: 2, maxLength: 12 } as const;
  const spanProperties = { s: coordinateId, e: coordinateId } as const;
  return {
    type: "object",
    properties: {
      identity: {
        type: "array",
        minItems: 0,
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            k: { type: "string", enum: ["n", "sta"] },
            ...spanProperties,
          },
          required: ["k", "s", "e"],
          additionalProperties: false,
        },
      },
      fields: {
        type: "array",
        minItems: 0,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            k: { type: "string", enum: ["ac", "init", "hp", "sv", "cr", "pb"] },
            ...spanProperties,
          },
          required: ["k", "s", "e"],
          additionalProperties: false,
        },
      },
      abilityLabels: {
        type: "array",
        minItems: 0,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            a: { type: "string", enum: ["str", "dex", "con", "int", "wis", "cha"] },
            ...spanProperties,
          },
          required: ["a", "s", "e"],
          additionalProperties: false,
        },
      },
    },
    required: ["identity", "fields", "abilityLabels"],
    additionalProperties: false,
  } as const;
}

export function parseSinglelineHeaderCoordinatesResponse(
  value: unknown,
  expectedCandidateCount: number,
): ParsedSinglelineHeaderCoordinatesResponse {
  const envelope = SinglelineHeaderCoordinatesEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    return {
      identity: [],
      fields: [],
      abilityLabels: [],
      issues: [
        {
          candidateIndex: null,
          message: "The model response does not have the required singleline Header-coordinate-span envelope.",
          details: { validation: validationMessage(envelope.error) },
        },
      ],
    };
  }

  const issues: ModelResponseIssue[] = [];
  const identity: ParsedSinglelineHeaderCoordinatesResponse["identity"] = [];
  const fields: ParsedSinglelineHeaderCoordinatesResponse["fields"] = [];
  const abilityLabels: ParsedSinglelineHeaderCoordinatesResponse["abilityLabels"] = [];
  const seenIdentity = new Set<SinglelineHeaderIdentityCoordinateKind>();
  const seenFields = new Set<SinglelineHeaderFieldCoordinateKind>();
  const seenAbilities = new Set<AbilityKey>();
  const parseSpan = (startId: string, endId: string): { startCandidate: number; endCandidate: number } | null => {
    const startCandidate = singlelineCoordinateIndex(startId);
    const endCandidate = singlelineCoordinateIndex(endId);
    if (
      startCandidate === null ||
      endCandidate === null ||
      startCandidate < 0 ||
      endCandidate < startCandidate ||
      endCandidate >= expectedCandidateCount
    )
      return null;
    return { startCandidate, endCandidate };
  };

  for (let index = 0; index < envelope.data.identity.length; index += 1) {
    const parsed = SinglelineHeaderIdentityCoordinateSchema.safeParse(envelope.data.identity[index]);
    if (!parsed.success) {
      issues.push({
        candidateIndex: null,
        message: "A singleline identity coordinate span failed validation and was rejected independently.",
        details: { anchorIndex: index, validation: validationMessage(parsed.error) },
      });
      continue;
    }
    const kind: SinglelineHeaderIdentityCoordinateKind = parsed.data.k === "n" ? "name" : "size_type_alignment";
    const span = parseSpan(parsed.data.s, parsed.data.e);
    if (span === null) {
      issues.push({
        candidateIndex: null,
        message:
          "A singleline identity span referenced coordinates outside the supplied lattice or reversed its endpoints.",
        details: { anchorIndex: index, kind, startId: parsed.data.s, endId: parsed.data.e, expectedCandidateCount },
      });
      continue;
    }
    if (seenIdentity.has(kind)) {
      issues.push({
        candidateIndex: span.startCandidate,
        message: "A duplicate singleline identity coordinate span was omitted.",
        details: { anchorIndex: index, kind },
      });
      continue;
    }
    seenIdentity.add(kind);
    identity.push({ kind, ...span });
  }

  for (let index = 0; index < envelope.data.fields.length; index += 1) {
    const parsed = SinglelineHeaderFieldCoordinateSchema.safeParse(envelope.data.fields[index]);
    if (!parsed.success) {
      issues.push({
        candidateIndex: null,
        message: "A singleline Header field coordinate span failed validation and was rejected independently.",
        details: { anchorIndex: index, validation: validationMessage(parsed.error) },
      });
      continue;
    }
    const span = parseSpan(parsed.data.s, parsed.data.e);
    if (span === null) {
      issues.push({
        candidateIndex: null,
        message:
          "A singleline Header field span referenced coordinates outside the supplied lattice or reversed its endpoints.",
        details: {
          anchorIndex: index,
          kind: parsed.data.k,
          startId: parsed.data.s,
          endId: parsed.data.e,
          expectedCandidateCount,
        },
      });
      continue;
    }
    if (seenFields.has(parsed.data.k)) {
      issues.push({
        candidateIndex: span.startCandidate,
        message: "A duplicate singleline Header field coordinate span was omitted.",
        details: { anchorIndex: index, kind: parsed.data.k },
      });
      continue;
    }
    seenFields.add(parsed.data.k);
    fields.push({ kind: parsed.data.k, ...span });
  }

  for (let index = 0; index < envelope.data.abilityLabels.length; index += 1) {
    const parsed = SinglelineHeaderAbilityCoordinateSchema.safeParse(envelope.data.abilityLabels[index]);
    if (!parsed.success) {
      issues.push({
        candidateIndex: null,
        message: "A singleline ability coordinate span failed validation and was rejected independently.",
        details: { anchorIndex: index, validation: validationMessage(parsed.error) },
      });
      continue;
    }
    const span = parseSpan(parsed.data.s, parsed.data.e);
    if (span === null) {
      issues.push({
        candidateIndex: null,
        message:
          "A singleline ability span referenced coordinates outside the supplied lattice or reversed its endpoints.",
        details: {
          anchorIndex: index,
          ability: parsed.data.a,
          startId: parsed.data.s,
          endId: parsed.data.e,
          expectedCandidateCount,
        },
      });
      continue;
    }
    if (seenAbilities.has(parsed.data.a)) {
      issues.push({
        candidateIndex: span.startCandidate,
        message: "A duplicate singleline ability coordinate span was omitted.",
        details: { anchorIndex: index, ability: parsed.data.a },
      });
      continue;
    }
    seenAbilities.add(parsed.data.a);
    abilityLabels.push({ ability: parsed.data.a, ...span });
  }

  return { identity, fields, abilityLabels, issues };
}

export function createEssentialFactsGenerationJsonSchema(expectedCandidateCount: number): Record<string, unknown> {
  const ids = Array.from({ length: expectedCandidateCount }, (_, index) => candidateId(index));
  return {
    type: "object",
    properties: {
      essentialFacts: {
        type: "array",
        minItems: 0,
        maxItems: 9,
        items: {
          type: "object",
          properties: {
            k: { type: "string", enum: ["n", "sta", "ac", "init", "hp", "ab", "sv", "cr", "pb"] },
            s: { type: "string", enum: ids.length > 0 ? ids : ["C000"] },
            e: { type: "string", enum: ids.length > 0 ? ids : ["C000"] },
          },
          required: ["k", "s", "e"],
          additionalProperties: false,
        },
      },
      abilityLabels: {
        type: "array",
        minItems: 0,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            a: { type: "string", enum: ["str", "dex", "con", "int", "wis", "cha"] },
            q: { type: "string" },
          },
          required: ["a", "q"],
          additionalProperties: false,
        },
      },
    },
    required: ["essentialFacts", "abilityLabels"],
    additionalProperties: false,
  } as const;
}

const CandidateEssentialFactsEnvelopeSchema = z
  .object({
    essentialFacts: z.array(z.unknown()),
    abilityLabels: z.array(z.unknown()).optional(),
  })
  .strict();
type ParsedCandidateEssentialFactsResponse = {
  essentialFacts: CandidateEssentialFact[];
  abilityLabels: CandidateAbilityLabel[];
  issues: ModelResponseIssue[];
};

function parseCandidateEssentialFacts(
  rawFacts: readonly unknown[],
  expectedCandidateCount: number,
): ParsedCandidateEssentialFactsResponse {
  const issues: ModelResponseIssue[] = [];
  const essentialFacts: CandidateEssentialFact[] = [];
  const seenKinds = new Set<CandidateEssentialFactKind>();
  const essentialKindByCode = {
    n: "name",
    sta: "size_type_alignment",
    ac: "armor_class",
    init: "initiative",
    hp: "hit_points",
    ab: "ability_scores",
    sv: "saving_throws",
    cr: "challenge",
    pb: "proficiency_bonus",
  } as const satisfies Record<string, CandidateEssentialFactKind>;
  for (let index = 0; index < rawFacts.length; index += 1) {
    const parsed = CandidateEssentialFactSchema.safeParse(rawFacts[index]);
    if (!parsed.success) {
      issues.push({
        candidateIndex: null,
        message: "An essential-fact verification span failed validation and was rejected independently.",
        details: { factIndex: index, validation: validationMessage(parsed.error) },
      });
      continue;
    }
    const startCandidate = parseCandidateId(parsed.data.s);
    const endCandidate = parseCandidateId(parsed.data.e);
    if (
      startCandidate === null ||
      endCandidate === null ||
      startCandidate < 0 ||
      endCandidate < startCandidate ||
      endCandidate >= expectedCandidateCount
    ) {
      issues.push({
        candidateIndex: startCandidate,
        message:
          "An essential-fact verification span referenced an ID outside the supplied candidate lattice and was rejected independently.",
        details: { factIndex: index, startId: parsed.data.s, endId: parsed.data.e, expectedCandidateCount },
      });
      continue;
    }
    const kind = essentialKindByCode[parsed.data.k];
    if (seenKinds.has(kind)) {
      issues.push({
        candidateIndex: startCandidate,
        message:
          "A duplicate essential-fact verification kind was omitted; verification keeps at most one grounded claim per card fact.",
        details: { factIndex: index, kind },
      });
      continue;
    }
    seenKinds.add(kind);
    essentialFacts.push({ kind, startCandidate, endCandidate });
  }
  return { essentialFacts, abilityLabels: [], issues };
}

export function parseCandidateEssentialFactsResponse(
  value: unknown,
  expectedCandidateCount: number,
): ParsedCandidateEssentialFactsResponse {
  const envelope = CandidateEssentialFactsEnvelopeSchema.safeParse(value);
  if (!envelope.success)
    return {
      essentialFacts: [],
      abilityLabels: [],
      issues: [
        {
          candidateIndex: null,
          message: "The model response does not have the required essential-fact verification envelope.",
          details: { validation: validationMessage(envelope.error) },
        },
      ],
    };
  const parsedFacts = parseCandidateEssentialFacts(envelope.data.essentialFacts, expectedCandidateCount);
  const abilityLabels: CandidateAbilityLabel[] = [];
  const seenAbilities = new Set<AbilityKey>();
  for (const raw of envelope.data.abilityLabels ?? []) {
    const parsed = CandidateAbilityLabelSchema.safeParse(raw);
    if (!parsed.success) continue;
    const normalized = "ability" in parsed.data ? parsed.data : { ability: parsed.data.a, labelQuote: parsed.data.q };
    if (seenAbilities.has(normalized.ability)) continue;
    seenAbilities.add(normalized.ability);
    abilityLabels.push(normalized);
  }
  return { ...parsedFacts, abilityLabels };
}

function candidateRunFromModelBlock(
  data: z.infer<typeof CandidateSpanSchema>,
  startCandidate: number,
  endCandidate: number,
  issues: ModelResponseIssue[],
  blockIndex: number,
): CandidateRun {
  if (data.k === "n") return { classification: "name", startCandidate, endCandidate, field: null };
  if (data.k === "sta") return { classification: "size_type_alignment", startCandidate, endCandidate, field: null };
  if (data.k === "h") {
    if (data.v !== undefined)
      issues.push({
        candidateIndex: startCandidate,
        message: "A header span included an irrelevant section qualifier; it was ignored.",
        details: { blockIndex, sectionCode: data.v },
      });
    return {
      classification: "header_field",
      startCandidate,
      endCandidate,
      field: data.f === undefined || data.f === "none" ? null : CANDIDATE_HEADER_FIELD_CODE_MAP[data.f],
    };
  }
  if (data.k === "sh") {
    if (data.v === undefined) {
      issues.push({
        candidateIndex: startCandidate,
        message:
          "A section-heading span omitted its section code; heading identity was preserved without inventing section semantics.",
        details: { blockIndex },
      });
      return { classification: "unknown_section_heading", startCandidate, endCandidate, field: null };
    }
    return { classification: CANDIDATE_SECTION_CODE_MAP[data.v], startCandidate, endCandidate, field: null };
  }
  const classificationByCode: Record<
    Exclude<CandidateModelRunCode, "n" | "sta" | "h" | "sh">,
    CandidateRunClassification
  > = {
    u: "unclassified",
    m: "body_metadata",
    r: "section_rules",
    f: "feature",
    sc: "section_content",
    sup: "supplementary",
  };
  return {
    classification: classificationByCode[data.k as keyof typeof classificationByCode],
    startCandidate,
    endCandidate,
    field: null,
  };
}

export function parseCandidateModelResponse(
  value: unknown,
  expectedCandidateCount: number,
): ParsedCandidateModelResponse {
  const envelope = CandidateResponseEnvelopeSchema.safeParse(value);
  if (!envelope.success)
    return {
      runs: [],
      debugRuns: [],
      abilityLabels: [],
      savingThrows: [],
      essentialFacts: [],
      returnedCandidateCount: 0,
      issues: [
        {
          candidateIndex: null,
          message: "The model response does not have the required sparse candidate-span envelope.",
          details: { validation: validationMessage(envelope.error) },
        },
      ],
    };
  const issues: ModelResponseIssue[] = [];
  const runs: CandidateRun[] = [];
  const debugRuns: CandidateRun[] = [];
  for (let index = 0; index < envelope.data.blocks.length; index += 1) {
    const parsed = CandidateSpanSchema.safeParse(envelope.data.blocks[index]);
    if (!parsed.success) {
      issues.push({
        candidateIndex: null,
        message: "A candidate span failed validation and was rejected independently.",
        details: { blockIndex: index, validation: validationMessage(parsed.error) },
      });
      continue;
    }
    const startCandidate = parseCandidateId(parsed.data.s);
    const endCandidate = parseCandidateId(parsed.data.e);
    if (
      startCandidate === null ||
      endCandidate === null ||
      startCandidate < 0 ||
      endCandidate < 0 ||
      startCandidate >= expectedCandidateCount ||
      endCandidate >= expectedCandidateCount
    ) {
      issues.push({
        candidateIndex: startCandidate,
        message:
          "A candidate span referenced an ID outside the supplied candidate lattice and was rejected independently.",
        details: { blockIndex: index, startId: parsed.data.s, endId: parsed.data.e, expectedCandidateCount },
      });
      continue;
    }
    if (endCandidate < startCandidate) {
      issues.push({
        candidateIndex: startCandidate,
        message: "A candidate span ended before it started and was rejected independently.",
        details: { blockIndex: index, startId: parsed.data.s, endId: parsed.data.e },
      });
      continue;
    }
    const run = candidateRunFromModelBlock(parsed.data, startCandidate, endCandidate, issues, index);
    debugRuns.push(run);
    runs.push(run);
  }
  runs.sort((a, b) => a.startCandidate - b.startCandidate || a.endCandidate - b.endCandidate);

  const abilityLabels: CandidateAbilityLabel[] = [];
  for (const raw of envelope.data.abilityLabels) {
    const parsed = CandidateAbilityLabelSchema.safeParse(raw);
    if (!parsed.success) continue;
    abilityLabels.push("ability" in parsed.data ? parsed.data : { ability: parsed.data.a, labelQuote: parsed.data.q });
  }
  const savingThrows: CandidateSavingThrow[] = [];
  for (const raw of envelope.data.savingThrows) {
    const parsed = CandidateSavingThrowSchema.safeParse(raw);
    if (parsed.success) savingThrows.push(parsed.data);
  }
  const essentialFacts: CandidateEssentialFact[] = [];
  const essentialKindByCode = {
    n: "name",
    sta: "size_type_alignment",
    ac: "armor_class",
    init: "initiative",
    hp: "hit_points",
    ab: "ability_scores",
    sv: "saving_throws",
    cr: "challenge",
    pb: "proficiency_bonus",
  } as const satisfies Record<string, CandidateEssentialFactKind>;
  for (const raw of envelope.data.essentialFacts) {
    const parsed = CandidateEssentialFactSchema.safeParse(raw);
    if (!parsed.success) continue;
    const startCandidate = parseCandidateId(parsed.data.s);
    const endCandidate = parseCandidateId(parsed.data.e);
    if (
      startCandidate === null ||
      endCandidate === null ||
      startCandidate < 0 ||
      endCandidate < startCandidate ||
      endCandidate >= expectedCandidateCount
    )
      continue;
    essentialFacts.push({ kind: essentialKindByCode[parsed.data.k], startCandidate, endCandidate });
  }
  return { runs, debugRuns, abilityLabels, savingThrows, essentialFacts, returnedCandidateCount: runs.length, issues };
}
