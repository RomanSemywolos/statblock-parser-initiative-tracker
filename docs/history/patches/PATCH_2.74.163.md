# 2.74.163 — Header transport baseline instrumentation

This patch is deliberately diagnostic-only. It establishes a measurable baseline before changing the Header model-facing coordinate transport.

## What changed

- Added `src/headerPromptMetrics.ts`, a pure request-measurement helper.
- Every fixed-Header verifier diagnostic now records `promptMetrics` when a Header request exists, including failed model calls.
- Metrics record:
  - raw source characters;
  - Header candidate count;
  - system-prompt characters;
  - user-prompt characters;
  - serialized JSON-schema characters;
  - combined request text/schema characters;
  - candidate-transport characters inside the current proposal/address sections;
  - deterministic-hint transport characters;
  - Cxxx occurrence counts in the user prompt and JSON schema.
- Added focused tests for universal and singleline prompt measurement.

## Explicit non-changes

This patch does **not** change:

- Header prompts sent to the model;
- the candidate lattice or candidate IDs;
- JSON schema sent to the model;
- Header/BODY ownership;
- model call count;
- model response parsing;
- ability/save recovery;
- deterministic validation;
- BODY normalization/classification;
- product compilation.

`measureHeaderPromptRequest()` only reads an already-created request and returns diagnostics. It never participates in parsing.

## Baseline acceptance rule for the upcoming transport migration

2.74.162 behavior is the control. A later transport must not make any previously working case fail. Existing baseline failures may remain unchanged or improve, but must not spread.

The known Cradle of the Fire Scion ability-label-coordinate failure from the 2.74.162 control corpus is intentionally **not** repaired here, so it remains a useful control case.
