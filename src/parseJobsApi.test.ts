import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { ParseJobService } from "./parseJobService.js";
import { MemoryParseJobStore } from "./parseJobStore.js";
import { MemoryParseDiagnosticsStore } from "./parseDiagnosticsStore.js";
import type { EditableStatblockDocument } from "./productModel.js";
import { handleParseJobsApi } from "./parseJobHttp.js";

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
test("parse job API supports submit, polling, result and acknowledge", async () => {
  let idCounter = 0;
  const service = new ParseJobService({
    store: new MemoryParseJobStore(),
    diagnosticsStore: new MemoryParseDiagnosticsStore(),
    defaultModelProfileId: "default",
    createId: () => `job-${++idCounter}`,
    resolveRunner: () => async (rawText, statblockId) => ({
      editableDocument: document(rawText),
      parserVersion: "test-parser",
      statblockId,
    }),
  });
  await service.initialize();

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (await handleParseJobsApi(request, response, url, service)) return;
    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  try {
    const address = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${address.port}`;
    const client = "browser-a";

    const submittedResponse = await fetch(`${base}/api/parse-jobs?clientId=${client}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify({ source: "Goblin" }),
    });
    assert.equal(submittedResponse.status, 202);
    const submitted = (await submittedResponse.json()) as { id: string; statblockId: string };
    assert.equal(submitted.id, "job-1");
    assert.equal(submitted.statblockId, "job-1");

    const otherClientResponse = await fetch(`${base}/api/parse-jobs?clientId=browser-b`);
    assert.equal(otherClientResponse.status, 200);
    assert.deepEqual(await otherClientResponse.json(), { jobs: [] });

    let status = "";
    for (let index = 0; index < 100; index += 1) {
      const response = await fetch(`${base}/api/parse-jobs/${submitted.id}?clientId=${client}`);
      const job = (await response.json()) as { status: string };
      status = job.status;
      if (status === "completed") break;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    assert.equal(status, "completed");

    const resultResponse = await fetch(`${base}/api/parse-jobs/${submitted.id}/result?clientId=${client}`);
    assert.equal(resultResponse.status, 200);
    const result = (await resultResponse.json()) as {
      statblockId: string;
      editableDocument: EditableStatblockDocument;
    };
    assert.equal(result.statblockId, submitted.id);
    assert.equal(result.editableDocument.facts.name, "Goblin");

    const diagnosticsResponse = await fetch(`${base}/api/parse-reports/export?clientId=${client}`);
    assert.equal(diagnosticsResponse.status, 200);
    const diagnostics = (await diagnosticsResponse.json()) as {
      reports: Array<{ jobId: string; source: { rawText: string } }>;
    };
    assert.equal(diagnostics.reports.length, 1);
    assert.equal(diagnostics.reports[0]?.jobId, submitted.id);
    assert.equal(diagnostics.reports[0]?.source.rawText, "Goblin");

    const deleteResponse = await fetch(`${base}/api/parse-jobs/${submitted.id}?clientId=${client}`, {
      method: "DELETE",
      headers: { "X-Statblock-Client": "statblock-parser" },
    });
    assert.equal(deleteResponse.status, 204);

    const listResponse = await fetch(`${base}/api/parse-jobs?clientId=${client}`);
    const list = (await listResponse.json()) as { jobs: unknown[] };
    assert.deepEqual(list.jobs, []);

    const retainedResponse = await fetch(`${base}/api/parse-reports?clientId=${client}`);
    const retained = (await retainedResponse.json()) as { reports: unknown[] };
    assert.equal(retained.reports.length, 1);

    const reparseResponse = await fetch(`${base}/api/parse-jobs?clientId=${client}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify({ source: "Orc", parserMode: "generic", statblockId: "existing-card" }),
    });
    assert.equal(reparseResponse.status, 202);
    const reparse = (await reparseResponse.json()) as {
      id: string;
      statblockId: string;
      parserMode: string;
      replaceExisting: boolean;
    };
    assert.equal(reparse.id, "job-2");
    assert.equal(reparse.statblockId, "existing-card");
    assert.equal(reparse.parserMode, "generic");
    assert.equal(reparse.replaceExisting, true);

    for (let index = 0; index < 100; index += 1) {
      const response = await fetch(`${base}/api/parse-jobs/${reparse.id}?clientId=${client}`);
      const job = (await response.json()) as { status: string };
      if (job.status === "completed") break;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    const reparseResultResponse = await fetch(`${base}/api/parse-jobs/${reparse.id}/result?clientId=${client}`);
    assert.equal(reparseResultResponse.status, 200);
    const reparseResult = (await reparseResultResponse.json()) as { statblockId: string };
    assert.equal(reparseResult.statblockId, "existing-card");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("parse job API does not expose an upstream failure message", async () => {
  const service = new ParseJobService({
    store: new MemoryParseJobStore(),
    defaultModelProfileId: "default",
    createId: () => "failed-job",
    resolveRunner: () => async () => {
      throw new Error("upstream response contained secret-provider-detail");
    },
  });
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (await handleParseJobsApi(request, response, url, service)) return;
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${address.port}`;
    await fetch(`${base}/api/parse-jobs?clientId=browser-a`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify({ source: "Goblin" }),
    });
    type FailedPayload = { status: string; error: { message: string } | null };
    let payload: FailedPayload | null = null;
    for (let index = 0; index < 100; index += 1) {
      const response = await fetch(`${base}/api/parse-jobs/failed-job?clientId=browser-a`);
      payload = (await response.json()) as FailedPayload;
      if (payload?.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    assert.equal(payload?.status, "failed");
    assert.equal(payload?.error?.message, "The local service could not complete the request.");
    assert.equal(JSON.stringify(payload).includes("secret-provider-detail"), false);

    // A different clientId is a separate routing namespace, not proof of user identity.
    const other = await fetch(`${base}/api/parse-jobs/failed-job?clientId=browser-b`);
    assert.equal(other.status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
