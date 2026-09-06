import {
  awaitAutosaveWritesForIds,
  cancelPendingAutosavesForIds,
  type EncounterRepository,
  type EncounterState,
  type SavedStatblock,
  type StatblockRepository,
} from "statblock-parser-core/product";

export type PersistenceErrorHandler = (error: unknown) => void;

export type StatblockAutosaveCoordinator = {
  cancel(statblockId: string): void;
  schedule(next: SavedStatblock): void;
  persistImmediately(next: SavedStatblock): Promise<void>;
  prepareImport(statblockIds: readonly string[]): Promise<void>;
  dispose(): void;
};

export function createStatblockAutosaveCoordinator(
  repository: StatblockRepository,
  delayMs: number,
  onError: PersistenceErrorHandler,
): StatblockAutosaveCoordinator {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const inFlight = new Map<string, Promise<void>>();

  function cancel(statblockId: string): void {
    cancelPendingAutosavesForIds(pending, [statblockId], clearTimeout);
  }

  function schedule(next: SavedStatblock): void {
    cancel(next.id);
    const timer = setTimeout(() => {
      pending.delete(next.id);
      const previousWrite = inFlight.get(next.id) ?? Promise.resolve();
      const write = previousWrite.then(() => repository.put(next)).catch(onError);
      inFlight.set(next.id, write);
      void write.finally(() => {
        if (inFlight.get(next.id) === write) inFlight.delete(next.id);
      });
    }, delayMs);
    pending.set(next.id, timer);
  }

  async function persistImmediately(next: SavedStatblock): Promise<void> {
    cancel(next.id);
    const previousWrite = inFlight.get(next.id) ?? Promise.resolve();
    const write = previousWrite.then(() => repository.put(next));
    inFlight.set(next.id, write);
    try {
      await write;
    } finally {
      if (inFlight.get(next.id) === write) inFlight.delete(next.id);
    }
  }

  async function prepareImport(statblockIds: readonly string[]): Promise<void> {
    cancelPendingAutosavesForIds(pending, statblockIds, clearTimeout);
    await awaitAutosaveWritesForIds(inFlight, statblockIds);
  }

  function dispose(): void {
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear();
  }

  return { cancel, schedule, persistImmediately, prepareImport, dispose };
}

export type EncounterAutosaveCoordinator = {
  schedule(next: EncounterState): void;
  persistImmediately(next: EncounterState): Promise<void>;
  dispose(): void;
};

export function createEncounterAutosaveCoordinator(
  repository: EncounterRepository,
  delayMs: number,
  onError: PersistenceErrorHandler,
): EncounterAutosaveCoordinator {
  let pending: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  function cancel(): void {
    if (pending === null) return;
    clearTimeout(pending);
    pending = null;
  }

  function schedule(next: EncounterState): void {
    cancel();
    pending = setTimeout(() => {
      pending = null;
      inFlight = inFlight.then(() => repository.put(next)).catch(onError);
    }, delayMs);
  }

  async function persistImmediately(next: EncounterState): Promise<void> {
    cancel();
    const write = inFlight.then(() => repository.put(next));
    inFlight = write.catch(() => {});
    await write;
  }

  function dispose(): void {
    cancel();
  }

  return { schedule, persistImmediately, dispose };
}
