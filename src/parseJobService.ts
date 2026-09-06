import { randomUUID } from "node:crypto";

import type { ParseJobFailureStage, ParseJobRecord, ParseJobResult, ParseJobSummary } from "./parseJobs.js";
import { parseJobDisplayHint, parseJobSummary } from "./parseJobs.js";
import type { ParseJobStore } from "./parseJobStore.js";
import {
  aggregateDiagnostics,
  createDiagnosticsStatistics,
  diagnosticsSummary,
  type ParseDiagnosticsExport,
  type ParseDiagnosticsReport,
  type ParseDiagnosticsSummary,
  type ParseJobRunnerDiagnostics,
} from "./parseDiagnostics.js";
import type { ParseDiagnosticsStore } from "./parseDiagnosticsStore.js";
import type { ParserMode } from "./parserRouting.js";

export type ParseJobRunnerResult = ParseJobResult & {
  diagnostics?: ParseJobRunnerDiagnostics | null;
};

export type ParseJobRunner = (
  rawText: string,
  statblockId: string,
  parserMode?: ParserMode,
) => Promise<ParseJobRunnerResult>;

export class ParseJobExecutionError extends Error {
  constructor(
    readonly stage: ParseJobFailureStage,
    message: string,
    readonly diagnostics: ParseJobRunnerDiagnostics | null = null,
  ) {
    super(message);
    this.name = "ParseJobExecutionError";
  }
}

export type ParseJobServiceOptions = {
  store: ParseJobStore;
  defaultModelProfileId: string;
  resolveRunner: (modelProfileId: string) => ParseJobRunner;
  now?: () => string;
  createId?: () => string;
  diagnosticsStore?: ParseDiagnosticsStore;
};

export class ParseJobNotFoundError extends Error {}
export class ParseJobConflictError extends Error {}

export class ParseJobService {
  private readonly store: ParseJobStore;
  private readonly defaultModelProfileId: string;
  private readonly resolveRunner: (modelProfileId: string) => ParseJobRunner;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly diagnosticsStore: ParseDiagnosticsStore | null;
  private workerRunning = false;
  private initialization: Promise<void> | null = null;

  constructor(options: ParseJobServiceOptions) {
    this.store = options.store;
    this.defaultModelProfileId = options.defaultModelProfileId;
    this.resolveRunner = options.resolveRunner;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? randomUUID;
    this.diagnosticsStore = options.diagnosticsStore ?? null;
  }

  initialize(): Promise<void> {
    if (this.initialization !== null) return this.initialization;
    this.initialization = this.initializeOnce();
    return this.initialization;
  }

  private async initializeOnce(): Promise<void> {
    const jobs = await this.store.list();
    for (const job of jobs) {
      const migrated: ParseJobRecord = {
        ...job,
        modelProfileId: job.modelProfileId || this.defaultModelProfileId,
        parserMode: job.parserMode ?? "auto",
        replaceExisting: job.replaceExisting ?? false,
      };
      if (job.status === "processing") {
        await this.store.put({
          ...migrated,
          status: "queued",
          startedAt: null,
          completedAt: null,
          error: null,
        });
      } else if (
        migrated.modelProfileId !== job.modelProfileId ||
        migrated.parserMode !== job.parserMode ||
        migrated.replaceExisting !== job.replaceExisting
      ) {
        await this.store.put(migrated);
      }
    }
    this.scheduleWorker();
  }

  private async recordsForClient(clientId: string): Promise<ParseJobRecord[]> {
    return (await this.store.list())
      .filter((job) => job.clientId === clientId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async submit(
    clientId: string,
    rawText: string,
    modelProfileId?: string | null,
    parserMode: ParserMode = "auto",
    statblockId?: string | null,
  ): Promise<ParseJobSummary> {
    await this.initialize();
    const createdAt = this.now();
    const id = this.createId();
    const targetStatblockId = statblockId?.trim() || id;
    const record: ParseJobRecord = {
      id,
      clientId,
      statblockId: targetStatblockId,
      modelProfileId: modelProfileId?.trim() || this.defaultModelProfileId,
      parserMode,
      replaceExisting: targetStatblockId !== id,
      displayHint: parseJobDisplayHint(rawText),
      status: "queued",
      createdAt,
      startedAt: null,
      completedAt: null,
      error: null,
      attempt: 0,
      rawText,
      result: null,
    };
    await this.store.put(record);
    this.scheduleWorker();
    return parseJobSummary(record);
  }

  async list(clientId: string): Promise<ParseJobSummary[]> {
    await this.initialize();
    return (await this.recordsForClient(clientId)).map(parseJobSummary);
  }

  async get(clientId: string, id: string): Promise<ParseJobSummary> {
    return parseJobSummary(await this.requireRecord(clientId, id));
  }

  async result(clientId: string, id: string): Promise<ParseJobResult> {
    const record = await this.requireRecord(clientId, id);
    if (record.status !== "completed" || record.result === null) {
      throw new ParseJobConflictError("Parse job result is not available.");
    }
    return structuredClone(record.result);
  }

  async listDiagnostics(clientId: string): Promise<ParseDiagnosticsSummary[]> {
    if (this.diagnosticsStore === null) return [];
    return (await this.diagnosticsStore.list())
      .filter((report) => report.clientId === clientId)
      .map(diagnosticsSummary);
  }

  async getDiagnostics(clientId: string, id: string): Promise<ParseDiagnosticsReport> {
    if (this.diagnosticsStore === null) throw new ParseJobNotFoundError("Parse diagnostics are not configured.");
    const report = await this.diagnosticsStore.get(id);
    if (report === null || report.clientId !== clientId)
      throw new ParseJobNotFoundError("Parse diagnostics not found.");
    return structuredClone(report);
  }

  async exportDiagnostics(clientId: string): Promise<ParseDiagnosticsExport> {
    const reports =
      this.diagnosticsStore === null
        ? []
        : (await this.diagnosticsStore.list()).filter((report) => report.clientId === clientId);
    return {
      formatVersion: "parse-diagnostics-export-v1",
      exportedAt: this.now(),
      aggregate: aggregateDiagnostics(reports),
      reports: structuredClone(reports),
    };
  }

  async retry(clientId: string, id: string): Promise<ParseJobSummary> {
    const record = await this.requireRecord(clientId, id);
    if (record.status !== "failed" || record.rawText === null) {
      throw new ParseJobConflictError("Only failed parse jobs with retained source can be retried.");
    }
    const next: ParseJobRecord = {
      ...record,
      status: "queued",
      startedAt: null,
      completedAt: null,
      error: null,
      result: null,
    };
    await this.store.put(next);
    this.scheduleWorker();
    return parseJobSummary(next);
  }

  async delete(clientId: string, id: string): Promise<void> {
    const record = await this.requireRecord(clientId, id);
    if (record.status === "processing") {
      throw new ParseJobConflictError("A processing parse job cannot be deleted.");
    }
    await this.store.delete(record.id);
  }

  private async requireRecord(clientId: string, id: string): Promise<ParseJobRecord> {
    await this.initialize();
    const record = (await this.store.list()).find((job) => job.id === id && job.clientId === clientId);
    if (record === undefined) throw new ParseJobNotFoundError("Parse job not found.");
    return record;
  }

  private scheduleWorker(): void {
    if (this.workerRunning) return;
    this.workerRunning = true;
    queueMicrotask(() => {
      void this.runWorker().finally(() => {
        this.workerRunning = false;
        void this.store.list().then((jobs) => {
          if (jobs.some((job) => job.status === "queued")) this.scheduleWorker();
        });
      });
    });
  }

  private async runWorker(): Promise<void> {
    while (true) {
      const jobs = await this.store.list();
      const next = jobs
        .filter((job) => job.status === "queued")
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
      if (next === undefined) return;
      await this.process(next);
    }
  }

  private async writeDiagnostics(
    record: ParseJobRecord,
    rawText: string,
    completedAt: string,
    status: "completed" | "failed",
    failure: ParseJobRecord["error"],
    diagnostics: ParseJobRunnerDiagnostics | null,
  ): Promise<void> {
    if (this.diagnosticsStore === null) return;
    const report: ParseDiagnosticsReport = {
      formatVersion: "parse-diagnostics-v1",
      id: `${record.id}-attempt-${record.attempt}`,
      jobId: record.id,
      clientId: record.clientId,
      statblockId: record.statblockId,
      modelProfileId: record.modelProfileId,
      displayHint: record.displayHint,
      attempt: record.attempt,
      status,
      createdAt: record.createdAt,
      startedAt: record.startedAt,
      completedAt,
      parserVersion: diagnostics?.parserVersion ?? null,
      model: diagnostics?.model ?? null,
      failure: structuredClone(failure),
      source: {
        rawText,
        sha256: diagnostics?.pipeline?.losslessDocument.sourceMap.sourceSha256 ?? null,
      },
      statistics: createDiagnosticsStatistics(rawText, diagnostics),
      timing: diagnostics?.pipeline?.timing ?? null,
      modelRequest: diagnostics?.pipeline?.modelRequest ?? null,
      rawModelContent: diagnostics?.pipeline?.rawModelContent ?? null,
      essentialVerification: diagnostics?.pipeline?.essentialVerification ?? null,
      bodyStructure: diagnostics?.pipeline?.bodyStructure ?? null,
      parserRouting: diagnostics?.pipeline?.parserRouting ?? null,
      deterministicHints: diagnostics?.pipeline?.deterministicHints ?? [],
      candidateDebug: diagnostics?.pipeline?.candidateDebug ?? null,
      parserReport: diagnostics?.pipeline?.parserReport ?? null,
      losslessDocument: diagnostics?.pipeline?.losslessDocument ?? null,
      editableDocument: diagnostics?.product ?? null,
    };
    await this.diagnosticsStore.put(report);
  }

  private async process(record: ParseJobRecord): Promise<void> {
    if (record.rawText === null) {
      await this.store.put({
        ...record,
        status: "failed",
        completedAt: this.now(),
        error: { stage: "internal", message: "Queued job has no source text." },
      });
      return;
    }

    const rawText = record.rawText;
    const processing: ParseJobRecord = {
      ...record,
      status: "processing",
      startedAt: this.now(),
      completedAt: null,
      error: null,
      attempt: record.attempt + 1,
    };
    await this.store.put(processing);

    try {
      const runner = this.resolveRunner(processing.modelProfileId);
      const runnerOutput = await runner(rawText, processing.statblockId, processing.parserMode ?? "auto");
      const { diagnostics = null, ...result } = runnerOutput;
      const completedAt = this.now();

      try {
        await this.writeDiagnostics(processing, rawText, completedAt, "completed", null, diagnostics);
      } catch (diagnosticError) {
        // Diagnostics are best-effort observability. A successful parse must not
        // become a failed product import because its report could not be stored.
        console.error("Failed to persist parse diagnostics:", diagnosticError);
      }
      await this.store.put({
        ...processing,
        status: "completed",
        completedAt,
        rawText: null,
        result,
        error: null,
      });
    } catch (error) {
      const completedAt = this.now();
      const failure = {
        stage: error instanceof ParseJobExecutionError ? error.stage : ("internal" as const),
        message: error instanceof Error ? error.message : String(error),
      };
      const diagnostics = error instanceof ParseJobExecutionError ? error.diagnostics : null;
      try {
        await this.writeDiagnostics(processing, rawText, completedAt, "failed", failure, diagnostics);
      } catch (diagnosticError) {
        console.error("Failed to persist parse diagnostics:", diagnosticError);
      }
      await this.store.put({
        ...processing,
        status: "failed",
        completedAt,
        error: failure,
        result: null,
      });
    }
  }
}
