import type { LosslessStatblockDocument, ParserReport } from "./domain.js";
import type { EditableStatblockDocument } from "./productModel.js";
import type { StructuredModelRequest } from "./modelProvider.js";
import type { HeaderPromptMetrics } from "./headerPromptMetrics.js";
import type { ParseJobError } from "./parseJobs.js";
import type { DeterministicHint } from "./deterministicHints.js";
import type { ParserRoutingDecision } from "./parserRouting.js";

export type ParseDiagnosticsTiming = {
  totalSeconds: number;
  modelCallSeconds: number;
  structuralModelCallSeconds?: number;
  essentialVerificationModelCallSeconds?: number;
  responseParsingSeconds: number;
  quoteAnchoringSeconds: number;
  documentCompilationSeconds: number;
  headerEnrichmentSeconds: number;
  ollama: {
    totalSeconds: number | null;
    loadSeconds: number | null;
    promptEvalSeconds: number | null;
    promptEvalCount: number | null;
    evalSeconds: number | null;
    evalCount: number | null;
  } | null;
  essentialVerificationOllama?: {
    totalSeconds: number | null;
    loadSeconds: number | null;
    promptEvalSeconds: number | null;
    promptEvalCount: number | null;
    evalSeconds: number | null;
    evalCount: number | null;
  } | null;
  shadowHeaderModelCallSeconds?: number;
  shadowHeaderOllama?: {
    totalSeconds: number | null;
    loadSeconds: number | null;
    promptEvalSeconds: number | null;
    promptEvalCount: number | null;
    evalSeconds: number | null;
    evalCount: number | null;
  } | null;
};

export type ParseDiagnosticsCandidateDebug = {
  transport: "candidate_spans";
  status: "prepared" | "processed" | "response_invalid" | "model_failed";
  modelError: string | null;
  candidateCount: number;
  runCount: number;
  coveredCandidateCount: number;
  unclassifiedRunCount: number;
  runs: Array<{
    startCandidate: number;
    endCandidate: number;
    startId: string;
    endId: string;
    classification: string;
    runLength: number;
    startPreview: string;
    endPreview: string;
    accepted: boolean;
    acceptedRole: string | null;
    acceptedField: string | null;
    acceptedSection: string | null;
  }>;
};
export type ParseDiagnosticsModelRequest = StructuredModelRequest;

export type ParseDiagnosticsBodyStructure = {
  status: "completed" | "invalid" | "failed" | "not_run";
  modelRequest: ParseDiagnosticsModelRequest | null;
  rawModelContent: string | null;
  elapsedSeconds: number | null;
  performance: ParseDiagnosticsTiming["ollama"];
  issues: Array<{ candidateIndex: number | null; message: string; details: Record<string, unknown> }>;
  classificationRequest?: ParseDiagnosticsModelRequest | null;
  classificationRawModelContent?: string | null;
  classificationElapsedSeconds?: number | null;
  classificationPerformance?: ParseDiagnosticsTiming["ollama"];
};

export type ParseDiagnosticsEssentialVerification = {
  status: "completed" | "invalid" | "failed" | "not_run";
  modelRequest: ParseDiagnosticsModelRequest | null;
  rawModelContent: string | null;
  elapsedSeconds: number | null;
  performance: ParseDiagnosticsTiming["ollama"];
  facts: Array<{ kind: string; startCandidate: number; endCandidate: number }>;
  promptMetrics?: HeaderPromptMetrics | null;
  shadowComparison?: {
    status: "completed" | "invalid" | "failed" | "not_run";
    modelRequest: ParseDiagnosticsModelRequest | null;
    rawModelContent: string | null;
    elapsedSeconds: number | null;
    performance: ParseDiagnosticsTiming["ollama"];
    facts: Array<{ kind: string; startCandidate: number; endCandidate: number }>;
    abilityLabels: Array<{ ability: string; labelQuote: string }>;
    verifiedHeader: unknown | null;
    verifiedHeaderEquivalentToLegacy: boolean | null;
    functionalHeaderEquivalentToLegacy: boolean | null;
    functionalHeaderDifferingFields: string[];
    issues: Array<{ candidateIndex: number | null; message: string; details: Record<string, unknown> }>;
  } | null;
  issues: Array<{ candidateIndex: number | null; message: string; details: Record<string, unknown> }>;
};

export type ParseJobRunnerDiagnostics = {
  parserVersion: string;
  model: string;
  pipeline: {
    timing: ParseDiagnosticsTiming;
    modelRequest: ParseDiagnosticsModelRequest | null;
    rawModelContent: string | null;
    essentialVerification?: ParseDiagnosticsEssentialVerification | null;
    bodyStructure?: ParseDiagnosticsBodyStructure | null;
    deterministicHints?: DeterministicHint[];
    parserRouting?: ParserRoutingDecision;
    candidateDebug: ParseDiagnosticsCandidateDebug | null;
    losslessDocument: LosslessStatblockDocument;
    parserReport: ParserReport;
  } | null;
  product: EditableStatblockDocument | null;
};

export type ParseDiagnosticsStatistics = {
  source: {
    characters: number;
    lines: number;
    nonEmptyLines: number;
    sourceUnits: number | null;
    contentUnits: number | null;
  };
  candidates: {
    count: number | null;
    runCount: number | null;
    coveredCandidateCount: number | null;
    unclassifiedRunCount: number | null;
  };
  annotations: {
    total: number;
    byRole: Record<string, number>;
    byField: Record<string, number>;
    bySection: Record<string, number>;
    byProvenance: Record<string, number>;
  };
  blocks: {
    total: number;
    annotated: number;
    unclassified: number;
    separator: number;
    unclassifiedCharacters: number;
  };
  issues: {
    total: number;
    info: number;
    warnings: number;
    byCode: Record<string, number>;
  };
  product: {
    hasName: boolean;
    hasSubtitle: boolean;
    primaryHeaderRows: number;
    secondaryHeaderRows: number;
    bodyNodes: number;
    headings: number;
    paragraphs: number;
  };
};

export type ParseDiagnosticsReport = {
  formatVersion: "parse-diagnostics-v1";
  id: string;
  jobId: string;
  clientId: string;
  statblockId: string;
  modelProfileId: string;
  displayHint: string;
  attempt: number;
  status: "completed" | "failed";
  createdAt: string;
  startedAt: string | null;
  completedAt: string;
  parserVersion: string | null;
  model: string | null;
  failure: ParseJobError | null;
  source: {
    rawText: string;
    sha256: string | null;
  };
  statistics: ParseDiagnosticsStatistics;
  timing: ParseDiagnosticsTiming | null;
  modelRequest: ParseDiagnosticsModelRequest | null;
  rawModelContent: string | null;
  essentialVerification?: ParseDiagnosticsEssentialVerification | null;
  bodyStructure?: ParseDiagnosticsBodyStructure | null;
  parserRouting?: ParserRoutingDecision | null;
  deterministicHints?: DeterministicHint[];
  candidateDebug: ParseDiagnosticsCandidateDebug | null;
  parserReport: ParserReport | null;
  losslessDocument: LosslessStatblockDocument | null;
  editableDocument: EditableStatblockDocument | null;
};

export type ParseDiagnosticsSummary = Pick<
  ParseDiagnosticsReport,
  | "id"
  | "jobId"
  | "statblockId"
  | "modelProfileId"
  | "displayHint"
  | "attempt"
  | "status"
  | "createdAt"
  | "startedAt"
  | "completedAt"
  | "parserVersion"
  | "model"
  | "failure"
> & {
  sourceSha256: string | null;
  statistics: ParseDiagnosticsStatistics;
};

export type ParseDiagnosticsAggregate = {
  reportCount: number;
  completedCount: number;
  failedCount: number;
  uniqueJobCount: number;
  totalSourceCharacters: number;
  totalIssues: number;
  totalUnclassifiedBlocks: number;
  reportsWithMissingName: number;
  reportsWithMissingSubtitle: number;
  averagePipelineSeconds: number | null;
  byModelProfile: Record<string, number>;
  byParserVersion: Record<string, number>;
  failuresByStage: Record<string, number>;
};

export type ParseDiagnosticsExport = {
  formatVersion: "parse-diagnostics-export-v1";
  exportedAt: string;
  aggregate: ParseDiagnosticsAggregate;
  reports: ParseDiagnosticsReport[];
};

function countValues(values: Array<string | null | undefined>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    if (value === null || value === undefined || value.length === 0) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

export function createDiagnosticsStatistics(
  rawText: string,
  diagnostics: ParseJobRunnerDiagnostics | null,
): ParseDiagnosticsStatistics {
  const lossless = diagnostics?.pipeline?.losslessDocument ?? null;
  const candidateDebug = diagnostics?.pipeline?.candidateDebug ?? null;
  const product = diagnostics?.product ?? null;
  const lines = rawText.length === 0 ? [] : rawText.split(/\r?\n/u);
  const annotations = lossless?.annotations ?? [];
  const blocks = lossless?.blocks ?? [];
  const issues = lossless?.issues ?? [];

  return {
    source: {
      characters: rawText.length,
      lines: lines.length,
      nonEmptyLines: lines.filter((line) => line.trim().length > 0).length,
      sourceUnits: lossless?.sourceMap.units.length ?? null,
      contentUnits: lossless?.sourceMap.units.filter((unit) => unit.kind === "content").length ?? null,
    },
    candidates: {
      count: candidateDebug?.candidateCount ?? null,
      runCount: candidateDebug?.runCount ?? null,
      coveredCandidateCount: candidateDebug?.coveredCandidateCount ?? null,
      unclassifiedRunCount: candidateDebug?.unclassifiedRunCount ?? null,
    },
    annotations: {
      total: annotations.length,
      byRole: countValues(annotations.map((annotation) => annotation.role)),
      byField: countValues(annotations.map((annotation) => annotation.field)),
      bySection: countValues(annotations.map((annotation) => annotation.section)),
      byProvenance: countValues(annotations.map((annotation) => annotation.provenance)),
    },
    blocks: {
      total: blocks.length,
      annotated: blocks.filter((block) => block.kind === "annotated").length,
      unclassified: blocks.filter((block) => block.kind === "unclassified").length,
      separator: blocks.filter((block) => block.kind === "separator").length,
      unclassifiedCharacters: blocks
        .filter((block) => block.kind === "unclassified")
        .reduce((sum, block) => sum + block.text.length, 0),
    },
    issues: {
      total: issues.length,
      info: issues.filter((issue) => issue.severity === "info").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      byCode: countValues(issues.map((issue) => issue.code)),
    },
    product: {
      hasName: (product?.header.name?.text.trim().length ?? 0) > 0,
      hasSubtitle: (product?.header.subtitle?.text.trim().length ?? 0) > 0,
      primaryHeaderRows: product?.header.primaryRows.length ?? 0,
      secondaryHeaderRows: product?.header.secondaryRows.length ?? 0,
      bodyNodes: product?.body.length ?? 0,
      headings: product?.body.filter((node) => node.type === "heading").length ?? 0,
      paragraphs: product?.body.filter((node) => node.type === "paragraph").length ?? 0,
    },
  };
}

export function aggregateDiagnostics(reports: readonly ParseDiagnosticsReport[]): ParseDiagnosticsAggregate {
  const pipelineSeconds = reports
    .map((report) => report.timing?.totalSeconds ?? null)
    .filter((value): value is number => value !== null);
  return {
    reportCount: reports.length,
    completedCount: reports.filter((report) => report.status === "completed").length,
    failedCount: reports.filter((report) => report.status === "failed").length,
    uniqueJobCount: new Set(reports.map((report) => report.jobId)).size,
    totalSourceCharacters: reports.reduce((sum, report) => sum + report.statistics.source.characters, 0),
    totalIssues: reports.reduce((sum, report) => sum + report.statistics.issues.total, 0),
    totalUnclassifiedBlocks: reports.reduce((sum, report) => sum + report.statistics.blocks.unclassified, 0),
    reportsWithMissingName: reports.filter((report) => !report.statistics.product.hasName).length,
    reportsWithMissingSubtitle: reports.filter((report) => !report.statistics.product.hasSubtitle).length,
    averagePipelineSeconds:
      pipelineSeconds.length === 0
        ? null
        : pipelineSeconds.reduce((sum, value) => sum + value, 0) / pipelineSeconds.length,
    byModelProfile: countValues(reports.map((report) => report.modelProfileId)),
    byParserVersion: countValues(reports.map((report) => report.parserVersion)),
    failuresByStage: countValues(reports.map((report) => report.failure?.stage)),
  };
}

export function diagnosticsSummary(report: ParseDiagnosticsReport): ParseDiagnosticsSummary {
  return {
    id: report.id,
    jobId: report.jobId,
    statblockId: report.statblockId,
    modelProfileId: report.modelProfileId,
    displayHint: report.displayHint,
    attempt: report.attempt,
    status: report.status,
    createdAt: report.createdAt,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    parserVersion: report.parserVersion,
    model: report.model,
    failure: structuredClone(report.failure),
    sourceSha256: report.source.sha256,
    statistics: structuredClone(report.statistics),
  };
}
