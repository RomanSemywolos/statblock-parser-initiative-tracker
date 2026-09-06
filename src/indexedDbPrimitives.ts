export type LazyIndexedDbConnectionOptions = {
  factory: IDBFactory;
  databaseName: string;
  databaseVersion: number;
  upgrade: (database: IDBDatabase) => void;
  openErrorMessage: string;
  blockedErrorMessage: string;
};

/**
 * Owns only the lifecycle of one lazily-opened IndexedDB connection.
 * Store layout, transactions and repository/domain semantics remain outside.
 */
export class LazyIndexedDbConnection {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly options: LazyIndexedDbConnectionOptions) {}

  get(): Promise<IDBDatabase> {
    if (this.databasePromise !== null) return this.databasePromise;

    let opening!: Promise<IDBDatabase>;
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.options.factory.open(this.options.databaseName, this.options.databaseVersion);
      let abandoned = false;
      let rejected = false;

      const resetIfCurrent = (): void => {
        if (this.databasePromise === opening) this.databasePromise = null;
      };
      const fail = (error: Error): void => {
        if (rejected) return;
        rejected = true;
        abandoned = true;
        resetIfCurrent();
        reject(error);
      };

      request.addEventListener("upgradeneeded", () => {
        if (!abandoned) this.options.upgrade(request.result);
      });

      request.addEventListener(
        "success",
        () => {
          const database = request.result;
          if (abandoned) {
            // `blocked` can be followed by a later success after the caller has
            // already received a rejection. Do not leak that orphan connection.
            database.close();
            return;
          }

          database.addEventListener("versionchange", () => {
            database.close();
            resetIfCurrent();
          });
          resolve(database);
        },
        { once: true },
      );

      request.addEventListener(
        "error",
        () => {
          fail(request.error ?? new Error(this.options.openErrorMessage));
        },
        { once: true },
      );

      request.addEventListener(
        "blocked",
        () => {
          fail(new Error(this.options.blockedErrorMessage));
        },
        { once: true },
      );
    });

    this.databasePromise = opening;
    return opening;
  }
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB request failed.")), {
      once: true,
    });
  });
}

export function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction aborted.")),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed.")),
      { once: true },
    );
  });
}
