import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { JsonFileParseDiagnosticsStore } from "./parseDiagnosticsStore.js";
import type { ParseDiagnosticsReport } from "./parseDiagnostics.js";

function report(id: string): ParseDiagnosticsReport {
  return {
    formatVersion: "parse-diagnostics-v1",
    id,
    jobId: "job-1",
    clientId: "client-a",
    statblockId: "job-1",
    modelProfileId: "default",
    displayHint: "Goblin",
    attempt: 1,
    status: "completed",
    createdAt: "2026-08-28T00:00:00.000Z",
    startedAt: "2026-08-28T00:00:01.000Z",
    completedAt: "2026-08-28T00:00:02.000Z",
    parserVersion: "test",
    model: "qwen-test",
    failure: null,
    source: { rawText: "Goblin", sha256: "abc" },
    statistics: {
      source: { characters: 6, lines: 1, nonEmptyLines: 1, sourceUnits: null, contentUnits: null },
      candidates: { count: null, runCount: null, coveredCandidateCount: null, unclassifiedRunCount: null },
      annotations: { total: 0, byRole: {}, byField: {}, bySection: {}, byProvenance: {} },
      blocks: { total: 0, annotated: 0, unclassified: 0, separator: 0, unclassifiedCharacters: 0 },
      issues: { total: 0, info: 0, warnings: 0, byCode: {} },
      product: {
        hasName: true,
        hasSubtitle: false,
        primaryHeaderRows: 0,
        secondaryHeaderRows: 0,
        bodyNodes: 0,
        headings: 0,
        paragraphs: 0,
      },
    },
    timing: null,
    modelRequest: null,
    rawModelContent: null,
    candidateDebug: null,
    parserReport: null,
    losslessDocument: null,
    editableDocument: null,
  };
}

test("JSON diagnostics store survives a fresh instance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "statblock-diagnostics-"));
  const filePath = join(directory, "parse-reports.json");
  try {
    const first = new JsonFileParseDiagnosticsStore(filePath);
    await first.put(report("job-1-attempt-1"));

    const second = new JsonFileParseDiagnosticsStore(filePath);
    const loaded = await second.list();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0]?.source.rawText, "Goblin");

    const raw = await readFile(filePath, "utf8");
    assert.match(raw, /parse-diagnostics-store-v1/u);
    assert.match(raw, /job-1-attempt-1/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("JSON diagnostics store rejects malformed persisted reports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "statblock-diagnostics-invalid-"));
  const filePath = join(directory, "parse-reports.json");
  try {
    await writeFile(
      filePath,
      JSON.stringify({ formatVersion: "parse-diagnostics-store-v1", reports: [{ formatVersion: "wrong" }] }),
      "utf8",
    );
    await assert.rejects(new JsonFileParseDiagnosticsStore(filePath).list(), /unsupported format/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
