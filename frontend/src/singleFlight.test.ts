import { describe, expect, it } from "vitest";

import { runSingleFlight } from "./singleFlight";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("runSingleFlight", () => {
  it("skips an overlapping polling cycle and unlocks after completion", async () => {
    const lock = { current: false };
    const gate = deferred();
    let calls = 0;
    const task = async () => {
      calls += 1;
      await gate.promise;
    };

    const first = runSingleFlight(lock, task);
    expect(await runSingleFlight(lock, task)).toBe(false);
    expect(calls).toBe(1);
    gate.resolve();
    expect(await first).toBe(true);
    expect(lock.current).toBe(false);
  });

  it("unlocks when the polling cycle throws", async () => {
    const lock = { current: false };
    await expect(
      runSingleFlight(lock, async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    expect(lock.current).toBe(false);
  });
});
