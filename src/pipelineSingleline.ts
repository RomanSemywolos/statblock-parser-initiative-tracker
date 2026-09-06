import type { ModelRunSummary, ParseIssue } from "./domain.js";
import { compileLosslessDocument } from "./annotationCompiler.js";
import { applyCallerCompletionLimit, bodyStartsCompletionBudget } from "./bodyCompletionBudget.js";
import { enrichStructuredHeader } from "./headerFacts.js";
import {
  createNumericBodyLineStartsGenerationJsonSchema,
  parseCandidateModelResponse,
  parseNumericBodyLineStartsResponse,
  type ParsedCandidateModelResponse,
} from "./modelSchema.js";
import {
  candidateHeaderFacts,
  candidateResponseToDirectResponse,
  type CandidateTransportDebug,
} from "./candidateTransport.js";
import { singlelineBodyNormalizationCandidates, type PreparedCandidateLattice } from "./candidateLattice.js";
import { createDeterministicHints, structuralHints } from "./deterministicHints.js";
import { SINGLELINE_OWNERSHIP_BODY_SYSTEM_PROMPT, createSinglelineOwnershipBodyUserPrompt } from "./prompt.js";
import { createVirtualMultilineNormalizationPlan } from "./multilineDeterministic.js";
import {
  StructuredModelInvalidJsonError,
  type ModelPerformanceMetrics,
  type StructuredModelRequest,
  type StructureModelCaller,
} from "./modelProvider.js";
import type { SourceOwnershipMap } from "./sourceOwnership.js";
import type { SourceCandidate } from "./candidateTypes.js";
import type { GroundedSinglelineHeaderCoordinates } from "./singlelineHeaderCoordinates.js";
import type { ParserRoutingDecision } from "./parserRouting.js";
import type {
  AnalyzeStatblockInput,
  AnalyzeStatblockResult,
  BodyStructureDiagnostics,
  EssentialFactsVerificationDiagnostics,
} from "./pipelineTypes.js";
import { responseIssue } from "./pipelineSupport.js";

export type SinglelineBodyContext = {
  input: AnalyzeStatblockInput;
  analyzeStartedAt: number;
  preparedHeaderLattice: PreparedCandidateLattice;
  sourceCandidates: SourceCandidate[];
  acceptedHeaderOwnership: SourceOwnershipMap;
  caller: StructureModelCaller;
  initialRouting: ParserRoutingDecision;
  verifierParsed: ParsedCandidateModelResponse;
  singlelineGroundedHeader: GroundedSinglelineHeaderCoordinates | null;
  essentialVerification: EssentialFactsVerificationDiagnostics;
  verificationPipelineIssues: ParseIssue[];
  verificationRaw: string | null;
  verificationRequest: StructuredModelRequest | null;
  essentialVerificationModelCallSeconds: number;
  responseParsingSeconds: number;
};

export async function analyzeSinglelineBody(context: SinglelineBodyContext): Promise<AnalyzeStatblockResult> {
  const {
    input,
    analyzeStartedAt,
    preparedHeaderLattice,
    sourceCandidates,
    acceptedHeaderOwnership,
    caller,
    initialRouting,
    verifierParsed,
    singlelineGroundedHeader,
    essentialVerification,
    verificationPipelineIssues,
    verificationRaw,
    verificationRequest,
    essentialVerificationModelCallSeconds,
  } = context;
  let { responseParsingSeconds } = context;
  // Collapsed BODY uses the same ownership architecture as mixed. The only
  // mode-specific pieces are the denser singleline candidate lattice and its
  // normalization prompt/evidence. LLM output is line starts only.
  const preparedSinglelineLattice = preparedHeaderLattice;
  // The prepared singleline lattice intentionally remains over-complete for the
  // fixed Header verifier. BODY normalization must not inherit candidates whose
  // only provenance is the historical dense-prefix addressability window: weak
  // models read hundreds of token coordinates as hundreds of plausible rows.
  // Keep every coordinate with independent geometry/shape provenance and drop
  // only pure dense-prefix addresses. This changes address quality, not BODY
  // semantics, and leaves the Header coordinate lattice untouched.
  const singlelineBodyLattice = singlelineBodyNormalizationCandidates(preparedSinglelineLattice);
  const singlelineCandidates = singlelineBodyLattice.map((candidate, index, all) => ({
    ...candidate,
    id: `candidate-${index}`,
    preview: input.rawSource.slice(candidate.start, all[index + 1]?.start ?? input.rawSource.length),
  }));
  const rolesByStart =
    preparedSinglelineLattice.singlelineAudit === null
      ? undefined
      : new Map(preparedSinglelineLattice.singlelineAudit.entries.map((entry) => [entry.start, entry.role] as const));
  const syntheticRolesByStart =
    preparedSinglelineLattice.singlelineStructure === null
      ? undefined
      : new Map(
          preparedSinglelineLattice.singlelineStructure.entries.map((entry) => [entry.start, entry.role] as const),
        );
  const allSinglelineHints = createDeterministicHints(input.rawSource, singlelineCandidates);
  const candidateIntersectsHeader = (index: number): boolean => {
    const start = singlelineCandidates[index]?.start;
    if (start === undefined) return false;
    const end = singlelineCandidates[index + 1]?.start ?? input.rawSource.length;
    return acceptedHeaderOwnership.ranges.some((range) => range.start < end && start < range.end);
  };
  const forbiddenCandidateIndexes = singlelineCandidates.map((_, index) => index).filter(candidateIntersectsHeader);
  const forbiddenSet = new Set(forbiddenCandidateIndexes);
  const singlelineHints = allSinglelineHints.filter((hint) =>
    hint.candidates.every((index) => !forbiddenSet.has(index)),
  );
  const allowedBodyCandidateIndexes = singlelineCandidates
    .map((_, index) => index)
    .filter((index) => !forbiddenSet.has(index));
  const bodyCompletionBudget = applyCallerCompletionLimit(
    bodyStartsCompletionBudget(allowedBodyCandidateIndexes),
    input.numPredict,
  );

  const bodyRequest: StructuredModelRequest = {
    model: input.model,
    task: "body",
    systemPrompt: SINGLELINE_OWNERSHIP_BODY_SYSTEM_PROMPT,
    userPrompt: createSinglelineOwnershipBodyUserPrompt(
      input.rawSource,
      singlelineCandidates,
      structuralHints(singlelineHints),
      forbiddenCandidateIndexes,
      rolesByStart,
      syntheticRolesByStart,
    ),
    jsonSchema: createNumericBodyLineStartsGenerationJsonSchema(
      singlelineCandidates.length,
      allowedBodyCandidateIndexes,
    ),
    temperature: 0,
    seed: 42,
    numCtx: input.numCtx ?? 16384,
    // BODY completion space is finite: at most one start per legal BODY
    // candidate. Derive the ceiling from that task instead of imposing a
    // provider-driven global cap on local/strong models.
    numPredict: bodyCompletionBudget,
    timeoutMs: input.timeoutMs ?? 300000,
  };

  let bodyRaw: string | null = null;
  let bodyElapsed: number | null = null;
  let bodyPerformance: ModelPerformanceMetrics | null = null;
  let bodyStatus: BodyStructureDiagnostics["status"] = "not_run";
  let bodyIssues: Array<{ candidateIndex: number | null; message: string; details: Record<string, unknown> }> = [];
  let bodyParsed = parseCandidateModelResponse({ blocks: [] }, singlelineCandidates.length);
  const bodyStartedAt = performance.now();
  input.onProgress?.("parser mode singleline; ownership-complement BODY multiline normalization");
  try {
    const bodyResult = await caller(bodyRequest);
    bodyRaw = bodyResult.rawContent;
    bodyElapsed = bodyResult.elapsedSeconds;
    bodyPerformance = bodyResult.performance ?? null;
    const parseStartedAt = performance.now();
    const parsedBoundaries = parseNumericBodyLineStartsResponse(
      bodyResult.parsedContent,
      singlelineCandidates.length,
      allowedBodyCandidateIndexes,
      "singleline BODY multiline-normalization",
    );
    const normalizedBody = createVirtualMultilineNormalizationPlan(
      input.rawSource,
      singlelineCandidates,
      allowedBodyCandidateIndexes,
      parsedBoundaries.starts,
    );
    bodyParsed = {
      ...parseCandidateModelResponse({ blocks: [] }, singlelineCandidates.length),
      runs: normalizedBody.bodyRuns,
      debugRuns: normalizedBody.bodyRuns.map((run) => ({ ...run })),
      returnedCandidateCount: parsedBoundaries.returnedCandidateCount,
      issues: [...parsedBoundaries.issues],
    };
    initialRouting.signals.push({
      code: "singleline_body_multiline_normalized",
      weight: 0,
      detail: normalizedBody.signals.join(", "),
    });
    responseParsingSeconds += (performance.now() - parseStartedAt) / 1000;
    const invalidEnvelope = parsedBoundaries.issues.some((currentIssue) => /envelope/u.test(currentIssue.message));
    bodyStatus = invalidEnvelope ? "invalid" : "completed";
    bodyIssues = bodyParsed.issues.map((currentIssue) => ({ ...currentIssue }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof StructuredModelInvalidJsonError) {
      bodyRaw = error.rawContent;
      bodyElapsed = error.elapsedSeconds;
    }
    bodyStatus = "failed";
    bodyIssues = [
      {
        candidateIndex: null,
        message:
          "The singleline BODY normalization call failed; accepted Header facts were kept and the exact remainder source stays unclassified.",
        details: { error: message },
      },
    ];
    bodyParsed = parseCandidateModelResponse({ blocks: [] }, singlelineCandidates.length);
  }
  const structuralSeconds = (performance.now() - bodyStartedAt) / 1000;

  initialRouting.signals.push({
    code: "singleline_header_ownership_complement",
    weight: 0,
    detail: `Accepted Header ownership ranges: ${acceptedHeaderOwnership.ranges.length}; singleline BODY coordinates: ${singlelineCandidates.length} after removing pure dense-prefix addresses; forbidden singleline candidates: ${forbiddenCandidateIndexes.length}; normalized multiline BODY runs: ${bodyParsed.runs.length}. No bodyStart, semantic BODY classification, or second BODY call was used.`,
  });

  const anchoringStartedAt = performance.now();
  const transported = candidateResponseToDirectResponse(
    input.rawSource,
    input.sourceMap,
    singlelineCandidates,
    bodyParsed,
    {
      enforceSourceProvenFeatureBoundaries: false,
      preserveUnknownSectionStructure: true,
      protectedCandidateIndexes: forbiddenCandidateIndexes,
    },
  );
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
  const headerFacts =
    singlelineGroundedHeader?.modelFacts ?? candidateHeaderFacts(document, verifierParsed, sourceCandidates);
  const enrichedDocument = enrichStructuredHeader(document, headerFacts, { essentialOnly: true });
  const headerEnrichmentSeconds = (performance.now() - headerEnrichmentStartedAt) / 1000;

  const candidateDebug: CandidateTransportDebug = {
    ...transported.debug,
    runs: transported.debug.runs.map((run) => {
      const expectedStart = singlelineCandidates[run.startCandidate]?.start;
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
    deterministicHints: singlelineHints,
    parserRouting: initialRouting,
    timing: {
      totalSeconds: (performance.now() - analyzeStartedAt) / 1000,
      modelCallSeconds: essentialVerificationModelCallSeconds + structuralSeconds,
      structuralModelCallSeconds: structuralSeconds,
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
