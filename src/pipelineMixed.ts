import type { ModelRunSummary, ParseIssue } from "./domain.js";
import { compileLosslessDocument } from "./annotationCompiler.js";
import { applyCallerCompletionLimit, bodyStartsCompletionBudget } from "./bodyCompletionBudget.js";
import { enrichStructuredHeader } from "./headerFacts.js";
import {
  createMixedBodyBoundaryGenerationJsonSchema,
  parseCandidateModelResponse,
  parseMixedBodyBoundaryResponse,
  type ParsedCandidateModelResponse,
} from "./modelSchema.js";
import {
  candidateHeaderFacts,
  candidateResponseToDirectResponse,
  type CandidateTransportDebug,
} from "./candidateTransport.js";
import { prepareCandidateLattice } from "./candidateLattice.js";
import {
  hardInterleavedMixedMetadataContinuationIndexes,
  strengthenInterleavedMixedMetadataEvidence,
} from "./mixedMetadataEvidence.js";
import { createMixedNormalizationHints, mixedNormalizationHints } from "./deterministicHints.js";
import { MIXED_OWNERSHIP_BODY_SYSTEM_PROMPT, createMixedOwnershipBodyUserPrompt } from "./prompt.js";
import { createMixedMultilineNormalizationPlan } from "./multilineDeterministic.js";
import {
  StructuredModelInvalidJsonError,
  type ModelPerformanceMetrics,
  type StructuredModelRequest,
  type StructureModelCaller,
} from "./modelProvider.js";
import type { SourceOwnershipMap } from "./sourceOwnership.js";
import type { SourceCandidate } from "./candidateTypes.js";
import type { ParserRoutingDecision } from "./parserRouting.js";
import type {
  AnalyzeStatblockInput,
  AnalyzeStatblockResult,
  BodyStructureDiagnostics,
  EssentialFactsVerificationDiagnostics,
} from "./pipelineTypes.js";
import { physicalBodyFallbackStarts, responseIssue } from "./pipelineSupport.js";

export type MixedBodyContext = {
  input: AnalyzeStatblockInput;
  analyzeStartedAt: number;
  sourceCandidates: SourceCandidate[];
  acceptedHeaderOwnership: SourceOwnershipMap;
  caller: StructureModelCaller;
  initialRouting: ParserRoutingDecision;
  verifierParsed: ParsedCandidateModelResponse;
  essentialVerification: EssentialFactsVerificationDiagnostics;
  verificationPipelineIssues: ParseIssue[];
  verificationRaw: string | null;
  verificationRequest: StructuredModelRequest | null;
  essentialVerificationModelCallSeconds: number;
  responseParsingSeconds: number;
};

export async function analyzeMixedBody(context: MixedBodyContext): Promise<AnalyzeStatblockResult> {
  const {
    input,
    analyzeStartedAt,
    sourceCandidates,
    acceptedHeaderOwnership,
    caller,
    initialRouting,
    verifierParsed,
    essentialVerification,
    verificationPipelineIssues,
    verificationRaw,
    verificationRequest,
    essentialVerificationModelCallSeconds,
  } = context;
  let { responseParsingSeconds } = context;
  // Mixed ownership-first path: the Header verifier above is the only Header
  // semantic authority. The second and only BODY model receives the exact BODY
  // complement and restores only the logical multiline geometry. It assigns no
  // BODY semantic role; the shared deterministic multiline classifier runs next.
  const preparedMixedLattice = prepareCandidateLattice(input.rawSource, input.sourceMap, "generic");
  const ownershipAwareMixedCandidates = strengthenInterleavedMixedMetadataEvidence(
    input.rawSource,
    preparedMixedLattice.candidates,
    acceptedHeaderOwnership,
  );
  const mixedCandidates = ownershipAwareMixedCandidates.map((candidate, index, all) => ({
    ...candidate,
    id: `candidate-${index}`,
    preview: input.rawSource.slice(candidate.start, all[index + 1]?.start ?? input.rawSource.length),
  }));
  const hardMetadataContinuationSet = new Set(
    hardInterleavedMixedMetadataContinuationIndexes(input.rawSource, mixedCandidates, acceptedHeaderOwnership),
  );
  const allMixedHints = createMixedNormalizationHints(input.rawSource, mixedCandidates);
  const candidateIntersectsHeader = (index: number): boolean => {
    const start = mixedCandidates[index]?.start;
    if (start === undefined) return false;
    const end = mixedCandidates[index + 1]?.start ?? input.rawSource.length;
    return acceptedHeaderOwnership.ranges.some((range) => range.start < end && start < range.end);
  };
  const forbiddenCandidateIndexes = mixedCandidates.map((_, index) => index).filter(candidateIntersectsHeader);
  const forbiddenSet = new Set(forbiddenCandidateIndexes);
  // BODY hints must never imply continuity through already accepted Header
  // ownership. A cross-ownership hint is not merely unhelpful: for a small
  // model it creates a direct contradiction with the BODY-only task.
  const mixedHints = allMixedHints.filter((hint) => hint.candidates.every((index) => !forbiddenSet.has(index)));
  const allowedBodyCandidateIndexes = mixedCandidates
    .map((_, index) => index)
    .filter((index) => !forbiddenSet.has(index));
  // The recovered mixed transport exposes exact Cxxx addresses to the model.
  // Budget against that exact maximal legal payload, not the old numeric 175 form.
  const allowedBodyCandidateIds = allowedBodyCandidateIndexes.map((index) => `C${String(index).padStart(3, "0")}`);
  const bodyCompletionBudget = applyCallerCompletionLimit(
    bodyStartsCompletionBudget(allowedBodyCandidateIds),
    input.numPredict,
  );

  const bodyRequest: StructuredModelRequest = {
    model: input.model,
    task: "body",
    systemPrompt: MIXED_OWNERSHIP_BODY_SYSTEM_PROMPT,
    userPrompt: createMixedOwnershipBodyUserPrompt(
      input.rawSource,
      mixedCandidates,
      mixedNormalizationHints(mixedHints),
      forbiddenCandidateIndexes,
    ),
    jsonSchema: createMixedBodyBoundaryGenerationJsonSchema(mixedCandidates.length, allowedBodyCandidateIndexes),
    temperature: 0,
    seed: 42,
    numCtx: input.numCtx ?? 16384,
    // Parser-level budget follows the finite starts-only envelope. Any remote
    // service cap is applied by the provider adapter and does not constrain Ollama.
    numPredict: bodyCompletionBudget,
    timeoutMs: input.timeoutMs ?? 300000,
  };

  let bodyRaw: string | null = null;
  let bodyElapsed: number | null = null;
  let bodyPerformance: ModelPerformanceMetrics | null = null;
  let bodyStatus: BodyStructureDiagnostics["status"] = "not_run";
  let bodyIssues: Array<{ candidateIndex: number | null; message: string; details: Record<string, unknown> }> = [];
  let bodyParsed = parseCandidateModelResponse({ blocks: [] }, mixedCandidates.length);
  const bodyStartedAt = performance.now();
  input.onProgress?.("parser mode mixed; ownership-complement BODY request");
  try {
    const bodyResult = await caller(bodyRequest);
    bodyRaw = bodyResult.rawContent;
    bodyElapsed = bodyResult.elapsedSeconds;
    bodyPerformance = bodyResult.performance ?? null;
    const parseStartedAt = performance.now();
    const parsedBoundaries = parseMixedBodyBoundaryResponse(
      bodyResult.parsedContent,
      mixedCandidates.length,
      allowedBodyCandidateIndexes,
    );
    // Source-proven physical geometry wins over model ambiguity for one narrow
    // case: a compact standalone heading-shaped physical row and the following
    // physical row are necessarily two printed lines. ALL-CAPS/title-case rows
    // keep their established path; a contextual shape-only safeguard also covers
    // one-word and sentence-case standalone rows immediately introducing a peer-
    // rule region. The model still restores every other mixed boundary.
    const hardGeometryStarts = new Set<number>();
    for (const hint of mixedHints) {
      if (
        hint.kind !== "all_caps_standalone" &&
        hint.kind !== "standalone_heading_row" &&
        hint.kind !== "contextual_standalone_heading_row"
      )
        continue;
      const headingIndex = hint.candidates[0];
      if (headingIndex === undefined || forbiddenSet.has(headingIndex)) continue;
      hardGeometryStarts.add(headingIndex);
      for (let next = headingIndex + 1; next < mixedCandidates.length; next += 1) {
        if (forbiddenSet.has(next)) break;
        const candidate = mixedCandidates[next];
        if (candidate?.reasons.includes("line_start") || candidate?.reasons.includes("paragraph_start")) {
          hardGeometryStarts.add(next);
          break;
        }
      }
    }
    const invalidEnvelope = parsedBoundaries.issues.some((currentIssue) => /envelope/u.test(currentIssue.message));
    const fallbackStarts = invalidEnvelope
      ? physicalBodyFallbackStarts(mixedCandidates, allowedBodyCandidateIndexes)
      : [];
    const vetoedMetadataContinuationStarts = parsedBoundaries.starts.filter((index) =>
      hardMetadataContinuationSet.has(index),
    );
    const normalizedStarts = [...new Set([...parsedBoundaries.starts, ...hardGeometryStarts, ...fallbackStarts])]
      .filter((index) => !hardMetadataContinuationSet.has(index))
      .sort((a, b) => a - b);
    const normalizedBody = createMixedMultilineNormalizationPlan(
      input.rawSource,
      mixedCandidates,
      allowedBodyCandidateIndexes,
      normalizedStarts,
    );
    bodyParsed = {
      ...parseCandidateModelResponse({ blocks: [] }, mixedCandidates.length),
      runs: normalizedBody.bodyRuns,
      debugRuns: normalizedBody.bodyRuns.map((run) => ({ ...run })),
      returnedCandidateCount: parsedBoundaries.returnedCandidateCount,
      issues: [...parsedBoundaries.issues],
    };
    initialRouting.signals.push({
      code: "mixed_body_multiline_normalized",
      weight: 0,
      detail: normalizedBody.signals.join(", "),
    });
    responseParsingSeconds += (performance.now() - parseStartedAt) / 1000;
    bodyStatus = invalidEnvelope ? "invalid" : "completed";
    bodyIssues = bodyParsed.issues.map((currentIssue) => ({ ...currentIssue }));
    if (vetoedMetadataContinuationStarts.length > 0) {
      initialRouting.signals.push({
        code: "mixed_body_metadata_separator_continuation_veto",
        weight: 0,
        detail: `Ignored ${vetoedMetadataContinuationStarts.length} model start(s) on comma/semicolon-wrapped physical rows inside an ownership-proven Header metadata corridor.`,
      });
    }
    if (invalidEnvelope && fallbackStarts.length > 0) {
      bodyIssues.push({
        candidateIndex: null,
        message:
          "The mixed BODY response envelope was invalid; source-proven physical rows were used as a deterministic multiline fallback.",
        details: { fallbackStartCount: fallbackStarts.length },
      });
      initialRouting.signals.push({
        code: "mixed_body_physical_fallback",
        weight: 0,
        detail: `Invalid BODY envelope; used ${fallbackStarts.length} source-proven physical row starts.`,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof StructuredModelInvalidJsonError) {
      bodyRaw = error.rawContent;
      bodyElapsed = error.elapsedSeconds;
    }
    bodyStatus = "failed";
    const allowedBodyCandidateIndexes = mixedCandidates
      .map((_, index) => index)
      .filter((index) => !forbiddenSet.has(index));
    const fallbackStarts = physicalBodyFallbackStarts(mixedCandidates, allowedBodyCandidateIndexes);
    const fallbackBody = createMixedMultilineNormalizationPlan(
      input.rawSource,
      mixedCandidates,
      allowedBodyCandidateIndexes,
      fallbackStarts,
    );
    bodyIssues = [
      {
        candidateIndex: null,
        message:
          "The mixed BODY model call failed; source-proven physical rows were used as a deterministic multiline fallback and exact source was preserved.",
        details: { error: message, fallbackStartCount: fallbackStarts.length },
      },
    ];
    bodyParsed = {
      ...parseCandidateModelResponse({ blocks: [] }, mixedCandidates.length),
      runs: fallbackBody.bodyRuns,
      debugRuns: fallbackBody.bodyRuns.map((run) => ({ ...run })),
      returnedCandidateCount: fallbackStarts.length,
      issues: [],
    };
    initialRouting.signals.push({
      code: "mixed_body_physical_fallback",
      weight: 0,
      detail: `BODY model failed; used ${fallbackStarts.length} source-proven physical row starts.`,
    });
  }
  const mixedStructuralSeconds = (performance.now() - bodyStartedAt) / 1000;

  initialRouting.signals.push({
    code: "mixed_header_ownership_complement",
    weight: 0,
    detail: `Accepted Header ownership ranges: ${acceptedHeaderOwnership.ranges.length}; forbidden mixed candidates: ${forbiddenCandidateIndexes.length}; normalized multiline BODY runs: ${bodyParsed.runs.length}. No bodyStart or source suffix was used.`,
  });

  const anchoringStartedAt = performance.now();
  const transported = candidateResponseToDirectResponse(input.rawSource, input.sourceMap, mixedCandidates, bodyParsed, {
    // The LLM supplied only virtual multiline geometry. Semantic BODY roles
    // were produced by the same deterministic classifier used by multiline mode.
    enforceSourceProvenFeatureBoundaries: false,
    preserveUnknownSectionStructure: true,
    // Exact fixed-Header ownership is a hard barrier for every downstream
    // deterministic repair, not only for the raw model response.
    protectedCandidateIndexes: forbiddenCandidateIndexes,
  });
  const quoteAnchoringSeconds = (performance.now() - anchoringStartedAt) / 1000;

  const model: ModelRunSummary = {
    model: input.model,
    attempted: true,
    succeeded: essentialVerification.status === "completed" && bodyStatus === "completed",
    elapsedSeconds: (essentialVerification.elapsedSeconds ?? 0) + (bodyElapsed ?? 0),
    requestCount: 2,
    succeededRequestCount:
      (essentialVerification.status === "completed" ? 1 : 0) + (bodyStatus === "completed" ? 1 : 0),
    partialRequestCount: (essentialVerification.status === "invalid" ? 1 : 0) + (bodyStatus === "invalid" ? 1 : 0),
    failedRequestCount: (essentialVerification.status === "failed" ? 1 : 0) + (bodyStatus === "failed" ? 1 : 0),
    returnedCandidateCount: bodyParsed.returnedCandidateCount,
    suppressedDuplicateCandidateCount: 0,
    acceptedAnnotationCount: 0,
    acceptedModelAnnotationCount: 0,
    deterministicAnnotationCount: 0,
    rejectedCandidateCount: 0,
  };

  const compileStartedAt = performance.now();
  const document = compileLosslessDocument({
    rawSource: input.rawSource,
    sourceMap: input.sourceMap,
    candidates: transported.response.candidates,
    preserveStructuralOwnership: true,
    initialIssues: [...verificationPipelineIssues, ...bodyIssues.map(responseIssue), ...transported.issues],
    model,
  });
  const documentCompilationSeconds = (performance.now() - compileStartedAt) / 1000;

  const headerEnrichmentStartedAt = performance.now();
  const headerFacts = candidateHeaderFacts(document, verifierParsed, sourceCandidates);
  const enrichedDocument = enrichStructuredHeader(document, headerFacts, { essentialOnly: true });
  const headerEnrichmentSeconds = (performance.now() - headerEnrichmentStartedAt) / 1000;

  const candidateDebug: CandidateTransportDebug = {
    ...transported.debug,
    runs: transported.debug.runs.map((run) => {
      const expectedStart = mixedCandidates[run.startCandidate]?.start;
      const annotation =
        expectedStart === undefined
          ? undefined
          : enrichedDocument.annotations.find((current) => current.source.start === expectedStart);
      return {
        ...run,
        accepted: annotation !== undefined,
        acceptedRole: annotation?.role ?? null,
        acceptedField: annotation?.field ?? null,
        acceptedSection: annotation?.section ?? null,
      };
    }),
  };

  return {
    rawModelContent: verificationRaw,
    modelRequest: verificationRequest,
    document: enrichedDocument,
    candidateDebug,
    essentialVerification,
    bodyStructure: {
      status: bodyStatus,
      modelRequest: bodyRequest,
      rawModelContent: bodyRaw,
      elapsedSeconds: bodyElapsed,
      performance: bodyPerformance,
      issues: bodyIssues,
    },
    deterministicHints: mixedHints,
    parserRouting: initialRouting,
    timing: {
      totalSeconds: (performance.now() - analyzeStartedAt) / 1000,
      modelCallSeconds: essentialVerificationModelCallSeconds + mixedStructuralSeconds,
      structuralModelCallSeconds: mixedStructuralSeconds,
      essentialVerificationModelCallSeconds,
      responseParsingSeconds,
      quoteAnchoringSeconds,
      documentCompilationSeconds,
      headerEnrichmentSeconds,
      ollama: bodyPerformance,
      essentialVerificationOllama: essentialVerification.performance,
    },
  };
}
