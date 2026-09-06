import test from "node:test";
import assert from "node:assert/strict";

import { awaitAutosaveWritesForIds, cancelPendingAutosavesForIds } from "./autosaveCoordination.js";

test("library import cancels only pending autosaves for imported statblock ids", () => {
  const pending = new Map([
    ["alpha", { id: "alpha-timer" }],
    ["beta", { id: "beta-timer" }],
    ["gamma", { id: "gamma-timer" }],
  ]);
  const cancelled: string[] = [];

  cancelPendingAutosavesForIds(pending, ["beta", "missing", "alpha"], (timer) => cancelled.push(timer.id));

  assert.deepEqual(cancelled, ["beta-timer", "alpha-timer"]);
  assert.deepEqual([...pending.keys()], ["gamma"]);
});

test("library import waits for an already-started autosave of the same statblock", async () => {
  let releaseAutosave!: () => void;
  const events: string[] = [];
  const autosave = new Promise<void>((resolve) => {
    releaseAutosave = () => {
      events.push("autosave finished");
      resolve();
    };
  });
  const inFlight = new Map<string, Promise<void>>([["same-id", autosave]]);

  const importBarrier = awaitAutosaveWritesForIds(inFlight, ["same-id"]).then(() => {
    events.push("import may write");
  });

  await Promise.resolve();
  assert.deepEqual(events, []);

  releaseAutosave();
  await importBarrier;

  assert.deepEqual(events, ["autosave finished", "import may write"]);
});

test("library import does not wait for unrelated autosave writes", async () => {
  let releaseUnrelated!: () => void;
  const unrelated = new Promise<void>((resolve) => {
    releaseUnrelated = resolve;
  });
  const inFlight = new Map<string, Promise<void>>([["other-id", unrelated]]);

  await awaitAutosaveWritesForIds(inFlight, ["imported-id"]);
  releaseUnrelated();
});
