import { useEffect, useMemo, useRef, useState } from "react";
import {
  CUSTOM_MODEL_PROFILE_ID,
  HttpBackendTranslationProvider,
  HttpParserBackendApi,
  LibreTranslateProvider,
  createAppSettings,
  updateAppSettings,
  type ParserModelProfile,
  type ParserModelProfileStatus,
  type SettingsRepository,
} from "statblock-parser-core/product";
import { defaultBackendUrl, defaultTranslationProviderUrl } from "../appDefaults";
import { translationServiceName, userFacingParserError, userFacingTranslationError } from "../userMessages";

type ConnectionState = "idle" | "checking" | "ok" | "error";

export function useSettingsController(repository: SettingsRepository, reportError: (error: unknown) => void) {
  const [settings, setSettings] = useState(() =>
    createAppSettings({ backendUrl: defaultBackendUrl(), translationProviderUrl: defaultTranslationProviderUrl() }),
  );
  const [backendStatus, setBackendStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [modelProfileStatuses, setModelProfileStatuses] = useState<ParserModelProfileStatus[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsBackendUrl, setSettingsBackendUrl] = useState(defaultBackendUrl());
  const [settingsTranslationProviderUrl, setSettingsTranslationProviderUrl] = useState(defaultTranslationProviderUrl());
  const [settingsTranslationProviderMode, setSettingsTranslationProviderMode] = useState<"deepl" | "libretranslate">(
    "deepl",
  );
  const [settingsCustomModelBaseUrl, setSettingsCustomModelBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [settingsCustomModelId, setSettingsCustomModelId] = useState("");
  const [settingsCustomModelEditing, setSettingsCustomModelEditing] = useState(false);
  const [settingsModelApiKey, setSettingsModelApiKey] = useState("");
  const [settingsModelProfileId, setSettingsModelProfileId] = useState<string | null>(null);
  const [settingsDefaultStatblockLanguage, setSettingsDefaultStatblockLanguage] = useState<"en" | "uk">("en");
  const [translationConnectionState, setTranslationConnectionState] = useState<ConnectionState>("idle");
  const [translationConnectionMessage, setTranslationConnectionMessage] = useState("");
  const [modelProfiles, setModelProfiles] = useState<ParserModelProfile[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [settingsGuardOpen, setSettingsGuardOpen] = useState(false);
  const pendingSettingsActionRef = useRef<(() => void) | null>(null);

  const settingsDraftDirty = useMemo(() => {
    const draftCustom =
      settingsCustomModelBaseUrl.trim() !== "" && settingsCustomModelId.trim() !== ""
        ? { baseUrl: settingsCustomModelBaseUrl.trim().replace(/\/+$/u, ""), model: settingsCustomModelId.trim() }
        : null;
    return (
      settingsBackendUrl !== settings.backendUrl ||
      settingsTranslationProviderMode !== (settings.translationProviderType ?? "deepl") ||
      settingsTranslationProviderUrl !== settings.translationProviderUrl ||
      settingsModelProfileId !== settings.activeParserModelProfileId ||
      settingsDefaultStatblockLanguage !== (settings.defaultStatblockLanguage ?? "en") ||
      JSON.stringify(draftCustom) !== JSON.stringify(settings.customParserModel ?? null) ||
      settingsModelApiKey.trim() !== ""
    );
  }, [
    settings,
    settingsBackendUrl,
    settingsTranslationProviderMode,
    settingsTranslationProviderUrl,
    settingsModelProfileId,
    settingsDefaultStatblockLanguage,
    settingsCustomModelBaseUrl,
    settingsCustomModelId,
    settingsModelApiKey,
  ]);

  useEffect(() => {
    void repository
      .get()
      .then((stored) => {
        if (stored === undefined) {
          void repository.put(
            createAppSettings({
              backendUrl: defaultBackendUrl(),
              translationProviderUrl: defaultTranslationProviderUrl(),
            }),
          );
          return;
        }
        const needsMigration =
          stored.defaultStatblockLanguage === undefined ||
          stored.translationProviderUrl === undefined ||
          stored.translationProviderType === undefined;
        const normalized = needsMigration
          ? updateAppSettings(
              stored,
              {
                defaultStatblockLanguage: stored.defaultStatblockLanguage ?? "en",
                translationProviderType: stored.translationProviderType ?? "deepl",
                translationProviderUrl: stored.translationProviderUrl ?? defaultTranslationProviderUrl(),
              },
              stored.updatedAt,
            )
          : stored;
        if (needsMigration) void repository.put(normalized);
        setSettings(normalized);
        setSettingsBackendUrl(normalized.backendUrl);
        setSettingsTranslationProviderUrl(normalized.translationProviderUrl);
        setSettingsTranslationProviderMode(normalized.translationProviderType ?? "deepl");
        setSettingsCustomModelBaseUrl(normalized.customParserModel?.baseUrl ?? "https://api.groq.com/openai/v1");
        setSettingsCustomModelId(normalized.customParserModel?.model ?? "");
        setSettingsModelProfileId(normalized.activeParserModelProfileId);
        setSettingsDefaultStatblockLanguage(normalized.defaultStatblockLanguage ?? "en");
      })
      .catch(reportError);
  }, [reportError, repository]);

  async function configureCustomModel(api: HttpParserBackendApi) {
    const baseUrl = settingsCustomModelBaseUrl.trim();
    const model = settingsCustomModelId.trim();
    if (baseUrl === "" || model === "") {
      throw new Error("Для власної лінгвістичної моделі заповніть адресу сервісу і назву / ID моделі.");
    }
    return api.configureCustomModelProfile({
      baseUrl,
      model,
      ...(settingsModelApiKey.trim() === "" ? {} : { apiKey: settingsModelApiKey.trim() }),
    });
  }

  async function loadModelProfiles(candidateUrl = settingsBackendUrl) {
    try {
      const profiles = await new HttpParserBackendApi(candidateUrl.trim()).listModelProfiles();
      setModelProfiles(profiles);
      return profiles;
    } catch {
      return [];
    }
  }

  async function checkBackendConnection(candidateUrl = settingsBackendUrl) {
    setConnectionState("checking");
    setConnectionMessage("Перевірка…");
    try {
      const api = new HttpParserBackendApi(candidateUrl.trim());
      const health = await api.healthCheck();
      if (settingsModelProfileId === CUSTOM_MODEL_PROFILE_ID) await configureCustomModel(api);
      else if (settingsModelApiKey.trim() !== "" && settingsModelProfileId !== null) {
        await api.configureModelProfileCredential({
          profileId: settingsModelProfileId,
          apiKey: settingsModelApiKey.trim(),
        });
      }
      const statuses = await api.checkModelProfiles();
      const profiles: ParserModelProfile[] = statuses.map(({ health: _health, ...profile }) => profile);
      setModelProfiles(profiles);
      setModelProfileStatuses(statuses);
      setBackendStatus("online");
      setConnectionState("ok");
      const selected = statuses.find((profile) => profile.id === (settingsModelProfileId ?? health.activeProfileId));
      setConnectionMessage(
        selected === undefined
          ? "Система розбору працює. Оберіть лінгвістичну модель."
          : selected.health.ok
            ? `Лінгвістична модель доступна: ${selected.displayName}`
            : `Система розбору працює, але вибрана модель недоступна: ${selected.displayName}`,
      );
      return { health, profiles, statuses };
    } catch (caught) {
      setModelProfiles([]);
      setModelProfileStatuses([]);
      setBackendStatus("offline");
      setConnectionState("error");
      setConnectionMessage(userFacingParserError(caught instanceof Error ? caught.message : String(caught)));
      return null;
    }
  }

  function setTranslationProviderConnectionIdle() {
    setTranslationConnectionState("idle");
    setTranslationConnectionMessage("");
  }

  async function checkTranslationConnection(candidateUrl = settingsTranslationProviderUrl) {
    setTranslationConnectionState("checking");
    setTranslationConnectionMessage("Перевірка…");
    const provider =
      settingsTranslationProviderMode === "deepl"
        ? new HttpBackendTranslationProvider({ baseUrl: settingsBackendUrl.trim() })
        : new LibreTranslateProvider({ baseUrl: candidateUrl.trim() });
    const health = await provider.healthCheck();
    const serviceName = translationServiceName(settingsTranslationProviderMode);
    setTranslationConnectionState(health.ok ? "ok" : "error");
    setTranslationConnectionMessage(
      health.ok ? `${serviceName} готовий до роботи.` : userFacingTranslationError(health.detail ?? "", serviceName),
    );
    return health;
  }

  async function saveSettings(): Promise<boolean> {
    try {
      const connection = await checkBackendConnection(settingsBackendUrl);
      const requested = settingsModelProfileId;
      const profileId =
        requested !== null && connection?.profiles.some((profile) => profile.id === requested)
          ? requested
          : (connection?.health.activeProfileId ?? requested);
      const next = updateAppSettings(settings, {
        backendUrl: settingsBackendUrl,
        activeParserModelProfileId: profileId,
        customParserModel:
          settingsCustomModelBaseUrl.trim() !== "" && settingsCustomModelId.trim() !== ""
            ? { baseUrl: settingsCustomModelBaseUrl.trim().replace(/\/+$/u, ""), model: settingsCustomModelId.trim() }
            : null,
        translationProviderType: settingsTranslationProviderMode,
        translationProviderUrl: settingsTranslationProviderUrl,
        defaultStatblockLanguage: settingsDefaultStatblockLanguage,
      });
      await repository.put(next);
      setSettings(next);
      setSettingsBackendUrl(next.backendUrl);
      setSettingsTranslationProviderUrl(next.translationProviderUrl);
      setSettingsTranslationProviderMode(next.translationProviderType ?? "deepl");
      setSettingsCustomModelBaseUrl(next.customParserModel?.baseUrl ?? "https://api.groq.com/openai/v1");
      setSettingsCustomModelId(next.customParserModel?.model ?? "");
      setSettingsCustomModelEditing(false);
      setSettingsModelProfileId(next.activeParserModelProfileId);
      setSettingsDefaultStatblockLanguage(next.defaultStatblockLanguage ?? "en");
      setSettingsModelApiKey("");
      return true;
    } catch (caught) {
      setConnectionState("error");
      setConnectionMessage(userFacingParserError(caught instanceof Error ? caught.message : String(caught)));
      return false;
    }
  }

  function selectModelProfile(profileId: string) {
    const isNewCustom = profileId === "__new_custom_model__";
    setSettingsModelProfileId(isNewCustom ? CUSTOM_MODEL_PROFILE_ID : profileId || null);
    setSettingsCustomModelEditing(isNewCustom);
    if (isNewCustom && settings.customParserModel === null) {
      setSettingsCustomModelBaseUrl("");
      setSettingsCustomModelId("");
    }
    setSettingsModelApiKey("");
    setConnectionState("idle");
    setConnectionMessage("");
  }

  function resetSettingsDraft() {
    setSettingsBackendUrl(settings.backendUrl);
    setSettingsTranslationProviderUrl(settings.translationProviderUrl);
    setSettingsTranslationProviderMode(settings.translationProviderType ?? "deepl");
    setSettingsCustomModelBaseUrl(settings.customParserModel?.baseUrl ?? "https://api.groq.com/openai/v1");
    setSettingsCustomModelId(settings.customParserModel?.model ?? "");
    setSettingsCustomModelEditing(false);
    setSettingsModelProfileId(settings.activeParserModelProfileId);
    setSettingsDefaultStatblockLanguage(settings.defaultStatblockLanguage ?? "en");
    setSettingsModelApiKey("");
    setConnectionState("idle");
    setConnectionMessage("");
    setTranslationProviderConnectionIdle();
  }

  function requestOutsideSettingsAction(action: () => void) {
    if (!showSettings) return action();
    if (!settingsDraftDirty) {
      setShowSettings(false);
      return action();
    }
    pendingSettingsActionRef.current = action;
    setSettingsGuardOpen(true);
  }

  function continuePendingSettingsAction() {
    const action = pendingSettingsActionRef.current;
    pendingSettingsActionRef.current = null;
    setSettingsGuardOpen(false);
    setShowSettings(false);
    action?.();
  }

  async function saveAndContinuePendingSettingsAction() {
    if (await saveSettings()) continuePendingSettingsAction();
  }

  function discardAndContinuePendingSettingsAction() {
    resetSettingsDraft();
    continuePendingSettingsAction();
  }

  function stayInSettings() {
    pendingSettingsActionRef.current = null;
    setSettingsGuardOpen(false);
  }

  return {
    settings,
    backendStatus,
    setBackendStatus,
    modelProfileStatuses,
    setModelProfileStatuses,
    showSettings,
    setShowSettings,
    settingsBackendUrl,
    setSettingsBackendUrl,
    settingsTranslationProviderUrl,
    setSettingsTranslationProviderUrl,
    settingsTranslationProviderMode,
    setSettingsTranslationProviderMode,
    settingsCustomModelBaseUrl,
    setSettingsCustomModelBaseUrl,
    settingsCustomModelId,
    setSettingsCustomModelId,
    settingsCustomModelEditing,
    settingsModelApiKey,
    setSettingsModelApiKey,
    settingsModelProfileId,
    settingsDefaultStatblockLanguage,
    translationConnectionState,
    translationConnectionMessage,
    modelProfiles,
    connectionState,
    setConnectionState,
    connectionMessage,
    setConnectionMessage,
    settingsGuardOpen,
    settingsDraftDirty,
    loadModelProfiles,
    checkBackendConnection,
    setTranslationProviderConnectionIdle,
    checkTranslationConnection,
    saveSettings,
    selectModelProfile,
    selectDefaultStatblockLanguage: setSettingsDefaultStatblockLanguage,
    resetSettingsDraft,
    requestOutsideSettingsAction,
    saveAndContinuePendingSettingsAction,
    discardAndContinuePendingSettingsAction,
    stayInSettings,
  };
}
