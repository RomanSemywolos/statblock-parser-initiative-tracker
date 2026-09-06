import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IndexedDbEncounterRepository,
  IndexedDbSettingsRepository,
  IndexedDbStatblockRepository,
  HttpBackendTranslationProvider,
  LibreTranslateProvider,
  createOrReplaceSavedStatblockUkrainian,
  compareSavedStatblocksByName,
  removeCombatantsForStatblock,
  restoreSavedStatblockEnglishBackupToWorking,
  restoreSavedStatblockUkrainianBackupToWorking,
  revertSavedStatblockEnglishWorking,
  revertSavedStatblockUkrainianWorking,
  saveSavedStatblockEnglish,
  saveSavedStatblockUkrainian,
  updateSavedStatblockCardConfig,
  updateSavedStatblockEnglishWorking,
  updateSavedStatblockUkrainianWorking,
  translateEditableStatblockWithProvider,
  updateStatblockCombatantCard,
  updateStubCombatant,
  type EditableStatblockDocument,
  type EncounterRepository,
  type ProductAbilityKey,
  type SavedStatblock,
  type StatblockRepository,
} from "statblock-parser-core/product";
import {
  combatantDisplayName,
  resolveOpenedCardConfig,
  resolveOpenedCombatant,
  resolveOpenedDocument,
  resolveOpenedStatblock,
  type OpenedEntity,
} from "./openedEntity";
import { createStatblockAutosaveCoordinator } from "./persistenceOrchestration";
import { CombatHpControls, StubCombatantEditor, StubCombatantView } from "./EncounterViews";
import { CardConfigEditor, StatblockEditor, StatblockView } from "./StatblockViews";
import { downloadLibraryExport, downloadParserDiagnostics, readLibraryImport } from "./fileTransfers";
import { EncounterSidebar, ImportWorkspace, LibrarySidebar, SettingsPanel, StatblockCardControls } from "./AppPanels";
import { translationServiceName, userFacingTranslationError } from "./userMessages";
import { hydrateEncounterState } from "./encounterHydration";
import { formatRollDetails, useDiceRoller } from "./hooks/useDiceRoller";
import { useEncounterController } from "./hooks/useEncounterController";
import { useSettingsController } from "./hooks/useSettingsController";
import { useParseJobsController } from "./hooks/useParseJobsController";
import { defaultTranslationProviderUrl, getOrCreateClientId } from "./appDefaults";

const statblockRepository: StatblockRepository = new IndexedDbStatblockRepository();
const encounterRepository: EncounterRepository = new IndexedDbEncounterRepository();
const settingsRepository = new IndexedDbSettingsRepository();

const AUTOSAVE_DELAY_MS = 350;

function documentsEqual(left: EditableStatblockDocument, right: EditableStatblockDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
function sortLibrary(values: SavedStatblock[]): SavedStatblock[] {
  return [...values].sort(compareSavedStatblocksByName);
}

function mergeLibraryPreservingOrder(
  current: readonly SavedStatblock[],
  incoming: readonly SavedStatblock[],
): SavedStatblock[] {
  const incomingById = new Map(incoming.map((entry) => [entry.id, entry]));
  const retained = current
    .map((entry) => incomingById.get(entry.id))
    .filter((entry): entry is SavedStatblock => entry !== undefined);
  const retainedIds = new Set(retained.map((entry) => entry.id));
  const added = sortLibrary(incoming.filter((entry) => !retainedIds.has(entry.id)));
  return [...retained, ...added];
}

export function App() {
  const [library, setLibrary] = useState<SavedStatblock[]>([]);
  const [opened, setOpened] = useState<OpenedEntity>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientId] = useState(getOrCreateClientId);
  const [editing, setEditing] = useState(false);
  const [libraryLanguage, setLibraryLanguage] = useState<"en" | "uk">("en");
  const [translationMessage, setTranslationMessage] = useState<string | null>(null);
  const [configuringCard, setConfiguringCard] = useState(false);
  const [cardControlsOpen, setCardControlsOpen] = useState(false);
  const {
    rollInput,
    setRollInput,
    rollError,
    setRollError,
    rollHistory,
    rollSequence,
    performRoll,
    rollInputExpression,
  } = useDiceRoller();
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const reportError = useCallback((caught: unknown) => {
    setError(caught instanceof Error ? caught.message : String(caught));
  }, []);
  const {
    settings,
    backendStatus,
    setBackendStatus,
    modelProfileStatuses,
    showSettings,
    setShowSettings,
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
    selectDefaultStatblockLanguage,
    resetSettingsDraft,
    requestOutsideSettingsAction,
    saveAndContinuePendingSettingsAction,
    discardAndContinuePendingSettingsAction,
    stayInSettings,
  } = useSettingsController(settingsRepository, reportError);
  const statblockAutosave = useMemo(
    () => createStatblockAutosaveCoordinator(statblockRepository, AUTOSAVE_DELAY_MS, reportError),
    [reportError],
  );
  const libraryImportInput = useRef<HTMLInputElement | null>(null);

  const libraryById = useMemo(() => new Map(library.map((entry) => [entry.id, entry])), [library]);
  const {
    encounter,
    setEncounter,
    persistEncounter,
    addToEncounter,
    createStub,
    changeCombatantHp,
    changeLimitedUse,
    rollInitiative,
    changeInitiative,
    changeStubCombatant,
    beginCombat,
    nextCombatant,
    finishCombat,
    removeFromEncounter,
    dragOverEncounter,
    allowEncounterDrop,
    leaveEncounterDrop,
    dropOnEncounter,
    showStubForm,
    setShowStubForm,
    stubName,
    setStubName,
    stubHp,
    setStubHp,
    stubAc,
    setStubAc,
    stubInitiative,
    setStubInitiative,
    stubSaves,
    setStubSaves,
  } = useEncounterController({
    repository: encounterRepository,
    autosaveDelayMs: AUTOSAVE_DELAY_MS,
    libraryById,
    opened,
    setOpened,
    reportError,
    performRoll,
  });

  const openedCombatant = useMemo(() => resolveOpenedCombatant(opened, encounter), [opened, encounter]);

  const openedStatblock = useMemo(
    () => resolveOpenedStatblock(opened, openedCombatant, libraryById),
    [opened, openedCombatant, libraryById],
  );

  const {
    api: parseJobsApi,
    parseJobs,
    parseJobError,
    setParseJobError,
    showImportForm,
    setShowImportForm,
    importText,
    setImportText,
    importParserMode,
    setImportParserMode,
    reparseParserMode,
    setReparseParserMode,
    reparseBusy,
    deletionLockedStatblockIds,
    submitImport,
    submitReparse,
    retryParseJob,
    dismissParseJob,
  } = useParseJobsController({
    repository: statblockRepository,
    settings,
    clientId,
    openedStatblock: opened?.kind === "library" ? openedStatblock : null,
    setLibrary,
    setBackendStatus,
  });

  const openedDocument = useMemo(
    () => resolveOpenedDocument(opened, openedCombatant, openedStatblock, libraryLanguage),
    [opened, openedStatblock, openedCombatant, libraryLanguage],
  );

  const openedCardConfig = useMemo(
    () => resolveOpenedCardConfig(opened, openedCombatant, openedStatblock),
    [opened, openedStatblock, openedCombatant],
  );

  const openedTitle = useMemo(() => {
    if (opened?.kind === "combatant" && openedCombatant !== null && encounter !== null) {
      return combatantDisplayName(openedCombatant, encounter, openedDocument);
    }
    return openedDocument?.facts.name ?? "Статблок не відкрито";
  }, [opened, openedCombatant, openedDocument, encounter]);

  const activeLibraryVersion =
    opened?.kind !== "library" || openedStatblock === null
      ? null
      : libraryLanguage === "uk"
        ? (openedStatblock.versions.uk ?? null)
        : openedStatblock.versions.en;
  const workingDiffersFromSaved =
    activeLibraryVersion === null ? false : !documentsEqual(activeLibraryVersion.working, activeLibraryVersion.saved);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [values, storedEncounter] = await Promise.all([statblockRepository.list(), encounterRepository.get()]);
      const validIds = new Set(values.map((entry) => entry.id));
      const { encounter: cleanedEncounter, changed: encounterChanged } = hydrateEncounterState(storedEncounter, values);
      if (encounterChanged) {
        await encounterRepository.put(cleanedEncounter);
      }

      setLibrary((current) => mergeLibraryPreservingOrder(current, values));
      setEncounter(cleanedEncounter);
      setOpened((current) => {
        if (current?.kind === "library" && validIds.has(current.statblockId)) return current;
        if (
          current?.kind === "combatant" &&
          cleanedEncounter.combatants.some((entry) => entry.id === current.combatantId)
        )
          return current;
        return values[0] === undefined ? null : { kind: "library", statblockId: values[0].id };
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [setEncounter]);

  useEffect(() => {
    void refresh();
    return () => {
      statblockAutosave.dispose();
    };
  }, [refresh, statblockAutosave]);

  const openedEntityKey =
    opened?.kind === "library"
      ? `library:${opened.statblockId}`
      : opened?.kind === "combatant"
        ? `combatant:${opened.combatantId}`
        : null;
  const openedLibraryId = opened?.kind === "library" ? opened.statblockId : null;
  const openedHasUkrainian = openedLibraryId !== null && openedStatblock?.versions.uk !== undefined;
  const openedImportedParserMode = openedLibraryId === null ? null : (openedStatblock?.importedParserMode ?? "auto");

  useEffect(() => {
    setEditing(false);
    setConfiguringCard(false);
    setCardControlsOpen(false);
    const preferred = settings.defaultStatblockLanguage ?? "en";
    setLibraryLanguage(preferred === "uk" && openedHasUkrainian ? "uk" : "en");
    setTranslationMessage(null);
  }, [openedEntityKey, openedHasUkrainian, settings.defaultStatblockLanguage]);

  useEffect(() => {
    if (openedLibraryId === null) {
      setReparseParserMode("auto");
      return;
    }
    setReparseParserMode(openedImportedParserMode ?? "auto");
    if (libraryLanguage === "uk" && !openedHasUkrainian) setLibraryLanguage("en");
  }, [libraryLanguage, openedHasUkrainian, openedImportedParserMode, openedLibraryId, setReparseParserMode]);

  function replaceLibraryEntry(next: SavedStatblock) {
    setLibrary((current) => {
      const index = current.findIndex((entry) => entry.id === next.id);
      if (index < 0) return [...current, next];
      const updated = [...current];
      updated[index] = next;
      return updated;
    });
  }

  function cancelPendingAutosave(statblockId: string) {
    statblockAutosave.cancel(statblockId);
  }

  function autosaveWorking(next: SavedStatblock) {
    replaceLibraryEntry(next);
    statblockAutosave.schedule(next);
  }

  async function persistStatblockImmediately(next: SavedStatblock) {
    await statblockAutosave.persistImmediately(next);
    replaceLibraryEntry(next);
  }

  function exportLibrary() {
    downloadLibraryExport(library);
  }

  async function exportParserDiagnostics() {
    try {
      setError(null);
      downloadParserDiagnostics(await parseJobsApi.exportDiagnostics());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function importLibraryFile(file: File) {
    try {
      setError(null);
      const imported = await readLibraryImport(file);
      const importedIds = imported.statblocks.map((statblock) => statblock.id);
      await statblockAutosave.prepareImport(importedIds);
      for (const statblock of imported.statblocks) await statblockRepository.put(statblock);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function removeStatblock(id: string) {
    if (deletionLockedStatblockIds.has(id)) {
      setParseJobError("Не можна видалити statblock, доки триває його повторний розбір.");
      return;
    }
    const statblock = libraryById.get(id);
    const name = statblock?.versions.en.working.facts.name ?? "цей statblock";
    const confirmed = window.confirm(`Видалити "${name}" з бібліотеки?\n\nEnter — підтвердити · Esc — скасувати`);
    if (!confirmed) return;

    cancelPendingAutosave(id);
    const currentEncounter = encounter ?? (await encounterRepository.get());
    const nextEncounter = removeCombatantsForStatblock(currentEncounter, id);
    if (nextEncounter !== currentEncounter) await persistEncounter(nextEncounter);
    await statblockRepository.delete(id);
    if (opened?.kind === "library" && opened.statblockId === id) {
      setOpened(null);
    } else if (
      opened?.kind === "combatant" &&
      !nextEncounter.combatants.some((entry) => entry.id === opened.combatantId)
    ) {
      setOpened(null);
    }
    await refresh();
  }

  function changeWorkingDocument(document: EditableStatblockDocument) {
    if (openedStatblock === null) return;
    autosaveWorking(
      libraryLanguage === "uk"
        ? updateSavedStatblockUkrainianWorking(openedStatblock, document)
        : updateSavedStatblockEnglishWorking(openedStatblock, document),
    );
  }

  async function createUkrainianVersion() {
    if (opened?.kind !== "library" || openedStatblock === null) return;
    if (openedStatblock.versions.uk !== undefined) {
      const confirmed = window.confirm(
        "Створити українську версію заново з поточної англійської? Поточна українська версія разом із резервом перекладу буде замінена.",
      );
      if (!confirmed) return;
    }
    const provider =
      (settings.translationProviderType ?? "deepl") === "deepl"
        ? new HttpBackendTranslationProvider({ baseUrl: settings.backendUrl })
        : new LibreTranslateProvider({ baseUrl: settings.translationProviderUrl });
    const providerMode = settings.translationProviderType ?? "deepl";
    const serviceName = translationServiceName(providerMode);
    setTranslationMessage("Створюємо українську версію…");
    const translated = await translateEditableStatblockWithProvider(openedStatblock.versions.en.working, provider);
    const next = createOrReplaceSavedStatblockUkrainian(openedStatblock, translated.document);
    await persistStatblockImmediately(next);
    setLibraryLanguage("uk");
    setEditing(false);
    const validation =
      translated.issues.length === 0
        ? "Числові значення й ігрова механіка пройшли перевірку."
        : `Потрібна перевірка: знайдено ${translated.issues.length} можливих проблем у числових значеннях або ігровій механіці.`;
    if (translated.providerError !== undefined) {
      setTranslationMessage(
        `Українську версію створено частково. ${userFacingTranslationError(translated.providerError, serviceName)} Неперекладені фрагменти залишено англійською. ${validation}`,
      );
    } else {
      setTranslationMessage(
        `Українську версію створено. Перекладено ${translated.translatedFragmentCount} фрагментів. ${validation}`,
      );
    }
  }

  async function editCombatantCard(
    combatantId: string,
    patch: {
      name?: string | null;
      hitPointMaximum?: number | null;
      armorClass?: number | null;
      initiativeModifier?: number | null;
      savingThrows?: Partial<Record<ProductAbilityKey, number | null>>;
    },
  ) {
    if (encounter === null) return;
    const combatant = encounter.combatants.find((entry) => entry.id === combatantId);
    if (combatant === undefined) return;
    const next =
      combatant.kind === "statblock"
        ? updateStatblockCombatantCard(encounter, combatantId, patch)
        : updateStubCombatant(encounter, combatantId, {
            displayName: patch.name ?? undefined,
            hitPointMaximum: patch.hitPointMaximum,
            armorClass: patch.armorClass,
            initiativeModifier: patch.initiativeModifier ?? undefined,
            savingThrows: patch.savingThrows,
          });
    if (next !== encounter) await persistEncounter(next);
  }

  async function changeCardConfig(nextConfig: SavedStatblock["cardConfig"]) {
    if (openedStatblock === null) return;
    await persistStatblockImmediately(updateSavedStatblockCardConfig(openedStatblock, nextConfig));
  }

  async function explicitSave() {
    if (openedStatblock === null) return;
    await persistStatblockImmediately(
      libraryLanguage === "uk"
        ? saveSavedStatblockUkrainian(openedStatblock)
        : saveSavedStatblockEnglish(openedStatblock),
    );
  }

  async function revertToSaved() {
    if (openedStatblock === null) return;
    await persistStatblockImmediately(
      libraryLanguage === "uk"
        ? revertSavedStatblockUkrainianWorking(openedStatblock)
        : revertSavedStatblockEnglishWorking(openedStatblock),
    );
  }

  async function restoreBackup() {
    if (openedStatblock === null) return;
    const active = libraryLanguage === "uk" ? openedStatblock.versions.uk : openedStatblock.versions.en;
    if (active?.backup === null || active?.backup === undefined) return;
    await persistStatblockImmediately(
      libraryLanguage === "uk"
        ? restoreSavedStatblockUkrainianBackupToWorking(openedStatblock)
        : restoreSavedStatblockEnglishBackupToWorking(openedStatblock),
    );
  }

  function beginDrag(event: React.DragEvent, statblockId: string) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-statblock-id", statblockId);
    event.dataTransfer.setData("text/plain", statblockId);
  }

  return (
    <div className="app-shell">
      {(leftSidebarOpen || rightSidebarOpen) && (
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          aria-label="Закрити бічну панель"
          onClick={() => {
            setLeftSidebarOpen(false);
            setRightSidebarOpen(false);
          }}
        />
      )}
      <button
        type="button"
        className={`sidebar-rail sidebar-rail-left ${leftSidebarOpen ? "open" : ""}`}
        aria-label="Відкрити бібліотеку"
        onClick={() => {
          setRightSidebarOpen(false);
          setLeftSidebarOpen(true);
        }}
      >
        ›
      </button>
      <LibrarySidebar
        library={library}
        parseJobs={parseJobs}
        opened={opened}
        editing={editing}
        error={error}
        loading={loading}
        documentsEqual={documentsEqual}
        deletionLockedStatblockIds={deletionLockedStatblockIds}
        onStartImport={() =>
          requestOutsideSettingsAction(() => {
            setShowImportForm(true);
          })
        }
        onRetryParseJob={(jobId) =>
          requestOutsideSettingsAction(() => {
            void retryParseJob(jobId);
          })
        }
        onDismissParseJob={(jobId) =>
          requestOutsideSettingsAction(() => {
            void dismissParseJob(jobId);
          })
        }
        onOpen={(statblockId) =>
          requestOutsideSettingsAction(() => {
            setShowImportForm(false);
            setOpened({ kind: "library", statblockId });
          })
        }
        onAddToEncounter={(statblockId) =>
          requestOutsideSettingsAction(() => {
            void addToEncounter(statblockId);
          })
        }
        onRemove={(statblockId) =>
          requestOutsideSettingsAction(() => {
            void removeStatblock(statblockId);
          })
        }
        onDragStart={(event, statblockId) => {
          if (showSettings && settingsDraftDirty) {
            event.preventDefault();
            requestOutsideSettingsAction(() => {});
            return;
          }
          beginDrag(event, statblockId);
        }}
        mobileOpen={leftSidebarOpen}
      />

      <main className="workspace">
        <header className="workspace-header unified-workspace-header">
          <div className="workspace-header-tools">
            <button
              type="button"
              className="settings-button"
              onClick={() => {
                if (showSettings) {
                  requestOutsideSettingsAction(() => {});
                } else {
                  resetSettingsDraft();
                  setShowSettings(true);
                  void loadModelProfiles();
                }
              }}
            >
              Налаштування
            </button>
          </div>

          <div className="header-dice-zone" aria-label="Dice roller">
            <div className="dice-expression-control compact-expression-control">
              <input
                value={rollInput}
                onChange={(event) => {
                  setRollInput(event.target.value);
                  setRollError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") requestOutsideSettingsAction(rollInputExpression);
                }}
                aria-label="Dice expression"
                placeholder="1к20"
              />
              <button
                type="button"
                className="primary-button"
                onClick={() => requestOutsideSettingsAction(rollInputExpression)}
              >
                Кинути
              </button>
            </div>
            {rollError !== null && <div className="dice-error compact-dice-error">{rollError}</div>}
          </div>

          <div className="header-roll-zone" aria-label="Журнал кидків">
            <div className="roll-history compact-roll-history" aria-live="polite">
              {rollHistory.length === 0 ? (
                <span className="roll-history-empty">Кидків ще немає.</span>
              ) : (
                rollHistory.map((entry) => (
                  <div key={entry.id} className="roll-history-entry">
                    <span className="roll-history-label">{entry.label}</span>
                    <strong>
                      {entry.result.normalized} → {entry.result.total}
                    </strong>
                    <span>{formatRollDetails(entry.result)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </header>

        {showSettings && (
          <SettingsPanel
            settings={{
              ...settings,
              activeParserModelProfileId: settingsModelProfileId,
              translationProviderType: settingsTranslationProviderMode,
              defaultStatblockLanguage: settingsDefaultStatblockLanguage,
            }}
            translationProviderUrl={settingsTranslationProviderUrl}
            translationProviderMode={settingsTranslationProviderMode}
            customModelBaseUrl={settingsCustomModelBaseUrl}
            customModelId={settingsCustomModelId}
            customModelEditing={settingsCustomModelEditing}
            modelApiKey={settingsModelApiKey}
            modelProfiles={modelProfiles}
            modelProfileStatuses={modelProfileStatuses}
            connectionState={connectionState}
            connectionMessage={connectionMessage}
            translationConnectionState={translationConnectionState}
            translationConnectionMessage={translationConnectionMessage}
            libraryImportInput={libraryImportInput}
            libraryEmpty={library.length === 0}
            onTranslationProviderUrlChange={(value) => {
              setSettingsTranslationProviderUrl(value);
              setTranslationProviderConnectionIdle();
            }}
            onSelectTranslationProviderMode={(value) => {
              setSettingsTranslationProviderMode(value);
              if (value === "libretranslate" && settingsTranslationProviderUrl.trim() === "")
                setSettingsTranslationProviderUrl(defaultTranslationProviderUrl());
              setTranslationProviderConnectionIdle();
            }}
            onCustomModelBaseUrlChange={(value) => {
              setSettingsCustomModelBaseUrl(value);
              setConnectionState("idle");
              setConnectionMessage("");
            }}
            onCustomModelIdChange={(value) => {
              setSettingsCustomModelId(value);
              setConnectionState("idle");
              setConnectionMessage("");
            }}
            onModelApiKeyChange={(value) => {
              setSettingsModelApiKey(value);
              setConnectionState("idle");
              setConnectionMessage("");
            }}
            onSelectModelProfile={selectModelProfile}
            onSelectDefaultLanguage={selectDefaultStatblockLanguage}
            onCheckBackend={() => {
              void checkBackendConnection();
            }}
            onCheckTranslation={() => {
              void checkTranslationConnection();
            }}
            onSave={() => {
              void saveSettings();
            }}
            onExportLibrary={exportLibrary}
            onImportLibraryFile={(file) => {
              void importLibraryFile(file);
            }}
            onExportDiagnostics={() => {
              void exportParserDiagnostics();
            }}
          />
        )}

        {opened?.kind === "library" && openedStatblock !== null && editing && (
          <div className="editor-toolbar">
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                requestOutsideSettingsAction(() => {
                  void explicitSave();
                })
              }
            >
              Зберегти
            </button>
            <button
              type="button"
              disabled={!workingDiffersFromSaved}
              onClick={() =>
                requestOutsideSettingsAction(() => {
                  void revertToSaved();
                })
              }
            >
              Повернутися до збереженої
            </button>
            <button
              type="button"
              disabled={activeLibraryVersion?.backup === null || activeLibraryVersion?.backup === undefined}
              onClick={() =>
                requestOutsideSettingsAction(() => {
                  void restoreBackup();
                })
              }
            >
              Завантажити резервну
            </button>
            <span className="toolbar-note">
              {libraryLanguage.toUpperCase()} working автозберігається окремо. «Зберегти» оновлює ручний checkpoint;
              резерв залишається початковим результатом розбору або перекладу.
            </span>
          </div>
        )}

        {opened?.kind === "library" && translationMessage !== null && (
          <div className="translation-status" role="status">
            {translationMessage}
          </div>
        )}

        {showImportForm && (
          <ImportWorkspace
            text={importText}
            parserMode={importParserMode}
            backendStatus={backendStatus}
            parseJobError={parseJobError}
            onTextChange={setImportText}
            onParserModeChange={setImportParserMode}
            onClose={() => {
              setShowImportForm(false);
              setImportText("");
            }}
            onOpenBackendSettings={() => {
              resetSettingsDraft();
              setShowSettings(true);
            }}
            onSubmit={() => {
              void submitImport();
            }}
          />
        )}

        <div className="workspace-scroll">
          {opened === null || (opened?.kind !== "combatant" && openedDocument === null) ? (
            <div className="workspace-empty">Обери statblock зліва або бойову картку справа.</div>
          ) : (
            <div className="statblock-card-stage">
              <StatblockCardControls
                open={cardControlsOpen}
                onToggle={() => setCardControlsOpen((value) => !value)}
                language={opened?.kind === "library" ? libraryLanguage : null}
                hasUkrainian={opened?.kind === "library" && openedStatblock?.versions.uk !== undefined}
                onLanguageChange={(language) =>
                  requestOutsideSettingsAction(() => {
                    setLibraryLanguage(language);
                    setEditing(false);
                    setConfiguringCard(false);
                  })
                }
                onTranslate={() =>
                  requestOutsideSettingsAction(() => {
                    void createUkrainianVersion();
                  })
                }
                editing={editing}
                configuringCard={configuringCard}
                canConfigureCard={openedCardConfig !== null}
                onToggleEditing={() =>
                  requestOutsideSettingsAction(() => {
                    setConfiguringCard(false);
                    setEditing((value) => !value);
                  })
                }
                onToggleConfiguringCard={() =>
                  requestOutsideSettingsAction(() => {
                    setEditing(false);
                    setConfiguringCard((value) => !value);
                  })
                }
                savedStatblock={opened?.kind === "library" ? openedStatblock : null}
                reparseMode={reparseParserMode}
                onReparseModeChange={setReparseParserMode}
                reparseBusy={reparseBusy}
                onReparse={() =>
                  requestOutsideSettingsAction(() => {
                    void submitReparse();
                  })
                }
              />

              {opened?.kind === "combatant" && openedCombatant?.kind === "stub" ? (
                editing ? (
                  <StubCombatantEditor
                    combatant={openedCombatant}
                    onChange={(patch) => void changeStubCombatant(openedCombatant.id, patch)}
                  />
                ) : (
                  <StubCombatantView
                    combatant={openedCombatant}
                    onHpChange={(hp) => void changeCombatantHp(openedCombatant.id, hp)}
                    onRoll={performRoll}
                  />
                )
              ) : openedDocument === null ? (
                <div className="workspace-empty">Statblock недоступний.</div>
              ) : configuringCard && openedCardConfig !== null ? (
                <CardConfigEditor
                  document={openedDocument}
                  config={openedCardConfig}
                  onChange={(nextConfig) => {
                    void changeCardConfig(nextConfig);
                  }}
                />
              ) : editing ? (
                <StatblockEditor document={openedDocument} onChange={changeWorkingDocument} />
              ) : (
                <>
                  {opened?.kind === "combatant" &&
                    openedCombatant?.hp !== null &&
                    openedCombatant?.hp !== undefined && (
                      <div className="combat-overlay">
                        <div className="combat-overlay-name">{openedTitle}</div>
                        <CombatHpControls
                          hp={openedCombatant.hp}
                          onChange={(hp) => void changeCombatantHp(openedCombatant.id, hp)}
                        />
                      </div>
                    )}
                  <StatblockView
                    document={openedDocument}
                    documentKey={opened?.kind === "combatant" ? opened.combatantId : (openedStatblock?.id ?? "library")}
                    onRoll={performRoll}
                    limitedUses={openedCombatant?.kind === "statblock" ? openedCombatant.limitedUses : undefined}
                    onLimitedUseChange={
                      openedCombatant?.kind === "statblock"
                        ? (key, maximum, value) => changeLimitedUse(openedCombatant.id, key, maximum, value)
                        : undefined
                    }
                  />
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {settingsGuardOpen && (
        <div className="settings-guard-backdrop" role="presentation">
          <div className="settings-guard-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-guard-title">
            <h2 id="settings-guard-title">Є незбережені зміни</h2>
            <p>Зберегти зміни в налаштуваннях перед продовженням?</p>
            <div className="settings-guard-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  void saveAndContinuePendingSettingsAction();
                }}
              >
                Зберегти зміни
              </button>
              <button type="button" onClick={discardAndContinuePendingSettingsAction}>
                Скасувати зміни
              </button>
              <button type="button" onClick={stayInSettings}>
                Залишитися в налаштуваннях
              </button>
            </div>
          </div>
        </div>
      )}

      <EncounterSidebar
        encounter={encounter}
        opened={opened}
        dragOver={dragOverEncounter}
        showStubForm={showStubForm}
        stubName={stubName}
        stubHp={stubHp}
        stubAc={stubAc}
        stubInitiative={stubInitiative}
        stubSaves={stubSaves}
        rollSequence={rollSequence}
        onDragOver={allowEncounterDrop}
        onDragLeave={leaveEncounterDrop}
        onDrop={dropOnEncounter}
        onFinishCombat={() =>
          requestOutsideSettingsAction(() => {
            void finishCombat();
          })
        }
        onBeginCombat={() =>
          requestOutsideSettingsAction(() => {
            void beginCombat();
          })
        }
        onNextCombatant={() =>
          requestOutsideSettingsAction(() => {
            void nextCombatant();
          })
        }
        onToggleStubForm={() => requestOutsideSettingsAction(() => setShowStubForm((value) => !value))}
        onStubNameChange={(value) => requestOutsideSettingsAction(() => setStubName(value))}
        onStubHpChange={(value) => requestOutsideSettingsAction(() => setStubHp(value))}
        onStubAcChange={(value) => requestOutsideSettingsAction(() => setStubAc(value))}
        onStubInitiativeChange={(value) => requestOutsideSettingsAction(() => setStubInitiative(value))}
        onStubSaveChange={(ability, value) =>
          requestOutsideSettingsAction(() => setStubSaves((current) => ({ ...current, [ability]: value })))
        }
        onCreateStub={() =>
          requestOutsideSettingsAction(() => {
            void createStub();
          })
        }
        onOpenCombatant={(combatantId) =>
          requestOutsideSettingsAction(() => {
            setShowImportForm(false);
            setOpened({ kind: "combatant", combatantId });
          })
        }
        onRemoveCombatant={(combatantId) =>
          requestOutsideSettingsAction(() => {
            void removeFromEncounter(combatantId);
          })
        }
        onCardEdit={(combatantId, patch) =>
          requestOutsideSettingsAction(() => {
            void editCombatantCard(combatantId, patch);
          })
        }
        onRoll={performRoll}
        onInitiative={(combatantId) =>
          requestOutsideSettingsAction(() => {
            void rollInitiative(combatantId);
          })
        }
        onInitiativeChange={(combatantId, value) =>
          requestOutsideSettingsAction(() => {
            void changeInitiative(combatantId, value);
          })
        }
        onHpChange={(combatantId, hp) =>
          requestOutsideSettingsAction(() => {
            void changeCombatantHp(combatantId, hp);
          })
        }
        onLimitedUseChange={(combatantId, key, maximum, value) =>
          requestOutsideSettingsAction(() => {
            changeLimitedUse(combatantId, key, maximum, value);
          })
        }
        mobileOpen={rightSidebarOpen}
      />
      <button
        type="button"
        className={`sidebar-rail sidebar-rail-right ${rightSidebarOpen ? "open" : ""}`}
        aria-label="Відкрити бойову панель"
        onClick={() => {
          setLeftSidebarOpen(false);
          setRightSidebarOpen(true);
        }}
      >
        ‹
      </button>
    </div>
  );
}
