import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  CUSTOM_MODEL_PROFILE_ID,
  HttpParseJobsApi,
  HttpParserBackendApi,
  compareSavedStatblocksByName,
  createSavedStatblock,
  replaceSavedStatblockFromParse,
  type AppSettings,
  type ParseJobSummary,
  type ParserMode,
  type SavedStatblock,
  type StatblockRepository,
} from "statblock-parser-core/product";
import { runSingleFlight } from "../singleFlight";
import { userFacingParserError } from "../userMessages";

function mergeLibraryPreservingOrder(current: readonly SavedStatblock[], incoming: readonly SavedStatblock[]) {
  const incomingById = new Map(incoming.map((entry) => [entry.id, entry]));
  const retained = current
    .map((entry) => incomingById.get(entry.id))
    .filter((entry): entry is SavedStatblock => entry !== undefined);
  const retainedIds = new Set(retained.map((entry) => entry.id));
  const added = incoming.filter((entry) => !retainedIds.has(entry.id)).sort(compareSavedStatblocksByName);
  return [...retained, ...added];
}

function locksStatblock(job: ParseJobSummary, statblockId: string): boolean {
  return (
    job.replaceExisting === true &&
    job.statblockId === statblockId &&
    (job.status === "queued" || job.status === "processing" || job.status === "completed")
  );
}

type Options = {
  repository: StatblockRepository;
  settings: AppSettings;
  clientId: string;
  openedStatblock: SavedStatblock | null;
  setLibrary: Dispatch<SetStateAction<SavedStatblock[]>>;
  setBackendStatus: Dispatch<SetStateAction<"unknown" | "online" | "offline">>;
};

export function useParseJobsController({
  repository,
  settings,
  clientId,
  openedStatblock,
  setLibrary,
  setBackendStatus,
}: Options) {
  const [parseJobs, setParseJobs] = useState<ParseJobSummary[]>([]);
  const syncInFlightRef = useRef(false);
  const [parseJobError, setParseJobError] = useState<string | null>(null);
  const [showImportForm, setShowImportForm] = useState(false);
  const [importText, setImportText] = useState("");
  const [importParserMode, setImportParserMode] = useState<ParserMode>("auto");
  const [reparseParserMode, setReparseParserMode] = useState<ParserMode>("auto");
  const [reparseSubmittingStatblockId, setReparseSubmittingStatblockId] = useState<string | null>(null);
  const api = useMemo(
    () => new HttpParseJobsApi({ backendUrl: settings.backendUrl, clientId }),
    [settings.backendUrl, clientId],
  );

  const syncParseJobs = useCallback(
    () =>
      runSingleFlight(syncInFlightRef, async () => {
        try {
          const jobs = await api.list();
          const remaining: ParseJobSummary[] = [];
          for (const job of jobs) {
            if (job.status !== "completed") {
              remaining.push(job);
              continue;
            }
            try {
              const result = await api.getResult(job.id);
              const existing = await repository.get(result.statblockId);
              if (job.replaceExisting === true) {
                if (existing === undefined) throw new Error("Картку для повторного розбору вже видалено з бібліотеки.");
                await repository.put(
                  replaceSavedStatblockFromParse(existing, result.editableDocument, {
                    parserVersion: result.parserVersion,
                    parserStructure: result.parserStructure ?? null,
                    parserMode: result.parserMode ?? job.parserMode ?? null,
                    rawSource: result.rawSource ?? existing.rawSource,
                  }),
                );
              } else if (existing === undefined) {
                await repository.put(
                  createSavedStatblock(result.editableDocument, {
                    parserVersion: result.parserVersion,
                    parserStructure: result.parserStructure ?? null,
                    parserMode: result.parserMode ?? job.parserMode ?? null,
                    rawSource: result.rawSource ?? null,
                    id: result.statblockId,
                  }),
                );
              }
              await api.delete(job.id);
            } catch (caught) {
              remaining.push(job);
              setParseJobError(userFacingParserError(caught instanceof Error ? caught.message : String(caught)));
            }
          }
          if (remaining.length !== jobs.length || jobs.some((job) => job.status === "completed")) {
            const latest = await repository.list();
            setLibrary((current) => mergeLibraryPreservingOrder(current, latest));
          }
          setParseJobs(remaining);
          setBackendStatus("online");
          if (!remaining.some((job) => job.status === "failed")) setParseJobError(null);
        } catch {
          setBackendStatus("offline");
        }
      }),
    [api, repository, setBackendStatus, setLibrary],
  );

  useEffect(() => {
    void syncParseJobs();
    const timer = window.setInterval(() => void syncParseJobs(), 1500);
    return () => window.clearInterval(timer);
  }, [syncParseJobs]);

  async function ensureCustomModel() {
    if (settings.activeParserModelProfileId !== CUSTOM_MODEL_PROFILE_ID) return;
    const custom = settings.customParserModel;
    if (custom === null || custom === undefined) {
      throw new Error(
        "Власна лінгвістична модель не налаштована. Відкрийте налаштування та вкажіть адресу сервісу і назву / ID моделі.",
      );
    }
    const status = await new HttpParserBackendApi(settings.backendUrl).configureCustomModelProfile(custom);
    if (!status.health.ok) throw new Error(status.health.detail ?? "Власна модель недоступна.");
  }

  async function submitImport() {
    if (importText.trim() === "") return;
    try {
      setParseJobError(null);
      await ensureCustomModel();
      const job = await api.submit(importText, settings.activeParserModelProfileId, importParserMode);
      setBackendStatus("online");
      setParseJobs((current) => [...current.filter((entry) => entry.id !== job.id), job]);
      setImportText("");
      setShowImportForm(false);
    } catch (caught) {
      setBackendStatus("offline");
      setParseJobError(userFacingParserError(caught instanceof Error ? caught.message : String(caught)));
    }
  }

  const reparseBusy =
    openedStatblock !== null &&
    (reparseSubmittingStatblockId === openedStatblock.id ||
      parseJobs.some((job) => locksStatblock(job, openedStatblock.id)));

  async function submitReparse() {
    if (openedStatblock === null || openedStatblock.rawSource === null || reparseBusy) return;
    const targetId = openedStatblock.id;
    setReparseSubmittingStatblockId(targetId);
    try {
      setParseJobError(null);
      await ensureCustomModel();
      const job = await api.submit(
        openedStatblock.rawSource,
        settings.activeParserModelProfileId,
        reparseParserMode,
        targetId,
      );
      setBackendStatus("online");
      setParseJobs((current) => [...current.filter((entry) => entry.id !== job.id), job]);
    } catch (caught) {
      setBackendStatus("offline");
      setParseJobError(userFacingParserError(caught instanceof Error ? caught.message : String(caught)));
    } finally {
      setReparseSubmittingStatblockId((current) => (current === targetId ? null : current));
    }
  }

  async function retryParseJob(id: string) {
    try {
      const job = await api.retry(id);
      setParseJobs((current) => current.map((entry) => (entry.id === id ? job : entry)));
      setParseJobError(null);
    } catch (caught) {
      setParseJobError(userFacingParserError(caught instanceof Error ? caught.message : String(caught)));
    }
  }

  async function dismissParseJob(id: string) {
    try {
      await api.delete(id);
      setParseJobs((current) => current.filter((entry) => entry.id !== id));
    } catch (caught) {
      setParseJobError(userFacingParserError(caught instanceof Error ? caught.message : String(caught)));
    }
  }

  const deletionLockedStatblockIds = useMemo(() => {
    const ids = new Set(parseJobs.filter((job) => locksStatblock(job, job.statblockId)).map((job) => job.statblockId));
    if (reparseSubmittingStatblockId !== null) ids.add(reparseSubmittingStatblockId);
    return ids;
  }, [parseJobs, reparseSubmittingStatblockId]);

  return {
    api,
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
  };
}
