import type { ParseJobResult, ParseJobSummary } from "./parseJobs.js";
import type { ParserMode } from "./parserRouting.js";

export interface ParseJobsApi {
  submit(
    source: string,
    modelProfileId?: string | null,
    parserMode?: ParserMode,
    statblockId?: string | null,
  ): Promise<ParseJobSummary>;
  list(): Promise<ParseJobSummary[]>;
  get(id: string): Promise<ParseJobSummary>;
  getResult(id: string): Promise<ParseJobResult>;
  retry(id: string): Promise<ParseJobSummary>;
  delete(id: string): Promise<void>;
  exportDiagnostics(): Promise<unknown>;
}

export type HttpParseJobsApiOptions = {
  backendUrl: string;
  /** Routing identifier for this browser installation; not an authentication credential. */
  clientId: string;
};

export class HttpParseJobsApi implements ParseJobsApi {
  private readonly backendUrl: string;
  private readonly clientId: string;

  constructor(options: HttpParseJobsApiOptions) {
    this.backendUrl = options.backendUrl.replace(/\/+$/u, "");
    this.clientId = options.clientId;
  }

  private url(path: string): string {
    const separator = path.includes("?") ? "&" : "?";
    return `${this.backendUrl}${path}${separator}clientId=${encodeURIComponent(this.clientId)}`;
  }

  private async json<T>(response: Response): Promise<T> {
    const value = (await response.json()) as T | { error?: string };
    if (!response.ok) {
      const message =
        typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
          ? value.error
          : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return value as T;
  }

  async submit(
    source: string,
    modelProfileId?: string | null,
    parserMode: ParserMode = "auto",
    statblockId?: string | null,
  ): Promise<ParseJobSummary> {
    return this.json(
      await fetch(this.url("/api/parse-jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
        body: JSON.stringify({
          source,
          modelProfileId: modelProfileId ?? null,
          parserMode,
          statblockId: statblockId ?? null,
        }),
      }),
    );
  }

  async list(): Promise<ParseJobSummary[]> {
    const response = await this.json<{ jobs: ParseJobSummary[] }>(await fetch(this.url("/api/parse-jobs")));
    return response.jobs;
  }

  async get(id: string): Promise<ParseJobSummary> {
    return this.json(await fetch(this.url(`/api/parse-jobs/${encodeURIComponent(id)}`)));
  }

  async getResult(id: string): Promise<ParseJobResult> {
    return this.json(await fetch(this.url(`/api/parse-jobs/${encodeURIComponent(id)}/result`)));
  }

  async retry(id: string): Promise<ParseJobSummary> {
    return this.json(
      await fetch(this.url(`/api/parse-jobs/${encodeURIComponent(id)}/retry`), {
        method: "POST",
        headers: { "X-Statblock-Client": "statblock-parser" },
      }),
    );
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(this.url(`/api/parse-jobs/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: { "X-Statblock-Client": "statblock-parser" },
    });
    if (!response.ok) await this.json(response);
  }

  async exportDiagnostics(): Promise<unknown> {
    return this.json(await fetch(this.url("/api/parse-reports/export")));
  }
}
