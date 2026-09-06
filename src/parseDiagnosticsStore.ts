import { readFile } from "node:fs/promises";

import { writeUtf8FileAtomically } from "./atomicFileWrite.js";
import type { ParseDiagnosticsReport } from "./parseDiagnostics.js";
import { assertParseDiagnosticsReport } from "./runtimeValidation.js";

export interface ParseDiagnosticsStore {
  put(report: ParseDiagnosticsReport): Promise<void>;
  list(): Promise<ParseDiagnosticsReport[]>;
  get(id: string): Promise<ParseDiagnosticsReport | null>;
}

function cloneReport(report: ParseDiagnosticsReport): ParseDiagnosticsReport {
  return structuredClone(report);
}

export class MemoryParseDiagnosticsStore implements ParseDiagnosticsStore {
  private reports = new Map<string, ParseDiagnosticsReport>();

  async put(report: ParseDiagnosticsReport): Promise<void> {
    this.reports.set(report.id, cloneReport(report));
  }

  async list(): Promise<ParseDiagnosticsReport[]> {
    return [...this.reports.values()].map(cloneReport);
  }

  async get(id: string): Promise<ParseDiagnosticsReport | null> {
    const report = this.reports.get(id);
    return report === undefined ? null : cloneReport(report);
  }
}

type PersistedDiagnostics = {
  formatVersion: "parse-diagnostics-store-v1";
  reports: ParseDiagnosticsReport[];
};

export class JsonFileParseDiagnosticsStore implements ParseDiagnosticsStore {
  private loaded = false;
  private reports = new Map<string, ParseDiagnosticsReport>();
  private mutationChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      if (typeof raw !== "object" || raw === null) throw new Error("Malformed parse diagnostics store.");
      const parsed = raw as Record<string, unknown>;
      if (parsed.formatVersion !== "parse-diagnostics-store-v1" || !Array.isArray(parsed.reports)) {
        throw new Error("Unsupported parse diagnostics store format.");
      }
      parsed.reports.forEach(assertParseDiagnosticsReport);
      this.reports = new Map(parsed.reports.map((report) => [report.id, cloneReport(report)]));
      this.loaded = true;
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
      if (code !== "ENOENT") throw error;
      this.loaded = true;
    }
  }

  private async persist(reports: Map<string, ParseDiagnosticsReport>): Promise<void> {
    const snapshot: PersistedDiagnostics = {
      formatVersion: "parse-diagnostics-store-v1",
      reports: [...reports.values()].map(cloneReport),
    };
    await writeUtf8FileAtomically(this.filePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  async put(report: ParseDiagnosticsReport): Promise<void> {
    await this.ensureLoaded();
    this.mutationChain = this.mutationChain.then(async () => {
      const next = new Map(this.reports);
      next.set(report.id, cloneReport(report));
      await this.persist(next);
      this.reports = next;
    });
    await this.mutationChain;
  }

  async list(): Promise<ParseDiagnosticsReport[]> {
    await this.ensureLoaded();
    await this.mutationChain;
    return [...this.reports.values()]
      .map(cloneReport)
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  }

  async get(id: string): Promise<ParseDiagnosticsReport | null> {
    await this.ensureLoaded();
    await this.mutationChain;
    const report = this.reports.get(id);
    return report === undefined ? null : cloneReport(report);
  }
}
