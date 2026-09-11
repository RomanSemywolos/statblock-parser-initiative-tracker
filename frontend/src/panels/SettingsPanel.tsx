import type { ChangeEvent, RefObject } from "react";
import type { AppSettings, ParserModelProfile, ParserModelProfileStatus } from "statblock-parser-core/product";
import { CUSTOM_MODEL_PROFILE_ID } from "statblock-parser-core/product";

export function SettingsPanel({
  settings,
  translationProviderUrl,
  translationProviderMode,
  customModelBaseUrl,
  customModelId,
  customModelEditing,
  modelApiKey,
  modelProfiles,
  modelProfileStatuses,
  connectionState,
  connectionMessage,
  translationConnectionState,
  translationConnectionMessage,
  libraryImportInput,
  libraryEmpty,
  onTranslationProviderUrlChange,
  onSelectTranslationProviderMode,
  onCustomModelBaseUrlChange,
  onCustomModelIdChange,
  onModelApiKeyChange,
  onSelectModelProfile,
  onSelectDefaultLanguage,
  onCheckBackend,
  onCheckTranslation,
  onSave,
  onExportLibrary,
  onImportLibraryFile,
  onExportDiagnostics,
}: {
  settings: AppSettings;
  translationProviderUrl: string;
  translationProviderMode: "deepl" | "libretranslate";
  customModelBaseUrl: string;
  customModelId: string;
  customModelEditing: boolean;
  modelApiKey: string;
  modelProfiles: ParserModelProfile[];
  modelProfileStatuses: ParserModelProfileStatus[];
  connectionState: "idle" | "checking" | "ok" | "error";
  connectionMessage: string;
  translationConnectionState: "idle" | "checking" | "ok" | "error";
  translationConnectionMessage: string;
  libraryImportInput: RefObject<HTMLInputElement | null>;
  libraryEmpty: boolean;
  onTranslationProviderUrlChange: (value: string) => void;
  onSelectTranslationProviderMode: (value: "deepl" | "libretranslate") => void;
  onCustomModelBaseUrlChange: (value: string) => void;
  onCustomModelIdChange: (value: string) => void;
  onModelApiKeyChange: (value: string) => void;
  onSelectModelProfile: (value: string) => void;
  onSelectDefaultLanguage: (value: "en" | "uk") => void;
  onCheckBackend: () => void;
  onCheckTranslation: () => void;
  onSave: () => void;
  onExportLibrary: () => void;
  onImportLibraryFile: (file: File) => void;
  onExportDiagnostics: () => void;
}) {
  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onImportLibraryFile(file);
    event.currentTarget.value = "";
  }

  const selectedProfile = modelProfileStatuses.find((profile) => profile.id === settings.activeParserModelProfileId);
  const selectedProfileUnavailable = selectedProfile?.health.ok === false;
  const selectedProfileDefinition = modelProfiles.find((profile) => profile.id === settings.activeParserModelProfileId);
  const customSelected = settings.activeParserModelProfileId === CUSTOM_MODEL_PROFILE_ID;
  const displayedModelServiceUrl = customSelected ? customModelBaseUrl : (selectedProfileDefinition?.serviceUrl ?? "—");
  const displayedModelId = customSelected ? customModelId : (selectedProfileDefinition?.model ?? "—");

  return (
    <section className="settings-panel workspace-settings" aria-label="Налаштування">
      <div className="settings-grid">
        <div className="settings-choice-stack">
          <label>
            <span>Лінгвістична модель</span>
            <select
              value={
                customSelected && customModelEditing
                  ? "__new_custom_model__"
                  : (settings.activeParserModelProfileId ?? "")
              }
              onChange={(event) => onSelectModelProfile(event.target.value)}
            >
              <option value="" disabled>
                Обрати лінгвістичну модель
              </option>
              {modelProfiles
                .filter((profile) => profile.id !== CUSTOM_MODEL_PROFILE_ID)
                .map((profile) => {
                  const status = modelProfileStatuses.find((entry) => entry.id === profile.id);
                  const suffix =
                    status === undefined
                      ? ""
                      : status.health.code === "catalog_unconfirmed"
                        ? " — підключена, ID не підтверджено каталогом"
                        : status.health.ok
                          ? " — доступна"
                          : " — недоступна";
                  return (
                    <option key={profile.id} value={profile.id}>
                      {profile.displayName}
                      {suffix}
                    </option>
                  );
                })}
              {settings.customParserModel != null && !customModelEditing && (
                <option value={CUSTOM_MODEL_PROFILE_ID}>Власна модель — {settings.customParserModel.model}</option>
              )}
              <option value="__new_custom_model__">Обрати іншу модель…</option>
            </select>
          </label>
          {customSelected && customModelEditing ? (
            <div className="settings-custom-provider settings-provider-details">
              <label>
                <span>Адреса сервісу моделі</span>
                <input
                  value={customModelBaseUrl}
                  onChange={(event) => onCustomModelBaseUrlChange(event.target.value)}
                  placeholder="https://api.groq.com/openai/v1"
                />
              </label>
              <label>
                <span>Назва / ID моделі</span>
                <input
                  value={customModelId}
                  onChange={(event) => onCustomModelIdChange(event.target.value)}
                  placeholder="qwen/qwen3.8-27b"
                />
              </label>
            </div>
          ) : (
            <div className="settings-provider-summary" aria-label="Параметри вибраної лінгвістичної моделі">
              <div>
                <span>Адреса сервісу моделі</span>
                <strong>{displayedModelServiceUrl}</strong>
              </div>
              <div>
                <span>Назва / ID моделі</span>
                <strong>{displayedModelId}</strong>
              </div>
            </div>
          )}
          {(customSelected ||
            (selectedProfileDefinition !== undefined && selectedProfileDefinition.providerType !== "ollama")) && (
            <label className="settings-api-key-field">
              <span>API-ключ</span>
              <input
                type="password"
                autoComplete="off"
                value={modelApiKey}
                onChange={(event) => onModelApiKeyChange(event.target.value)}
                placeholder="Залиште порожнім, якщо ключ уже налаштовано"
              />
            </label>
          )}
        </div>

        <label className="settings-language-choice">
          <span>Мова статблоків за замовчуванням</span>
          <select
            value={settings.defaultStatblockLanguage ?? "en"}
            onChange={(event) => onSelectDefaultLanguage(event.target.value === "uk" ? "uk" : "en")}
          >
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>

        <div className="settings-choice-stack">
          <label>
            <span>Модель для перекладу</span>
            <select
              value={translationProviderMode}
              onChange={(event) =>
                onSelectTranslationProviderMode(event.target.value === "libretranslate" ? "libretranslate" : "deepl")
              }
            >
              <option value="deepl">DeepL</option>
              <option value="libretranslate">Локальний LibreTranslate</option>
            </select>
          </label>
          {translationProviderMode === "libretranslate" && (
            <label className="settings-provider-details">
              <span>Адреса LibreTranslate</span>
              <input
                value={translationProviderUrl}
                onChange={(event) => onTranslationProviderUrlChange(event.target.value)}
                placeholder="http://localhost:5000"
              />
            </label>
          )}
        </div>
      </div>
      <div className="settings-actions settings-main-actions">
        <button type="button" onClick={onCheckBackend}>
          Перевірити лінгвістичну модель
        </button>
        <button type="button" onClick={onCheckTranslation}>
          Перевірити переклад
        </button>
        <button type="button" className="primary-button" onClick={onSave}>
          Зберегти
        </button>
        <span className="settings-spacer" />
        <button type="button" onClick={onExportLibrary} disabled={libraryEmpty}>
          Експорт бібліотеки
        </button>
        <button type="button" onClick={() => libraryImportInput.current?.click()}>
          Імпорт бібліотеки
        </button>
        <button type="button" onClick={onExportDiagnostics}>
          Експорт звітів парсера
        </button>
        <input ref={libraryImportInput} type="file" accept="application/json,.json" hidden onChange={handleImport} />
      </div>
      {connectionMessage !== "" && <div className={`connection-status ${connectionState}`}>{connectionMessage}</div>}
      {selectedProfileUnavailable && selectedProfile !== undefined && (
        <div className="model-profile-errors" role="status">
          {(() => {
            const health = selectedProfile.health;
            const explanation =
              health.code === "unauthorized"
                ? selectedProfile.providerType === "groq"
                  ? "Groq відхилив API-ключ. Перевірте ключ у налаштуваннях або зверніться до адміністратора застосунку."
                  : "Сервіс моделі відхилив API-ключ або не дав доступ до цієї моделі."
                : health.code === "rate_limited"
                  ? `Ліміт API вичерпано.${health.retryAfterSeconds === undefined ? "" : ` Повтори приблизно через ${Math.ceil(health.retryAfterSeconds)} с.`}`
                  : health.code === "model_unavailable"
                    ? "Ця модель недоступна для поточного облікового запису або сервісу."
                    : health.code === "network_error"
                      ? "Не вдалося з’єднатися із сервісом моделі."
                      : "Сервіс моделі повернув помилку.";
            return (
              <div className="error-box">
                <strong>{selectedProfile.displayName}</strong>: {explanation}
              </div>
            );
          })()}
        </div>
      )}
      {translationConnectionMessage !== "" && (
        <div className={`connection-status ${translationConnectionState}`}>
          Переклад · {translationConnectionMessage}
        </div>
      )}
      <p className="settings-note">
        Оберіть лінгвістичну модель для розбору статблоків і сервіс перекладу. Якщо сервіс недоступний, перевірте
        вибрані налаштування підключення.
      </p>
    </section>
  );
}
