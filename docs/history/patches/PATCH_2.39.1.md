# v2.39.1 — diagnostics build fix

v2.39.0 introduced `ParseDiagnosticsModelRequest` as a duplicated, narrower version of
`StructuredModelRequest`.

The parser's real request contract intentionally allows the generation options to be omitted:

```ts
temperature?: number;
seed?: number;
numCtx?: number;
numPredict?: number;
timeoutMs?: number;
```

The diagnostics copy incorrectly required all five fields, so assigning the real request to the
diagnostics record failed under the production TypeScript build.

v2.39.1 removes the duplicated contract:

```ts
export type ParseDiagnosticsModelRequest = StructuredModelRequest;
```

Diagnostics therefore cannot silently drift from the actual parser request type again.

`ParseJobRunnerDiagnostics.pipeline.modelRequest` is also now nullable, matching
`AnalyzeStatblockResult.modelRequest`, and the two unsafe `analyzed.modelRequest!` assertions were
removed.

The esbuild "service is no longer running" message seen after the TypeScript errors was a cascading
failure from the frontend predev command invoking the failed root build; it is not a separate parser
or esbuild defect.
