import type { SavedStatblock } from "./productModel.js";
import { isLegacySavedStatblock, migrateSavedStatblock } from "./productMigration.js";
import { LazyIndexedDbConnection, requestToPromise, transactionToPromise } from "./indexedDbPrimitives.js";

export interface StatblockRepository {
  list(): Promise<SavedStatblock[]>;
  get(id: string): Promise<SavedStatblock | undefined>;
  put(statblock: SavedStatblock): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

function cloneStatblock(statblock: SavedStatblock): SavedStatblock {
  return structuredClone(statblock);
}

function normalizeStatblock(value: unknown): SavedStatblock {
  return migrateSavedStatblock(value);
}

export function compareSavedStatblocksByName(left: SavedStatblock, right: SavedStatblock): number {
  const leftName =
    left.versions.en.working.facts.name?.trim() || left.versions.en.saved.facts.name?.trim() || "Без назви";
  const rightName =
    right.versions.en.working.facts.name?.trim() || right.versions.en.saved.facts.name?.trim() || "Без назви";
  const byName = leftName.localeCompare(rightName, ["uk", "en"], { sensitivity: "base", numeric: true });
  return byName !== 0 ? byName : left.id.localeCompare(right.id);
}

function sortAlphabetically(statblocks: SavedStatblock[]): SavedStatblock[] {
  return statblocks.sort(compareSavedStatblocksByName);
}

/**
 * In-memory implementation used by unit tests and small non-persistent consumers.
 * It intentionally follows the same copy-in/copy-out semantics as IndexedDB.
 */
export class MemoryStatblockRepository implements StatblockRepository {
  private readonly values = new Map<string, SavedStatblock>();

  async list(): Promise<SavedStatblock[]> {
    return sortAlphabetically(Array.from(this.values.values(), (value) => normalizeStatblock(value)));
  }

  async get(id: string): Promise<SavedStatblock | undefined> {
    const value = this.values.get(id);
    return value === undefined ? undefined : normalizeStatblock(value);
  }

  async put(statblock: SavedStatblock): Promise<void> {
    this.values.set(statblock.id, normalizeStatblock(statblock));
  }

  async delete(id: string): Promise<void> {
    this.values.delete(id);
  }

  async clear(): Promise<void> {
    this.values.clear();
  }
}

export type IndexedDbStatblockRepositoryOptions = {
  databaseName?: string;
  databaseVersion?: number;
  storeName?: string;
  indexedDBFactory?: IDBFactory;
};

const DEFAULT_DATABASE_NAME = "statblock-parser";
const DEFAULT_DATABASE_VERSION = 1;
const DEFAULT_STORE_NAME = "saved-statblocks";

/**
 * Browser persistence implementation. Construction is side-effect free; the
 * database is opened lazily on the first operation so importing the package in
 * Node does not require a browser global.
 */
export class IndexedDbStatblockRepository implements StatblockRepository {
  private readonly databaseName: string;
  private readonly databaseVersion: number;
  private readonly storeName: string;
  private readonly connection: LazyIndexedDbConnection;

  constructor(options: IndexedDbStatblockRepositoryOptions = {}) {
    const factory = options.indexedDBFactory ?? globalThis.indexedDB;
    if (factory === undefined) {
      throw new Error(
        "IndexedDB is unavailable in this environment. Provide indexedDBFactory or use MemoryStatblockRepository.",
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
          const store = database.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      },
      openErrorMessage: "Failed to open IndexedDB.",
      blockedErrorMessage: "Opening IndexedDB was blocked by another connection.",
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    return this.connection.get();
  }

  async list(): Promise<SavedStatblock[]> {
    const database = await this.openDatabase();
    const transaction = database.transaction(this.storeName, "readonly");
    const completion = transactionToPromise(transaction);
    const store = transaction.objectStore(this.storeName);
    const values = await requestToPromise(store.getAll() as IDBRequest<unknown[]>);
    await completion;
    const migrated = values.map(normalizeStatblock);
    if (values.some(isLegacySavedStatblock)) {
      const write = database.transaction(this.storeName, "readwrite");
      const writeCompletion = transactionToPromise(write);
      const writeStore = write.objectStore(this.storeName);
      migrated.forEach((value) => writeStore.put(cloneStatblock(value)));
      await writeCompletion;
    }
    return sortAlphabetically(migrated.map(cloneStatblock));
  }

  async get(id: string): Promise<SavedStatblock | undefined> {
    const database = await this.openDatabase();
    const transaction = database.transaction(this.storeName, "readonly");
    const completion = transactionToPromise(transaction);
    const store = transaction.objectStore(this.storeName);
    const value = await requestToPromise(store.get(id) as IDBRequest<unknown | undefined>);
    await completion;
    if (value === undefined) return undefined;
    const migrated = normalizeStatblock(value);
    if (isLegacySavedStatblock(value)) {
      const write = database.transaction(this.storeName, "readwrite");
      const writeCompletion = transactionToPromise(write);
      write.objectStore(this.storeName).put(cloneStatblock(migrated));
      await writeCompletion;
    }
    return cloneStatblock(migrated);
  }

  async put(statblock: SavedStatblock): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(this.storeName, "readwrite");
    const completion = transactionToPromise(transaction);
    transaction.objectStore(this.storeName).put(cloneStatblock(normalizeStatblock(statblock)));
    await completion;
  }

  async delete(id: string): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(this.storeName, "readwrite");
    const completion = transactionToPromise(transaction);
    transaction.objectStore(this.storeName).delete(id);
    await completion;
  }

  async clear(): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(this.storeName, "readwrite");
    const completion = transactionToPromise(transaction);
    transaction.objectStore(this.storeName).clear();
    await completion;
  }
}
