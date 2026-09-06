import type { ModelRunSummary, ParseIssue } from "./domain.js";
import { compileLosslessDocument } from "./annotationCompiler.js";
import { enrichStructuredHeader } from "./headerFacts.js";
import {
  candidateHeaderFacts,
  candidateResponseToDirectResponse,
  type CandidateTransportDebug,
} from "./candidateTransport.js";
import { createMultilineOwnershipPlan } from "./multilineDeterministic.js";
import type { SourceCandidate } from "./candidateTypes.js";
import type { SourceOwnershipMap } from "./sourceOwnership.js";
import type { CandidateAbilityLabel, CandidateEssentialFact, ParsedCandidateModelResponse } from "./modelSchema.js";
import type { DeterministicHint } from "./deterministicHints.js";
import type { ParserRoutingDecision } from "./parserRouting.js";
import type { StructuredModelRequest } from "./modelProvider.js";
import type {
  AnalyzeStatblockInput,
  AnalyzeStatblockResult,
  EssentialFactsVerificationDiagnostics,
} from "./pipelineTypes.js";

export type MultilineBodyContext = {
  input: AnalyzeStatblockInput;
  analyzeStartedAt: number;
  sourceCandidates: SourceCandidate[];
  acceptedHeaderOwnership: SourceOwnershipMap;
  initialRouting: ParserRoutingDecision;
  emptyParsed: ParsedCandidateModelResponse;
  verificationAbilityLabels: CandidateAbilityLabel[];
  verificationFacts: CandidateEssentialFact[];
  essentialVerification: EssentialFactsVerificationDiagnostics;
  verificationPipelineIssues: ParseIssue[];
  verificationRaw: string | null;
  verificationRequest: StructuredModelRequest | null;
  deterministicHints: DeterministicHint[];
  essentialVerificationModelCallSeconds: number;
  responseParsingSeconds: number;
};

export async function analyzeMultilineBody(context: MultilineBodyContext): Promise<AnalyzeStatblockResult> {
  const {
    input,
    analyzeStartedAt,
    sourceCandidates,
    acceptedHeaderOwnership,
    initialRouting,
    emptyParsed,
    verificationAbilityLabels,
    verificationFacts,
    essentialVerification,
    verificationPipelineIssues,
    verificationRaw,
    verificationRequest,
    deterministicHints,
    essentialVerificationModelCallSeconds,
    responseParsingSeconds,
  } = context;
  const multilinePlan = createMultilineOwnershipPlan(input.rawSource, sourceCandidates, acceptedHeaderOwnership);
  initialRouting.signals.push({
    code: "multiline_header_ownership_complement",
    weight: 0,
    detail: `Validated Header rows: ${multilinePlan.headerRuns.length}; deterministic BODY rows: ${multilinePlan.bodyRuns.length}; ${multilinePlan.signals.join(", ")}.`,
  });
  const parsed = {
    ...emptyParsed,
    runs: [...multilinePlan.headerRuns, ...multilinePlan.bodyRuns].sort(
      (a, b) => a.startCandidate - b.startCandidate || a.endCandidate - b.endCandidate,
    ),
    debugRuns: [...multilinePlan.headerRuns, ...multilinePlan.bodyRuns].sort(
      (a, b) => a.startCandidate - b.startCandidate || a.endCandidate - b.endCandidate,
    ),
    abilityLabels: verificationAbilityLabels,
    essentialFacts: verificationFacts,
    returnedCandidateCount: multilinePlan.headerRuns.length + multilinePlan.bodyRuns.length,
  };

  const anchoringStartedAt = performance.now();
  const transported = candidateResponseToDirectResponse(input.rawSource, input.sourceMap, sourceCandidates, parsed, {
    enforceSourceProvenFeatureBoundaries: false,
    preserveUnknownSectionStructure: true,
  });
  const quoteAnchoringSeconds = (performance.now() - anchoringStartedAt) / 1000;

  const model: ModelRunSummary = {
    model: input.model,
    attempted: essentialVerification.status !== "not_run",
    succeeded: essentialVerification.status === "completed",
    elapsedSeconds: essentialVerification.elapsedSeconds,
    requestCount: essentialVerification.status === "not_run" ? 0 : 1,
    succeededRequestCount: essentialVerification.status === "completed" ? 1 : 0,
    partialRequestCount: essentialVerification.status === "invalid" ? 1 : 0,
    failedRequestCount: essentialVerification.status === "failed" ? 1 : 0,
    returnedCandidateCount: parsed.returnedCandidateCount,
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
    initialIssues: [...verificationPipelineIssues, ...transported.issues],
    model,
  });
  const documentCompilationSeconds = (performance.now() - compileStartedAt) / 1000;

  const headerEnrichmentStartedAt = performance.now();
  const headerFacts = candidateHeaderFacts(document, parsed, sourceCandidates);
  const enrichedDocument = enrichStructuredHeader(document, headerFacts, { essentialOnly: true });
  const headerEnrichmentSeconds = (performance.now() - headerEnrichmentStartedAt) / 1000;

  const candidateDebug: CandidateTransportDebug = {
    ...transported.debug,
    runs: transported.debug.runs.map((run) => {
      const expectedStart = sourceCandidates[run.startCandidate]?.start;
      const annotationsAtStart =
        expectedStart === undefined
          ? []
          : enrichedDocument.annotations.filter((annotation) => annotation.source.start === expectedStart);
      const annotation = annotationsAtStart[0];
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
      status: "not_run",
      modelRequest: null,
      rawModelContent: null,
      elapsedSeconds: null,
      performance: null,
      issues: [],
    },
    deterministicHints,
    parserRouting: initialRouting,
    timing: {
      totalSeconds: (performance.now() - analyzeStartedAt) / 1000,
      modelCallSeconds: essentialVerificationModelCallSeconds,
      structuralModelCallSeconds: 0,
      essentialVerificationModelCallSeconds,
      responseParsingSeconds,
      quoteAnchoringSeconds,
      documentCompilationSeconds,
      headerEnrichmentSeconds,
      ollama: null,
      essentialVerificationOllama: essentialVerification.performance,
    },
  };
}
