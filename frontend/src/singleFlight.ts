export type SingleFlightLock = { current: boolean };

export async function runSingleFlight(lock: SingleFlightLock, task: () => Promise<void>): Promise<boolean> {
  if (lock.current) return false;
  lock.current = true;
  try {
    await task();
    return true;
  } finally {
    lock.current = false;
  }
}
