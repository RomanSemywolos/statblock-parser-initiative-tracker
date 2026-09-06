import type {
  TranslationProvider,
  TranslationProviderHealth,
  TranslationRequest,
  TranslationResult,
} from "./translationProvider.js";

export type LibreTranslateProviderOptions = {
  baseUrl: string;
  apiKey?: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type LibreLanguage = {
  code?: unknown;
  targets?: unknown;
};

type LibreTranslateResponse = {
  translatedText?: unknown;
};

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error("Translation provider URL cannot be empty.");
  return trimmed.replace(/\/+$/u, "");
}

export class LibreTranslateProvider implements TranslationProvider {
  readonly id = "libretranslate";
  readonly displayName = "LibreTranslate";
  readonly providerType = "libretranslate";

  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LibreTranslateProviderOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey?.trim() || null;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    // Window.fetch is a Web API method and must retain its Window receiver in some browsers.
    // Calling a detached reference can throw: Failed to execute 'fetch' on 'Window': Illegal invocation.
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
      if (controller.signal.aborted) {
        throw new Error(`LibreTranslate request timed out after ${this.timeoutMs} ms.`);
      }
      throw caught;
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<TranslationProviderHealth> {
    try {
      const response = await this.request("/languages");
      if (!response.ok) {
        return { ok: false, detail: `LibreTranslate returned HTTP ${response.status}.` };
      }
      const value = (await response.json()) as unknown;
      if (!Array.isArray(value)) {
        return { ok: false, detail: "LibreTranslate returned an invalid languages response." };
      }
      const languages = value as LibreLanguage[];
      const english = languages.find((entry) => entry.code === "en");
      const ukrainian = languages.find((entry) => entry.code === "uk");
      const englishTargets = Array.isArray(english?.targets) ? english.targets : [];
      if (english === undefined || ukrainian === undefined || !englishTargets.includes("uk")) {
        return { ok: false, detail: "LibreTranslate does not report EN→UK support." };
      }
      return { ok: true, detail: "LibreTranslate EN→UK is available." };
    } catch (caught) {
      return { ok: false, detail: caught instanceof Error ? caught.message : String(caught) };
    }
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const startedAt = Date.now();
    const texts: string[] = [];

    for (const text of request.texts) {
      if (text.length === 0) {
        texts.push("");
        continue;
      }
      const payload: Record<string, unknown> = {
        q: text,
        source: request.sourceLanguage,
        target: request.targetLanguage,
        format: "text",
      };
      if (this.apiKey !== null) payload.api_key = this.apiKey;

      const response = await this.request("/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `LibreTranslate translation failed with HTTP ${response.status}${detail === "" ? "" : `: ${detail}`}`,
        );
      }
      const value = (await response.json()) as LibreTranslateResponse;
      if (typeof value.translatedText !== "string") {
        throw new Error("LibreTranslate returned an invalid translation response.");
      }
      texts.push(value.translatedText);
    }

    return { texts, elapsedMs: Date.now() - startedAt };
  }
}
