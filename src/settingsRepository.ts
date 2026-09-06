import type { AppSettings } from "./settings.js";
import { LazyIndexedDbConnection, requestToPromise, transactionToPromise } from "./indexedDbPrimitives.js";
import { assertStoredAppSettings } from "./runtimeValidation.js";

export interface SettingsRepository {
  get(): Promise<AppSettings | undefined>;
  put(value: AppSettings): Promise<void>;
  clear(): Promise<void>;
}

function cloneSettings(value: AppSettings): AppSettings {
  return structuredClone(value);
}

export class MemorySettingsRepository implements SettingsRepository {
  private value: AppSettings | undefined;

  async get(): Promise<AppSettings | undefined> {
    return this.value === undefined ? undefined : cloneSettings(this.value);
  }

  async put(value: AppSettings): Promise<void> {
    this.value = cloneSettings(value);
  }

  async clear(): Promise<void> {
    this.value = undefined;
  }
}

export type IndexedDbSettingsRepositoryOptions = {
  indexedDBFactory?: IDBFactory;
  databaseName?: string;
};

export class IndexedDbSettingsRepository implements SettingsRepository {
  private readonly databaseName: string;
  private readonly connection: LazyIndexedDbConnection;

  constructor(options: IndexedDbSettingsRepositoryOptions = {}) {
    const factory = options.indexedDBFactory ?? globalThis.indexedDB;
    if (factory === undefined) throw new Error("IndexedDB is unavailable in this environment.");
    this.databaseName = options.databaseName ?? "statblock-parser-settings";
    this.connection = new LazyIndexedDbConnection({
      factory,
      databaseName: this.databaseName,
      databaseVersion: 1,
      upgrade: (database) => {
        if (!database.objectStoreNames.contains("settings")) {
          database.createObjectStore("settings", { keyPath: "key" });
        }
      },
      openErrorMessage: "Failed to open IndexedDB.",
      blockedErrorMessage: "Opening settings IndexedDB was blocked by another connection.",
    });
  }

  private database(): Promise<IDBDatabase> {
    return this.connection.get();
  }

  private async transaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.database();
    const transaction = database.transaction("settings", mode);
    const store = transaction.objectStore("settings");
    const request = operation(store);
    const [result] = await Promise.all([requestToPromise(request), transactionToPromise(transaction)]);
    return result;
  }

  async get(): Promise<AppSettings | undefined> {
    const record = await this.transaction<unknown>("readonly", (store) => store.get("app"));
    if (record === undefined) return undefined;
    if (typeof record !== "object" || record === null || !("value" in record)) {
      throw new Error("Stored settings record is malformed.");
    }
    const value = record.value;
    assertStoredAppSettings(value);
    return cloneSettings(value);
  }

  async put(value: AppSettings): Promise<void> {
    await this.transaction<IDBValidKey>("readwrite", (store) => store.put({ key: "app", value: cloneSettings(value) }));
  }

  async clear(): Promise<void> {
    await this.transaction<undefined>("readwrite", (store) => store.delete("app") as IDBRequest<undefined>);
  }
}
