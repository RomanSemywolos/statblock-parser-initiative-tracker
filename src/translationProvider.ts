export type TranslationLanguage = "en" | "uk";

export type TranslationRequest = {
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  texts: string[];
};

export type TranslationResult = {
  texts: string[];
  elapsedMs: number;
};

export type TranslationProviderHealth = {
  ok: boolean;
  detail?: string;
};

export interface TranslationProvider {
  id: string;
  displayName: string;
  providerType: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
  healthCheck(): Promise<TranslationProviderHealth>;
}

/** Test/fallback provider that preserves text exactly and performs no MT. */
export class NoopTranslationProvider implements TranslationProvider {
  readonly id = "noop-translation";
  readonly displayName = "No machine translation";
  readonly providerType = "noop";

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return { texts: [...request.texts], elapsedMs: 0 };
  }

  async healthCheck(): Promise<TranslationProviderHealth> {
    return { ok: true, detail: "Machine translation disabled." };
  }
}
