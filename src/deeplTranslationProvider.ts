import type {
  TranslationLanguage,
  TranslationProvider,
  TranslationProviderHealth,
  TranslationRequest,
  TranslationResult,
} from "./translationProvider.js";

export type DeepLTranslationProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type DeepLLanguage = {
  language?: unknown;
  name?: unknown;
};

type DeepLTranslationResponse = {
  translations?: unknown;
};

type DeepLTranslationEntry = {
  text?: unknown;
};

function normalizeApiKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error("DeepL API key cannot be empty.");
  return trimmed;
}

function defaultBaseUrl(apiKey: string): string {
  return apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error("DeepL base URL cannot be empty.");
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("DeepL base URL must use http or https.");
  }
  return trimmed.replace(/\/+$/u, "");
}

function deepLLanguage(language: TranslationLanguage): string {
  if (language === "en") return "EN";
  if (language === "uk") return "UK";
  const exhaustive: never = language;
  return exhaustive;
}

export class DeepLTranslationProvider implements TranslationProvider {
  readonly id = "deepl";
  readonly displayName = "DeepL API";
  readonly providerType = "deepl";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DeepLTranslationProviderOptions) {
    this.apiKey = normalizeApiKey(options.apiKey);
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? defaultBaseUrl(this.apiKey));
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(this.url(path), {
        ...init,
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
          ...(init?.headers ?? {}),
        },
        signal: controller.signal,
      });
    } catch (caught) {
      if (controller.signal.aborted) {
        throw new Error(`DeepL request timed out after ${this.timeoutMs} ms.`);
      }
      throw caught;
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<TranslationProviderHealth> {
    try {
      const response = await this.request("/v2/languages?type=target");
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return {
          ok: false,
          detail: `DeepL returned HTTP ${response.status}${detail === "" ? "" : `: ${detail}`}`,
        };
      }
      const value = (await response.json()) as unknown;
      if (!Array.isArray(value)) {
        return { ok: false, detail: "DeepL returned an invalid languages response." };
      }
      const supportsUkrainian = (value as DeepLLanguage[]).some((entry) => entry.language === "UK");
      if (!supportsUkrainian) {
        return { ok: false, detail: "DeepL does not report Ukrainian as a target language." };
      }
      return { ok: true, detail: "DeepL EN→UK is available through the backend." };
    } catch (caught) {
      return { ok: false, detail: caught instanceof Error ? caught.message : String(caught) };
    }
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const startedAt = Date.now();
    const result = Array<string>(request.texts.length).fill("");
    const nonEmpty: Array<{ index: number; text: string }> = [];
    for (let index = 0; index < request.texts.length; index += 1) {
      const text = request.texts[index] ?? "";
      if (text.length > 0) nonEmpty.push({ index, text });
    }
    if (nonEmpty.length === 0) return { texts: result, elapsedMs: Date.now() - startedAt };

    const response = await this.request("/v2/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: nonEmpty.map((entry) => entry.text),
        source_lang: deepLLanguage(request.sourceLanguage),
        target_lang: deepLLanguage(request.targetLanguage),
        preserve_formatting: true,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`DeepL translation failed with HTTP ${response.status}${detail === "" ? "" : `: ${detail}`}`);
    }

    const value = (await response.json()) as DeepLTranslationResponse;
    if (!Array.isArray(value.translations) || value.translations.length !== nonEmpty.length) {
      throw new Error("DeepL returned an invalid translation response.");
    }
    for (let index = 0; index < nonEmpty.length; index += 1) {
      const translated = (value.translations[index] as DeepLTranslationEntry | undefined)?.text;
      if (typeof translated !== "string") throw new Error("DeepL returned an invalid translation response.");
      result[nonEmpty[index]!.index] = translated;
    }

    return { texts: result, elapsedMs: Date.now() - startedAt };
  }
}
