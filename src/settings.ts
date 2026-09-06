export const APP_SETTINGS_FORMAT_VERSION = "app-settings-v1" as const;

export type TranslationProviderType = "deepl" | "libretranslate";

export type AppSettings = {
  formatVersion: typeof APP_SETTINGS_FORMAT_VERSION;
  backendUrl: string;
  activeParserModelProfileId: string | null;
  customParserModel?: { baseUrl: string; model: string } | null;
  translationProviderType?: TranslationProviderType;
  translationProviderUrl: string;
  defaultStatblockLanguage?: "en" | "uk";
  updatedAt: string;
};

export type CreateAppSettingsOptions = {
  backendUrl: string;
  activeParserModelProfileId?: string | null;
  customParserModel?: { baseUrl: string; model: string } | null;
  translationProviderType?: TranslationProviderType;
  translationProviderUrl?: string;
  defaultStatblockLanguage?: "en" | "uk";
  now?: string;
};

function normalizeServiceUrl(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
  return trimmed.replace(/\/+$/u, "");
}

function normalizeBackendUrl(value: string): string {
  return normalizeServiceUrl(value, "Backend URL");
}

function normalizeTranslationProviderUrl(value: string): string {
  return normalizeServiceUrl(value, "Translation provider URL");
}

export function createAppSettings(options: CreateAppSettingsOptions): AppSettings {
  return {
    formatVersion: APP_SETTINGS_FORMAT_VERSION,
    backendUrl: normalizeBackendUrl(options.backendUrl),
    activeParserModelProfileId: options.activeParserModelProfileId ?? null,
    customParserModel: options.customParserModel ?? null,
    translationProviderType: options.translationProviderType ?? "deepl",
    translationProviderUrl: normalizeTranslationProviderUrl(options.translationProviderUrl ?? "http://localhost:5000"),
    defaultStatblockLanguage: options.defaultStatblockLanguage ?? "en",
    updatedAt: options.now ?? new Date().toISOString(),
  };
}

export function updateAppSettings(
  current: AppSettings,
  patch: Partial<
    Pick<
      AppSettings,
      | "backendUrl"
      | "activeParserModelProfileId"
      | "customParserModel"
      | "translationProviderType"
      | "translationProviderUrl"
      | "defaultStatblockLanguage"
    >
  >,
  now = new Date().toISOString(),
): AppSettings {
  // Rebuild the persisted shape explicitly instead of spreading `current`.
  // Older IndexedDB records may still contain the removed parserMode setting;
  // rebuilding here drops that legacy property the next time settings are saved.
  return {
    formatVersion: APP_SETTINGS_FORMAT_VERSION,
    backendUrl: patch.backendUrl === undefined ? current.backendUrl : normalizeBackendUrl(patch.backendUrl),
    activeParserModelProfileId:
      patch.activeParserModelProfileId === undefined
        ? current.activeParserModelProfileId
        : patch.activeParserModelProfileId,
    customParserModel:
      patch.customParserModel === undefined ? (current.customParserModel ?? null) : patch.customParserModel,
    translationProviderType:
      patch.translationProviderType === undefined
        ? (current.translationProviderType ?? "deepl")
        : patch.translationProviderType,
    translationProviderUrl:
      patch.translationProviderUrl === undefined
        ? normalizeTranslationProviderUrl(current.translationProviderUrl ?? "http://localhost:5000")
        : normalizeTranslationProviderUrl(patch.translationProviderUrl),
    defaultStatblockLanguage:
      patch.defaultStatblockLanguage === undefined
        ? (current.defaultStatblockLanguage ?? "en")
        : patch.defaultStatblockLanguage,
    updatedAt: now,
  };
}
