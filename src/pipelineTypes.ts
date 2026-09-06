import type { LosslessSourceMap, LosslessStatblockDocument } from "./domain.js";
import type { HeaderPromptMetrics } from "./headerPromptMetrics.js";
import type { CandidateTransportDebug } from "./candidateTransport.js";
import type { DeterministicHint } from "./deterministicHints.js";
import type { ParserMode, ParserRoutingDecision } from "./parserRouting.js";
import type { ModelPerformanceMetrics, StructuredModelRequest, StructureModelCaller } from "./modelProvider.js";

export type AnalyzeStatblockInput = {
  rawSource: string;
  sourceMap: LosslessSourceMap;
  model: string;
  callModel?: StructureModelCaller;
  timeoutMs?: number;
  numCtx?: number;
  numPredict?: number;
  onProgress?: (message: string) => void;
  parserMode?: ParserMode;
};

export type AnalyzeTimingReport = {
  totalSeconds: number;
  modelCallSeconds: number;
  structuralModelCallSeconds?: number;
  essentialVerificationModelCallSeconds?: number;
  responseParsingSeconds: number;
  quoteAnchoringSeconds: number;
  documentCompilationSeconds: number;
  headerEnrichmentSeconds: number;
  ollama: ModelPerformanceMetrics | null;
  essentialVerificationOllama?: ModelPerformanceMetrics | null;
  shadowHeaderModelCallSeconds?: number;
  shadowHeaderOllama?: ModelPerformanceMetrics | null;
};

export type BodyStructureDiagnostics = {
  status: "completed" | "invalid" | "failed" | "not_run";
  modelRequest: StructuredModelRequest | null;
  rawModelContent: string | null;
  elapsedSeconds: number | null;
  performance: ModelPerformanceMetrics | null;
  issues: Array<{ candidateIndex: number | null; message: string; details: Record<string, unknown> }>;
  classificationRequest?: StructuredModelRequest | null;
  classificationRawModelContent?: string | null;
  classificationElapsedSeconds?: number | null;
  classificationPerformance?: ModelPerformanceMetrics | null;
};

export type ShadowHeaderComparisonDiagnostics = {
  status: "completed" | "invalid" | "failed" | "not_run";
  modelRequest: StructuredModelRequest | null;
  rawModelContent: string | null;
  elapsedSeconds: number | null;
  performance: ModelPerformanceMetrics | null;
  facts: Array<{ kind: string; startCandidate: number; endCandidate: number }>;
  abilityLabels: Array<{ ability: string; labelQuote: string }>;
  verifiedHeader: unknown | null;
  verifiedHeaderEquivalentToLegacy: boolean | null;
  functionalHeaderEquivalentToLegacy: boolean | null;
  functionalHeaderDifferingFields: string[];
  issues: Array<{ candidateIndex: number | null; message: string; details: Record<string, unknown> }>;
};

export type EssentialFactsVerificationDiagnostics = {
  status: "completed" | "invalid" | "failed" | "not_run";
  modelRequest: StructuredModelRequest | null;
  rawModelContent: string | null;
  elapsedSeconds: number | null;
  performance: ModelPerformanceMetrics | null;
  facts: Array<{ kind: string; startCandidate: number; endCandidate: number }>;
  singlelineCoordinates?: {
    identity: Array<{ kind: string; startCandidate: number; endCandidate: number }>;
    fields: Array<{ kind: string; startCandidate: number; endCandidate: number }>;
    abilityLabels: Array<{ ability: string; startCandidate: number; endCandidate: number }>;
    groundedRegions: Array<{ kind: string; start: number; end: number }>;
  } | null;
  promptMetrics: HeaderPromptMetrics | null;
  shadowComparison: ShadowHeaderComparisonDiagnostics | null;
  issues: Array<{ candidateIndex: number | null; message: string; details: Record<string, unknown> }>;
};

export type AnalyzeStatblockResult = {
  document: LosslessStatblockDocument;
  rawModelContent: string | null;
  modelRequest: StructuredModelRequest | null;
  timing: AnalyzeTimingReport;
  candidateDebug: CandidateTransportDebug | null;
  essentialVerification: EssentialFactsVerificationDiagnostics | null;
  bodyStructure?: BodyStructureDiagnostics | null;
  deterministicHints: DeterministicHint[];
  parserRouting: ParserRoutingDecision;
};
