import { readFile } from "node:fs/promises";

import { writeUtf8FileAtomically } from "./atomicFileWrite.js";
import type { ParseJobRecord } from "./parseJobs.js";
import { assertParseJobRecord } from "./runtimeValidation.js";

export interface ParseJobStore {
  list(): Promise<ParseJobRecord[]>;
  put(record: ParseJobRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

function cloneRecord(record: ParseJobRecord): ParseJobRecord {
  return structuredClone(record);
}

export class MemoryParseJobStore implements ParseJobStore {
  private records = new Map<string, ParseJobRecord>();

  async list(): Promise<ParseJobRecord[]> {
    return [...this.records.values()].map(cloneRecord);
  }

  async put(record: ParseJobRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

type PersistedFile = {
  formatVersion: "parse-jobs-v1";
  jobs: ParseJobRecord[];
};

export class JsonFileParseJobStore implements ParseJobStore {
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private records = new Map<string, ParseJobRecord>();
  private mutationChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async loadRecords(): Promise<void> {
    try {
      const text = await readFile(this.filePath, "utf8");
      const raw = JSON.parse(text) as unknown;
      if (typeof raw !== "object" || raw === null) throw new Error("Malformed parse job store.");
      const parsed = raw as Record<string, unknown>;
      if (parsed.formatVersion !== "parse-jobs-v1" || !Array.isArray(parsed.jobs)) {
        throw new Error("Unsupported parse job store format.");
      }
      parsed.jobs.forEach(assertParseJobRecord);
      this.records = new Map(parsed.jobs.map((job) => [job.id, cloneRecord(job)]));
      this.loaded = true;
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
      if (code !== "ENOENT") throw error;
      this.loaded = true;
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loadPromise ??= this.loadRecords();
    try {
      await this.loadPromise;
    } finally {
      if (!this.loaded) this.loadPromise = null;
    }
  }

  private async persistRecords(records: Map<string, ParseJobRecord>): Promise<void> {
    const snapshot: PersistedFile = {
      formatVersion: "parse-jobs-v1",
      jobs: [...records.values()].map(cloneRecord),
    };
    await writeUtf8FileAtomically(this.filePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  private enqueueMutation(mutate: (records: Map<string, ParseJobRecord>) => void): Promise<void> {
    const operation = this.mutationChain.then(async () => {
      await this.ensureLoaded();
      const next = new Map(this.records);
      mutate(next);
      await this.persistRecords(next);
      this.records = next;
    });
    // A failed write is reported to its caller, but must not permanently poison
    // the queue and prevent later independent mutations from running.
    this.mutationChain = operation.catch(() => undefined);
    return operation;
  }

  async list(): Promise<ParseJobRecord[]> {
    await this.ensureLoaded();
    await this.mutationChain;
    return [...this.records.values()].map(cloneRecord);
  }

  async put(record: ParseJobRecord): Promise<void> {
    await this.enqueueMutation((next) => {
      next.set(record.id, cloneRecord(record));
    });
  }

  async delete(id: string): Promise<void> {
    await this.enqueueMutation((next) => {
      next.delete(id);
    });
  }
}
