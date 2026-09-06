import type {
  TranslationProvider,
  TranslationProviderHealth,
  TranslationRequest,
  TranslationResult,
} from "./translationProvider.js";

export type HttpBackendTranslationProviderOptions = {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type HealthResponse = {
  health?: unknown;
};

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error("Backend URL cannot be empty.");
  return trimmed.replace(/\/+$/u, "");
}

export class HttpBackendTranslationProvider implements TranslationProvider {
  readonly id = "backend-deepl";
  readonly displayName = "DeepL API (backend)";
  readonly providerType = "backend-deepl";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpBackendTranslationProviderOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? 25_000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(this.url(path), { ...init, signal: controller.signal });
    } catch (caught) {
      if (controller.signal.aborted) throw new Error(`Translation backend timed out after ${this.timeoutMs} ms.`);
      throw caught;
    } finally {
      clearTimeout(timer);
    }
  }

  private async errorMessage(response: Response, fallback: string): Promise<string> {
    try {
      const value = (await response.json()) as { error?: unknown };
      if (typeof value.error === "string" && value.error.trim() !== "") return value.error;
    } catch {
      // Use the stable fallback below.
    }
    return `${fallback} (HTTP ${response.status}).`;
  }

  async healthCheck(): Promise<TranslationProviderHealth> {
    try {
      const response = await this.request("/api/translation/health");
      if (!response.ok)
        return { ok: false, detail: await this.errorMessage(response, "Translation health check failed") };
      const value = (await response.json()) as HealthResponse;
      if (
        typeof value.health !== "object" ||
        value.health === null ||
        typeof (value.health as { ok?: unknown }).ok !== "boolean"
      ) {
        return { ok: false, detail: "Backend returned an invalid translation health response." };
      }
      const health = value.health as { ok: boolean; detail?: unknown };
      return {
        ok: health.ok,
        ...(typeof health.detail === "string" ? { detail: health.detail } : {}),
      };
    } catch (caught) {
      return { ok: false, detail: caught instanceof Error ? caught.message : String(caught) };
    }
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const response = await this.request("/api/translation", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(await this.errorMessage(response, "Translation request failed"));
    const value = (await response.json()) as Partial<TranslationResult>;
    if (
      !Array.isArray(value.texts) ||
      !value.texts.every((entry) => typeof entry === "string") ||
      typeof value.elapsedMs !== "number"
    ) {
      throw new Error("Backend returned an invalid translation response.");
    }
    return { texts: value.texts, elapsedMs: value.elapsedMs };
  }
}
