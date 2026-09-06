import assert from "node:assert/strict";
import test from "node:test";

import { ParseJobService } from "./parseJobService.js";
import { MemoryParseJobStore } from "./parseJobStore.js";
import { MemoryParseDiagnosticsStore } from "./parseDiagnosticsStore.js";
import type { EditableStatblockDocument } from "./productModel.js";

function document(name: string): EditableStatblockDocument {
  const abilities = {
    str: { score: 10, modifier: 0 },
    dex: { score: 16, modifier: 3 },
    con: { score: 14, modifier: 2 },
    int: { score: 10, modifier: 0 },
    wis: { score: 12, modifier: 1 },
    cha: { score: 8, modifier: -1 },
  };
  const savingThrows = { str: 0, dex: 3, con: 2, int: 0, wis: 1, cha: -1 };
  return {
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: { id: "name", field: "name", text: name },
      subtitle: { id: "subtitle", field: "size_type_alignment", text: "Medium Humanoid, Neutral" },
      primaryRows: [
        { id: "ac", field: "armor_class", text: "Armor Class 17" },
        { id: "hp", field: "hit_points", text: "Hit Points 42" },
      ],
      abilities,
      savingThrows,
      secondaryRows: [],
    },
    body: [
      { id: "actions", type: "heading", headingKind: "actions", text: "Actions" },
      { id: "feature-1", type: "paragraph", text: "Bite. Melee Weapon Attack: +5 to hit." },
    ],
    facts: {
      name,
      armorClass: 17,
      hitPointMaximum: 42,
      initiative: { modifier: 3, provenance: "dex_modifier" },
      abilities,
      savingThrows,
      proficiencyBonus: 2,
    },
  };
}
async function waitForStatus(service: ParseJobService, clientId: string, id: string, status: string): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if ((await service.get(clientId, id)).status === status) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.fail(`Job ${id} did not reach ${status}.`);
}

test("queue runs one job at a time and completed result keeps stable statblock id", async () => {
  const store = new MemoryParseJobStore();
  const releases: Array<() => void> = [];
  let running = 0;
  let maximumRunning = 0;

  const service = new ParseJobService({
    store,
    defaultModelProfileId: "default",
    resolveRunner: () => async (rawText, statblockId) => {
      running += 1;
      maximumRunning = Math.max(maximumRunning, running);
      await new Promise<void>((resolve) => releases.push(resolve));
      running -= 1;
      return { editableDocument: document(rawText), parserVersion: "test", statblockId };
    },
  });

  const first = await service.submit("client-a", "Goblin", "default");
  const second = await service.submit("client-a", "Orc");
  assert.equal(first.modelProfileId, "default");
  await waitForStatus(service, "client-a", first.id, "processing");
  assert.equal((await service.get("client-a", second.id)).status, "queued");

  releases.shift()?.();
  await waitForStatus(service, "client-a", first.id, "completed");
  await waitForStatus(service, "client-a", second.id, "processing");
  releases.shift()?.();
  await waitForStatus(service, "client-a", second.id, "completed");

  assert.equal(maximumRunning, 1);
  const result = await service.result("client-a", first.id);
  assert.equal(result.statblockId, first.id);
  assert.equal(result.editableDocument.facts.name, "Goblin");
});

test("initialize requeues processing jobs after backend restart", async () => {
  const store = new MemoryParseJobStore();
  await store.put({
    id: "job-1",
    clientId: "client-a",
    statblockId: "job-1",
    modelProfileId: "default",
    displayHint: "Goblin",
    status: "processing",
    createdAt: "2026-08-27T10:00:00.000Z",
    startedAt: "2026-08-27T10:00:01.000Z",
    completedAt: null,
    error: null,
    attempt: 1,
    rawText: "Goblin",
    result: null,
  });

  const service = new ParseJobService({
    store,
    defaultModelProfileId: "default",
    resolveRunner: () => async (rawText, statblockId) => ({
      editableDocument: document(rawText),
      parserVersion: "test",
      statblockId,
    }),
  });

  await service.initialize();
  await waitForStatus(service, "client-a", "job-1", "completed");
  assert.equal((await service.result("client-a", "job-1")).statblockId, "job-1");
});

test("failed job retains source and can retry", async () => {
  const store = new MemoryParseJobStore();
  let fail = true;
  const service = new ParseJobService({
    store,
    defaultModelProfileId: "default",
    resolveRunner: () => async (rawText, statblockId) => {
      if (fail) throw new Error("boom");
      return { editableDocument: document(rawText), parserVersion: "test", statblockId };
    },
  });

  const job = await service.submit("client-a", "Lich");
  await waitForStatus(service, "client-a", job.id, "failed");
  fail = false;
  await service.retry("client-a", job.id);
  await waitForStatus(service, "client-a", job.id, "completed");
  assert.equal((await service.result("client-a", job.id)).editableDocument.facts.name, "Lich");
});

test("diagnostics persistence failure cannot turn a successful parse into a failed job", async () => {
  const service = new ParseJobService({
    store: new MemoryParseJobStore(),
    diagnosticsStore: {
      async put() {
        throw new Error("diagnostics unavailable");
      },
      async list() {
        return [];
      },
      async get() {
        return null;
      },
    },
    defaultModelProfileId: "default",
    createId: () => "diagnostics-failure-job",
    resolveRunner: () => async (rawText, statblockId) => ({
      editableDocument: document(rawText),
      parserVersion: "test-parser",
      statblockId,
    }),
  });

  const originalError = console.error;
  console.error = () => undefined;
  try {
    const job = await service.submit("client-a", "Goblin");
    await waitForStatus(service, "client-a", job.id, "completed");
    assert.equal((await service.result("client-a", job.id)).editableDocument.facts.name, "Goblin");
  } finally {
    console.error = originalError;
  }
});

test("completed diagnostics survive queue acknowledgement and retain exact source", async () => {
  const diagnosticsStore = new MemoryParseDiagnosticsStore();
  let idCounter = 0;
  const service = new ParseJobService({
    store: new MemoryParseJobStore(),
    diagnosticsStore,
    defaultModelProfileId: "default",
    createId: () => `diagnostic-job-${++idCounter}`,
    resolveRunner: () => async (rawText, statblockId) => ({
      editableDocument: document(rawText),
      parserVersion: "test-parser",
      statblockId,
    }),
  });

  const job = await service.submit("client-a", "Exact Source\nHP 10");
  await waitForStatus(service, "client-a", job.id, "completed");

  let reports = await service.listDiagnostics("client-a");
  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.id, `${job.id}-attempt-1`);
  assert.equal(reports[0]?.statistics.source.lines, 2);

  const full = await service.getDiagnostics("client-a", `${job.id}-attempt-1`);
  assert.equal(full.source.rawText, "Exact Source\nHP 10");
  assert.equal(full.status, "completed");

  await service.delete("client-a", job.id);
  assert.equal((await service.list("client-a")).length, 0);
  reports = await service.listDiagnostics("client-a");
  assert.equal(reports.length, 1);
});

test("retry creates a separate diagnostic attempt", async () => {
  const diagnosticsStore = new MemoryParseDiagnosticsStore();
  let fail = true;
  const service = new ParseJobService({
    store: new MemoryParseJobStore(),
    diagnosticsStore,
    defaultModelProfileId: "default",
    createId: () => "retry-diagnostic-job",
    resolveRunner: () => async (rawText, statblockId) => {
      if (fail) throw new Error("first attempt failed");
      return { editableDocument: document(rawText), parserVersion: "test-parser", statblockId };
    },
  });

  const job = await service.submit("client-a", "Lich");
  await waitForStatus(service, "client-a", job.id, "failed");
  fail = false;
  await service.retry("client-a", job.id);
  await waitForStatus(service, "client-a", job.id, "completed");

  const reports = await service.listDiagnostics("client-a");
  assert.deepEqual(
    reports.map((report) => [report.attempt, report.status]),
    [
      [1, "failed"],
      [2, "completed"],
    ],
  );
});

test("job execution resolves the runner from the selected model profile", async () => {
  const store = new MemoryParseJobStore();
  const calls: string[] = [];
  const service = new ParseJobService({
    store,
    defaultModelProfileId: "default",
    resolveRunner: (profileId) => async (rawText, statblockId) => {
      calls.push(`${profileId}:${rawText}`);
      return { editableDocument: document(rawText), parserVersion: profileId, statblockId };
    },
  });

  const remote = await service.submit("client-a", "Remote creature", "groq-gpt-oss-120b");
  await waitForStatus(service, "client-a", remote.id, "completed");
  assert.deepEqual(calls, ["groq-gpt-oss-120b:Remote creature"]);
  assert.equal((await service.result("client-a", remote.id)).parserVersion, "groq-gpt-oss-120b");
});

test("reparse submission targets an existing statblock id without reusing the job id", async () => {
  const calls: Array<{ rawText: string; statblockId: string; parserMode: string | undefined }> = [];
  const service = new ParseJobService({
    store: new MemoryParseJobStore(),
    defaultModelProfileId: "default",
    createId: () => "reparse-job",
    resolveRunner: () => async (rawText, statblockId, parserMode) => {
      calls.push({ rawText, statblockId, parserMode });
      return {
        editableDocument: document(rawText),
        parserVersion: "test",
        statblockId,
        parserMode,
        rawSource: rawText,
      };
    },
  });

  const job = await service.submit("client-a", "Exact source", "default", "generic", "library-card-1");
  assert.equal(job.id, "reparse-job");
  assert.equal(job.statblockId, "library-card-1");
  assert.equal(job.replaceExisting, true);
  assert.equal(job.parserMode, "generic");

  await waitForStatus(service, "client-a", job.id, "completed");
  assert.deepEqual(calls, [{ rawText: "Exact source", statblockId: "library-card-1", parserMode: "generic" }]);
  const result = await service.result("client-a", job.id);
  assert.equal(result.statblockId, "library-card-1");
  assert.equal(result.rawSource, "Exact source");
});
