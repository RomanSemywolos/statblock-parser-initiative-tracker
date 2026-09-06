import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { ParseJobRecord } from "./parseJobs.js";
import { JsonFileParseJobStore } from "./parseJobStore.js";

function record(id: string): ParseJobRecord {
  return {
    id,
    clientId: "browser",
    statblockId: id,
    modelProfileId: "default",
    displayHint: id,
    status: "queued",
    createdAt: "2026-09-06T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    error: null,
    attempt: 1,
    rawText: "Goblin",
    result: null,
  };
}

test("JSON parse-job store persists serialized mutations and returns isolated records", async () => {
  const directory = await mkdtemp(join(tmpdir(), "statblock-job-store-"));
  const path = join(directory, "nested", "jobs.json");
  const first = new JsonFileParseJobStore(path);
  await Promise.all([first.put(record("one")), first.put(record("two"))]);

  const second = new JsonFileParseJobStore(path);
  const loaded = await second.list();
  assert.deepEqual(
    loaded.map((entry) => entry.id),
    ["one", "two"],
  );
  loaded[0]!.displayHint = "external mutation";
  assert.equal((await second.list())[0]?.displayHint, "one");

  await second.delete("one");
  assert.deepEqual(
    (await new JsonFileParseJobStore(path).list()).map((entry) => entry.id),
    ["two"],
  );
});

test("same parse-job store preserves mutation invocation order during initial loading", async () => {
  const directory = await mkdtemp(join(tmpdir(), "statblock-job-store-order-"));
  const path = join(directory, "nested", "jobs.json");
  const store = new JsonFileParseJobStore(path);
  const ids = Array.from({ length: 20 }, (_, index) => `job-${index.toString().padStart(2, "0")}`);

  await Promise.all(ids.map((id) => store.put(record(id))));

  assert.deepEqual(
    (await new JsonFileParseJobStore(path).list()).map((entry) => entry.id),
    ids,
  );
});

test("JSON parse-job store rejects a malformed modern record", async () => {
  const directory = await mkdtemp(join(tmpdir(), "statblock-job-store-invalid-"));
  const path = join(directory, "jobs.json");
  await writeFile(path, JSON.stringify({ formatVersion: "parse-jobs-v1", jobs: [{ id: 42 }] }), "utf8");
  await assert.rejects(new JsonFileParseJobStore(path).list(), /parse job\.id must be a string/u);
});

test("separate file-store instances use collision-safe temporary files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "statblock-job-store-concurrent-"));
  const path = join(directory, "jobs.json");
  const first = new JsonFileParseJobStore(path);
  const second = new JsonFileParseJobStore(path);
  await Promise.all([first.put(record("first")), second.put(record("second"))]);
  assert.equal((await new JsonFileParseJobStore(path).list()).length, 1);
});
