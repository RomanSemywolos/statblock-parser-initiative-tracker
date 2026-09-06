export function cancelPendingAutosavesForIds<T>(
  pendingAutosaves: Map<string, T>,
  statblockIds: Iterable<string>,
  cancel: (pending: T) => void,
): void {
  for (const statblockId of statblockIds) {
    const pending = pendingAutosaves.get(statblockId);
    if (pending === undefined) continue;
    cancel(pending);
    pendingAutosaves.delete(statblockId);
  }
}

export async function awaitAutosaveWritesForIds(
  inFlightWrites: ReadonlyMap<string, Promise<void>>,
  statblockIds: Iterable<string>,
): Promise<void> {
  const ids = new Set(statblockIds);
  const writes: Promise<void>[] = [];
  for (const statblockId of ids) {
    const write = inFlightWrites.get(statblockId);
    if (write !== undefined) writes.push(write);
  }
  await Promise.all(writes);
}
