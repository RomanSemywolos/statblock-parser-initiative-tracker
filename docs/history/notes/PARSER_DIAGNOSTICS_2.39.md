# v2.39 — persistent parser diagnostics

Every async parse attempt now produces a persistent diagnostic record. Diagnostics are deliberately
separate from the parse-job queue: browser ACK/deletion removes the queue record but not the report.
Retries create separate attempt records.

## Persistent location

Default backend file:

```text
.statblock-parser/parse-reports.json
```

Override with:

```text
STATBLOCK_REPORT_PATH=<path>
```

The backend prints the resolved diagnostics path at startup.

The file is an append/update journal keyed by `<job-id>-attempt-<n>` and is gitignored together with
`.statblock-parser/`.

## What each report contains

- job/client/statblock IDs, model profile, attempt number and timestamps;
- completed/failed status and failure stage/message;
- exact raw source text and source SHA-256 when source-map construction succeeded;
- exact structured-model request:
  - model;
  - system prompt;
  - user prompt/candidate transport;
  - JSON schema;
  - temperature, seed, numCtx, numPredict and timeout;
- raw model response;
- complete timing report, including Ollama token/performance metrics when available;
- candidate transport diagnostics and every candidate run decision;
- complete lossless parser document:
  - source map;
  - annotations and source spans;
  - lossless blocks;
  - normalized view ownership;
  - structured header facts;
  - model summary;
  - integrity summary;
  - parser issues;
- compact `ParserReport`;
- final editable product document, or `null` if compilation failed;
- derived per-attempt statistics:
  - source characters/lines/units;
  - candidate/run/coverage counts;
  - annotations grouped by role/field/section/provenance;
  - block counts and unclassified character count;
  - issue counts/by-code;
  - product name/subtitle/header/body counts.

A parser failure before a lossless document exists still writes a report containing the exact source,
job metadata and failure information. A compile failure retains the full parser diagnostics and leaves
`editableDocument: null`.

## HTTP API

All routes retain the existing browser `clientId` scoping:

```text
GET /api/parse-reports
GET /api/parse-reports/:reportId
GET /api/parse-reports/export
```

`/export` returns all retained reports for the current browser plus aggregate statistics:

- total/completed/failed reports;
- unique jobs;
- total source characters/issues/unclassified blocks;
- reports missing name/subtitle;
- average pipeline time;
- counts by model profile/parser version/failure stage.

## Frontend

Settings now contains `Експорт звітів парсера`. It downloads one JSON bundle suitable for attaching to
an analysis conversation or keeping beside a regression fixture.

This export is intentionally independent of Library export.
