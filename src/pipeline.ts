import type { ParseIssue } from "./domain.js";

import { compileLosslessDocument } from "./annotationCompiler.js";
import { enrichStructuredHeader } from "./headerFacts.js";
import { measureHeaderPromptRequest } from "./headerPromptMetrics.js";
import {
  createEssentialFactsGenerationJsonSchema,
  createSinglelineHeaderCoordinatesGenerationJsonSchema,
  parseCandidateEssentialFactsResponse,
  parseSinglelineHeaderCoordinatesResponse,
  parseCandidateModelResponse,
} from "./modelSchema.js";
import { candidateHeaderFacts } from "./candidateTransport.js";
import { prepareCandidateLattice } from "./candidateLattice.js";
import { createDeterministicHints, verificationHints } from "./deterministicHints.js";
import {
  ESSENTIAL_FACTS_SYSTEM_PROMPT,
  SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT,
  createEssentialFactsUserPrompt,
  createSinglelineEssentialFactsUserPrompt,
} from "./prompt.js";
import {
  groundSinglelineHeaderCoordinates,
  type GroundedSinglelineHeaderCoordinates,
} from "./singlelineHeaderCoordinates.js";
import { detectParserStructure } from "./parserRouting.js";
import { resolveAcceptedHeaderOwnership } from "./sourceOwnership.js";
import {
  StructuredModelInvalidJsonError,
  type ModelPerformanceMetrics,
  type StructuredModelRequest,
} from "./modelProvider.js";

export type { StructureModelCaller } from "./modelProvider.js";

import type {
  AnalyzeStatblockInput,
  AnalyzeStatblockResult,
  EssentialFactsVerificationDiagnostics,
} from "./pipelineTypes.js";
import { analyzeMultilineBody } from "./pipelineMultiline.js";
import { analyzeSinglelineBody } from "./pipelineSingleline.js";
import { analyzeMixedBody } from "./pipelineMixed.js";

export type {
  AnalyzeStatblockInput,
  AnalyzeStatblockResult,
  AnalyzeTimingReport,
  BodyStructureDiagnostics,
  EssentialFactsVerificationDiagnostics,
  ShadowHeaderComparisonDiagnostics,
} from "./pipelineTypes.js";

import {
  emptyModelSummary,
  pipelineIssue,
  resolveAbilityLabelCoordinateQuote,
  responseIssue,
} from "./pipelineSupport.js";

export async function analyzeStatblock(input: AnalyzeStatblockInput): Promise<AnalyzeStatblockResult> {
  const analyzeStartedAt = performance.now();
  const hasContent = input.sourceMap.units.some((unit) => unit.kind === "content");

  if (!hasContent) {
    const compileStartedAt = performance.now();
    const document = compileLosslessDocument({
      rawSource: input.rawSource,
      sourceMap: input.sourceMap,
      candidates: [],
      model: emptyModelSummary(input.model, false),
    });
    const documentCompilationSeconds = (performance.now() - compileStartedAt) / 1000;

    const parserRouting = detectParserStructure(input.rawSource, input.parserMode ?? "auto");
    return {
      rawModelContent: null,
      modelRequest: null,
      document,
      candidateDebug: null,
      essentialVerification: null,
      deterministicHints: [],
      parserRouting,
      timing: {
        totalSeconds: (performance.now() - analyzeStartedAt) / 1000,
        modelCallSeconds: 0,
        structuralModelCallSeconds: 0,
        essentialVerificationModelCallSeconds: 0,
        responseParsingSeconds: 0,
        quoteAnchoringSeconds: 0,
        documentCompilationSeconds,
        headerEnrichmentSeconds: 0,
        ollama: null,
      },
    };
  }

  // Canonical ownership-first parser architecture.
  //
  // Singleline uses one flat coordinate lattice for Header addressability. The
  // model returns only coordinate indexes; candidate evidence/classes are not
  // transported to the Header call. Mixed/multiline keep their established
  // coordinate locator contract.
  const initialRouting = detectParserStructure(input.rawSource, input.parserMode ?? "auto");
  const preparedHeaderLattice =
    initialRouting.selectedMode === "singleline"
      ? prepareCandidateLattice(input.rawSource, input.sourceMap, "singleline")
      : prepareCandidateLattice(input.rawSource, input.sourceMap, "generic");
  let deterministicHints = createDeterministicHints(input.rawSource, preparedHeaderLattice.candidates);
  const caller = input.callModel;
  if (caller === undefined) {
    throw new Error("A StructureModelCaller is required for non-empty statblocks.");
  }

  // Canonical ownership-first parser architecture.
  //
  // All modes share the same closed fixed-Header semantic contract and the same
  // deterministic ownership rules. Every mode locates Header semantics through
  // source coordinates; singleline uses a dedicated flat address-only presentation
  // with no structural proposal channel. BODY is
  // always the exact complement. Multiline BODY uses physical rows directly;
  // mixed and singleline ask the model only to restore logical line starts, then
  // converge on the same deterministic multiline BODY classifier. No active path
  // uses bodyStart, semantic BODY generation, or a second BODY classification pass.
  if (
    initialRouting.selectedMode === "multiline" ||
    initialRouting.selectedMode === "generic" ||
    initialRouting.selectedMode === "singleline"
  ) {
    const sourceCandidates = preparedHeaderLattice.headerCandidates.map((candidate, index, all) => ({
      ...candidate,
      id: `candidate-${index}`,
      preview: input.rawSource.slice(candidate.start, all[index + 1]?.start ?? input.rawSource.length),
    }));
    deterministicHints = createDeterministicHints(input.rawSource, sourceCandidates);

    let responseParsingSeconds = 0;
    let essentialVerificationModelCallSeconds = 0;
    let verificationFacts: import("./modelSchema.js").CandidateEssentialFact[] = [];
    let verificationAbilityLabels: import("./modelSchema.js").CandidateAbilityLabel[] = [];
    const verificationPipelineIssues: ParseIssue[] = [];
    let essentialVerification: EssentialFactsVerificationDiagnostics = {
      status: "not_run",
      modelRequest: null,
      rawModelContent: null,
      elapsedSeconds: null,
      performance: null,
      facts: [],
      promptMetrics: null,
      shadowComparison: null,
      issues: [],
    };
    let verificationRequest: StructuredModelRequest | null = null;
    let verificationRaw: string | null = null;
    let verificationElapsed: number | null = null;
    let verificationPerformance: ModelPerformanceMetrics | null = null;
    let singlelineGroundedHeader: GroundedSinglelineHeaderCoordinates | null = null;

    const singlelineHeader = initialRouting.selectedMode === "singleline";
    if (singlelineHeader || sourceCandidates.length > 0) {
      verificationRequest = {
        model: input.model,
        task: "header",
        systemPrompt: singlelineHeader ? SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT : ESSENTIAL_FACTS_SYSTEM_PROMPT,
        userPrompt: singlelineHeader
          ? createSinglelineEssentialFactsUserPrompt(input.rawSource, sourceCandidates)
          : createEssentialFactsUserPrompt(input.rawSource, sourceCandidates, verificationHints(deterministicHints)),
        jsonSchema: singlelineHeader
          ? createSinglelineHeaderCoordinatesGenerationJsonSchema(sourceCandidates.length)
          : createEssentialFactsGenerationJsonSchema(sourceCandidates.length),
        temperature: 0,
        seed: 42,
        numCtx: input.numCtx ?? 16384,
        numPredict: Math.min(input.numPredict ?? 4096, 768),
        timeoutMs: input.timeoutMs ?? 300000,
      };
      input.onProgress?.(singlelineHeader ? "singleline coordinate card-fact locator" : "Header card-fact locator");
      const verificationStartedAt = performance.now();
      try {
        const verificationResult = await caller(verificationRequest);
        verificationRaw = verificationResult.rawContent;
        verificationElapsed = verificationResult.elapsedSeconds;
        verificationPerformance = verificationResult.performance ?? null;
        essentialVerificationModelCallSeconds = (performance.now() - verificationStartedAt) / 1000;

        const parsingStartedAt = performance.now();
        if (singlelineHeader) {
          const parsedCoordinates = parseSinglelineHeaderCoordinatesResponse(
            verificationResult.parsedContent,
            sourceCandidates.length,
          );
          const invalidEnvelope = parsedCoordinates.issues.some((currentIssue) =>
            /envelope/u.test(currentIssue.message),
          );
          singlelineGroundedHeader = invalidEnvelope
            ? null
            : groundSinglelineHeaderCoordinates(input.rawSource, sourceCandidates, parsedCoordinates);
          verificationFacts = [];
          verificationAbilityLabels =
            singlelineGroundedHeader?.modelFacts.abilityLabels.map((label) => ({
              ability: label.ability,
              labelQuote: label.labelQuote,
            })) ?? [];
          responseParsingSeconds += (performance.now() - parsingStartedAt) / 1000;
          const groundingIssues = singlelineGroundedHeader?.issues ?? [];
          essentialVerification = {
            status: invalidEnvelope ? "invalid" : "completed",
            modelRequest: verificationRequest,
            rawModelContent: verificationRaw,
            elapsedSeconds: verificationElapsed,
            performance: verificationPerformance,
            facts: [],
            singlelineCoordinates: invalidEnvelope
              ? null
              : {
                  identity: parsedCoordinates.identity.map((anchor) => ({
                    kind: anchor.kind,
                    startCandidate: anchor.startCandidate,
                    endCandidate: anchor.endCandidate,
                  })),
                  fields: parsedCoordinates.fields.map((anchor) => ({
                    kind: anchor.kind,
                    startCandidate: anchor.startCandidate,
                    endCandidate: anchor.endCandidate,
                  })),
                  abilityLabels: parsedCoordinates.abilityLabels.map((anchor) => ({
                    ability: anchor.ability,
                    startCandidate: anchor.startCandidate,
                    endCandidate: anchor.endCandidate,
                  })),
                  groundedRegions: singlelineGroundedHeader?.groundedRegions.map((region) => ({ ...region })) ?? [],
                },
            promptMetrics: measureHeaderPromptRequest(verificationRequest, input.rawSource, sourceCandidates),
            shadowComparison: null,
            issues: [
              ...parsedCoordinates.issues.map((currentIssue) => ({ ...currentIssue })),
              ...groundingIssues.map((currentIssue) => ({
                candidateIndex: null,
                message: currentIssue.message,
                details: { code: currentIssue.code, ...currentIssue.details },
              })),
            ],
          };
          if (invalidEnvelope) {
            verificationPipelineIssues.push(
              pipelineIssue(
                "essential_verification_invalid",
                "The singleline Header coordinate selector returned an invalid envelope. No Header facts were accepted; all source remained available to BODY normalization.",
                { issues: parsedCoordinates.issues.map((currentIssue) => currentIssue.message) },
              ),
            );
          } else {
            verificationPipelineIssues.push(...parsedCoordinates.issues.map(responseIssue));
            verificationPipelineIssues.push(
              ...groundingIssues.map((currentIssue) =>
                pipelineIssue(currentIssue.code, currentIssue.message, currentIssue.details),
              ),
            );
          }
        } else {
          const verified = parseCandidateEssentialFactsResponse(
            verificationResult.parsedContent,
            sourceCandidates.length,
          );
          responseParsingSeconds += (performance.now() - parsingStartedAt) / 1000;
          const invalidEnvelope = verified.issues.some((currentIssue) => /envelope/u.test(currentIssue.message));
          verificationFacts = invalidEnvelope ? [] : verified.essentialFacts;
          verificationAbilityLabels = invalidEnvelope ? [] : verified.abilityLabels;
          if (!invalidEnvelope && verificationAbilityLabels.length > 0) {
            // abilityLabels are semantic identity hints in their own right. They are
            // intentionally NOT conditional on an `ab` region claim: deterministic
            // code may use six grounded mappings to prove the exact ability region.
            //
            // Small models occasionally return a single candidate coordinate in q
            // (for example q:"C005") instead of the printed label. Accept that only
            // when the coordinate resolves to one compact exact source token; the
            // canonical ability identity still comes exclusively from the model.
            verificationAbilityLabels = verificationAbilityLabels.flatMap((label) => {
              const printed = resolveAbilityLabelCoordinateQuote(input.rawSource, sourceCandidates, label.labelQuote);
              return printed === null ? [] : [{ ...label, labelQuote: printed }];
            });
          }
          essentialVerification = {
            status: invalidEnvelope ? "invalid" : "completed",
            modelRequest: verificationRequest,
            rawModelContent: verificationRaw,
            elapsedSeconds: verificationElapsed,
            performance: verificationPerformance,
            facts: verified.essentialFacts.map((fact) => ({ ...fact })),
            singlelineCoordinates: null,
            promptMetrics: measureHeaderPromptRequest(verificationRequest, input.rawSource, sourceCandidates),
            shadowComparison: null,
            issues: verified.issues.map((currentIssue) => ({ ...currentIssue })),
          };
          if (invalidEnvelope) {
            verificationPipelineIssues.push(
              pipelineIssue(
                "essential_verification_invalid",
                "The Header card-fact locator returned an invalid envelope. No Header facts were accepted; all source remained available to deterministic BODY parsing.",
                { issues: verified.issues.map((currentIssue) => currentIssue.message) },
              ),
            );
          } else {
            verificationPipelineIssues.push(...verified.issues.map(responseIssue));
          }
        }
      } catch (error: unknown) {
        essentialVerificationModelCallSeconds = (performance.now() - verificationStartedAt) / 1000;
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof StructuredModelInvalidJsonError) {
          verificationRaw = error.rawContent;
          verificationElapsed = error.elapsedSeconds;
        }
        verificationFacts = [];
        verificationAbilityLabels = [];
        singlelineGroundedHeader = null;
        essentialVerification = {
          status: "failed",
          modelRequest: verificationRequest,
          rawModelContent: verificationRaw,
          elapsedSeconds: verificationElapsed,
          performance: verificationPerformance,
          facts: [],
          promptMetrics:
            verificationRequest === null
              ? null
              : measureHeaderPromptRequest(verificationRequest, input.rawSource, sourceCandidates),
          shadowComparison: null,
          issues: [{ candidateIndex: null, message, details: {} }],
        };
        verificationPipelineIssues.push(
          pipelineIssue(
            "essential_verification_failed",
            "The Header card-fact locator failed. No Header facts were accepted; all source remained available to deterministic BODY parsing.",
            { error: message },
          ),
        );
      }
    }

    const emptyParsed = parseCandidateModelResponse({ blocks: [], abilityLabels: [] }, sourceCandidates.length);
    const verifierParsed = {
      ...emptyParsed,
      abilityLabels: verificationAbilityLabels,
      essentialFacts: verificationFacts,
    };

    // First compile an ownership probe containing no semantic Header annotations.
    // Only deterministically accepted structured facts from verifier evidence can
    // therefore create Header ownership in this stage.
    const probeModel = emptyModelSummary(input.model, essentialVerification.status !== "not_run");
    probeModel.elapsedSeconds = essentialVerification.elapsedSeconds;
    probeModel.requestCount = essentialVerification.status === "not_run" ? 0 : 1;
    probeModel.succeededRequestCount = essentialVerification.status === "completed" ? 1 : 0;
    probeModel.partialRequestCount = essentialVerification.status === "invalid" ? 1 : 0;
    probeModel.failedRequestCount = essentialVerification.status === "failed" ? 1 : 0;
    const probeDocument = compileLosslessDocument({
      rawSource: input.rawSource,
      sourceMap: input.sourceMap,
      candidates: [],
      preserveStructuralOwnership: true,
      initialIssues: verificationPipelineIssues,
      model: probeModel,
    });
    const probeFacts =
      singlelineGroundedHeader?.modelFacts ?? candidateHeaderFacts(probeDocument, verifierParsed, sourceCandidates);
    const validatedProbe = enrichStructuredHeader(probeDocument, probeFacts, { essentialOnly: true });
    const acceptedHeaderOwnership = resolveAcceptedHeaderOwnership(validatedProbe);

    if (initialRouting.selectedMode === "multiline") {
      return analyzeMultilineBody({
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
      });
    }

    if (initialRouting.selectedMode === "singleline") {
      return analyzeSinglelineBody({
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
        responseParsingSeconds,
      });
    }

    return analyzeMixedBody({
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
      responseParsingSeconds,
    });
  }

  const unsupportedMode: never = initialRouting.selectedMode;
  throw new Error(`Unsupported resolved parser mode: ${String(unsupportedMode)}`);
}
