# M13 — Parser → Product integration

M13 closes the main vertical gap between the existing lossless parser and the React product.

## Boundary

The browser never receives `LosslessStatblockDocument`, candidates, annotations, source maps,
model responses, parser reports, or reconciliation diagnostics.

A completed backend job exposes only:

```ts
type ParseJobResult = {
  editableDocument: EditableStatblockDocument;
  parserVersion: string;
  statblockId: string;
};
```

The browser converts that DTO into `SavedStatblock` and stores it in the existing local
`StatblockRepository`.

## Asynchronous lifecycle

```text
React raw text
  -> POST /api/parse-jobs
  -> queued
  -> processing
  -> ProductParseJobRunner
       -> lossless parser
       -> compileToEditableStatblock()
  -> completed result retained on backend
  -> browser GET result
  -> IndexedDB.put(SavedStatblock)
  -> DELETE/ACK backend job
```

The backend queue has concurrency 1. Submitting more jobs never blocks the browser.

`statblockId` is allocated together with `job.id` and is stable. If the browser writes the result
to IndexedDB and crashes before ACK, the next load sees the same completed job, finds the same
statblock ID already stored, and only retries ACK. It does not create a duplicate.

## Persistence and restart

Jobs are persisted in an atomic JSON file (`.statblock-parser/parse-jobs.json` by default).

- queued source is retained;
- processing source is retained;
- failed source is retained for Retry;
- completed source is removed;
- completed `EditableStatblockDocument` is retained until ACK.

On backend restart, any persisted `processing` job becomes `queued` and is run again.

The JSON store only publishes a mutation to readers after the replacement file has been written
successfully. This prevents a job from appearing `completed` in memory before its durable state
exists on disk.

## Model boundary

`pipeline.ts` no longer calls Ollama directly. It consumes an injected neutral
`StructureModelCaller`.

`OllamaModelProvider` implements the new `ModelProvider` interface. The application currently has
one profile (`default`) but every job records `modelProfileId`, and the queue resolves a runner by
that profile. This leaves room for remote/cloud providers without rewriting the parser or queue.

The legacy `parseForProduct()` adapter still provides Ollama as a compatibility default when called
directly. The normal application backend uses the provider explicitly.

Important: the lossless parser deliberately treats a model request failure as a recoverable parser
condition and preserves the source as unclassified content. M13 does not change that behavior.
A job becomes `failed` only when the product parse/compile itself cannot produce a product document,
or when backend/model-profile infrastructure is invalid.

## HTTP API

```text
POST   /api/parse-jobs?clientId=...
GET    /api/parse-jobs?clientId=...
GET    /api/parse-jobs/:id?clientId=...
GET    /api/parse-jobs/:id/result?clientId=...
POST   /api/parse-jobs/:id/retry?clientId=...
DELETE /api/parse-jobs/:id?clientId=...
```

`clientId` is a stable browser-local UUID used for routing jobs belonging to independent DM
browsers. It is not an authentication/security boundary.

The old synchronous `/api/parse` route remains available as a diagnostic fallback.

## React

The Library sidebar now has `+ Імпортувати`.

Submitting immediately clears/closes the input. Queued, processing, and failed jobs remain visible
in the sidebar while the rest of the application remains usable.

The frontend polls every 1.5 seconds. After F5 it asks the backend for the same client jobs and
restores their visible lifecycle. Completed jobs are imported silently and do not replace whatever
statblock/combatant the user is currently viewing.

Failed jobs support Retry and removal. Queued jobs can be cancelled. A processing job cannot be
deleted.

## Storage ownership

User library, encounter, settings and edited documents remain local-first in browser IndexedDB.
The backend owns only temporary parse-job data and model infrastructure.
