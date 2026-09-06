import { createEmptyEncounter, type EncounterState } from "./encounterModel.js";
import { LazyIndexedDbConnection, requestToPromise, transactionToPromise } from "./indexedDbPrimitives.js";
import { assertEncounterState } from "./runtimeValidation.js";

export interface EncounterRepository {
  get(): Promise<EncounterState>;
  put(encounter: EncounterState): Promise<void>;
  clear(): Promise<void>;
}

function cloneEncounter(encounter: EncounterState): EncounterState {
  return structuredClone(encounter);
}

export class MemoryEncounterRepository implements EncounterRepository {
  private value: EncounterState;

  constructor(initial?: EncounterState) {
    this.value = cloneEncounter(initial ?? createEmptyEncounter());
  }

  async get(): Promise<EncounterState> {
    return cloneEncounter(this.value);
  }

  async put(encounter: EncounterState): Promise<void> {
    this.value = cloneEncounter(encounter);
  }

  async clear(): Promise<void> {
    this.value = createEmptyEncounter();
  }
}

export type IndexedDbEncounterRepositoryOptions = {
  databaseName?: string;
  databaseVersion?: number;
  storeName?: string;
  indexedDBFactory?: IDBFactory;
};

const DEFAULT_DATABASE_NAME = "statblock-parser-encounter";
const DEFAULT_DATABASE_VERSION = 1;
const DEFAULT_STORE_NAME = "encounter";
const ENCOUNTER_KEY = "current";

type StoredEncounter = EncounterState & { storageKey: typeof ENCOUNTER_KEY };

export class IndexedDbEncounterRepository implements EncounterRepository {
  private readonly databaseName: string;
  private readonly databaseVersion: number;
  private readonly storeName: string;
  private readonly connection: LazyIndexedDbConnection;

  constructor(options: IndexedDbEncounterRepositoryOptions = {}) {
    const factory = options.indexedDBFactory ?? globalThis.indexedDB;
    if (factory === undefined) {
      throw new Error(
        "IndexedDB is unavailable in this environment. Provide indexedDBFactory or use MemoryEncounterRepository.",
      );
    }

    this.databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
    this.databaseVersion = options.databaseVersion ?? DEFAULT_DATABASE_VERSION;
    this.storeName = options.storeName ?? DEFAULT_STORE_NAME;
    this.connection = new LazyIndexedDbConnection({
      factory,
      databaseName: this.databaseName,
      databaseVersion: this.databaseVersion,
      upgrade: (database) => {
        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName, { keyPath: "storageKey" });
        }
      },
      openErrorMessage: "Failed to open encounter IndexedDB.",
      blockedErrorMessage: "Opening encounter IndexedDB was blocked by another connection.",
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    return this.connection.get();
  }

  async get(): Promise<EncounterState> {
    const database = await this.openDatabase();
    const transaction = database.transaction(this.storeName, "readonly");
    const completion = transactionToPromise(transaction);
    const stored = await requestToPromise(
      transaction.objectStore(this.storeName).get(ENCOUNTER_KEY) as IDBRequest<StoredEncounter | undefined>,
    );
    await completion;
    if (stored === undefined) return createEmptyEncounter();
    const { storageKey: _storageKey, ...encounter } = stored;
    const hasOnlyCurrentCombatants =
      Array.isArray(encounter.combatants) &&
      encounter.combatants.every(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          (entry.formatVersion === "stub-combatant-v2" || entry.formatVersion === "statblock-combatant-v3"),
      );
    if (encounter.formatVersion === "encounter-v3" && hasOnlyCurrentCombatants) assertEncounterState(encounter);
    else if (typeof encounter !== "object" || encounter === null || !Array.isArray(encounter.combatants)) {
      throw new Error("Stored encounter is malformed.");
    }
    return cloneEncounter(encounter);
  }

  async put(encounter: EncounterState): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(this.storeName, "readwrite");
    const completion = transactionToPromise(transaction);
    const stored: StoredEncounter = {
      ...cloneEncounter(encounter),
      storageKey: ENCOUNTER_KEY,
    };
    transaction.objectStore(this.storeName).put(stored);
    await completion;
  }

  async clear(): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(this.storeName, "readwrite");
    const completion = transactionToPromise(transaction);
    transaction.objectStore(this.storeName).delete(ENCOUNTER_KEY);
    await completion;
  }
}
