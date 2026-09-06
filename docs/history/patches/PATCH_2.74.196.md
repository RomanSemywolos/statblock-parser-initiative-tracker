# Patch 2.74.196 — persisted raw source and card-local parser controls

Base: 2.74.195 budget-control baseline.

Purpose: improve parser QA/replay workflow without changing mixed parsing semantics.

## Product persistence

`SavedStatblock` now keeps the exact source text that was supplied to the parser:
- `rawSource` — immutable parser input retained with the library card;
- `importedParserMode` — requested parser mode (`auto`, `multiline`, `singleline`, `generic`);
- existing `importedParserStructure` continues to record the resolved structure (`multiline`, `singleline`, `mixed`);
- existing `importedWithParserVersion` continues to record the parser version.

Old saved-statblock-v1/v2 entries remain loadable. Missing `rawSource` / requested-mode metadata migrates to `null`.
Library JSON export/import preserves the new fields.

## Reparse workflow

The async parse-job protocol can now target an existing library statblock ID without reusing the job ID.
Such jobs are explicitly marked `replaceExisting` so normal import acknowledgement remains idempotent.

On successful reparse:
- the same library card ID and creation timestamp are preserved;
- the EN parser-owned document is replaced by the fresh parse;
- the exact saved raw source remains the input authority;
- parser version, requested mode and resolved structure are updated;
- built-in card visibility preferences are preserved;
- stale custom content IDs are cleared;
- the UK version is removed because it belongs to the previous parsed document shape and may no longer align with the new one.

## Card UI

The former workspace-header block containing:
- EN / UK / translate;
- Edit;
- Card settings;

has moved onto the statblock card itself behind a compact `⋯` button at the card's upper-right.

For library cards the expanded panel also shows:
- current resolved parser structure;
- requested mode used for the import when known;
- parser version;
- parser-mode selector for the next run;
- `Розібрати знову` action;
- a collapsed view of the stored original source text.

Cards imported before 2.74.196 have no stored raw source and therefore show reparse as unavailable until they are imported again with this version or later.

The temporary parser-structure badge was removed from library-list cards.

## Workspace header

The dice-expression control remains in the workspace header.
The roll journal now occupies the right side of the header, replacing the space formerly used by the card controls.
The active-combat `Далі →` action remains available with the workspace/settings controls.

## Parser quality isolation

No parsing-semantic file was changed for this feature. The following files are byte-identical to 2.74.195:
- `src/prompt.ts`
- `src/modelSchema.ts`
- `src/candidateLattice.ts`
- `src/deterministicHints.ts`
- `src/multilineDeterministic.ts`
- `src/pipeline.ts`
- `src/sourceCandidates.ts`
- `src/boundaryEvidence.ts`
- `src/bodyCompletionBudget.ts`

`productParseJobRunner.ts` changes only the product result metadata by returning the already-existing exact `rawText` and requested parser mode.

## Small UI type fix

The Evidence-panel label map now includes `proficiency_bonus`, matching the existing `EditableHeaderEvidenceField` union. This is presentation-only and does not affect parser ownership or extraction.

## Validation

- core `npm run typecheck`: PASS
- core `npm run build`: PASS
- compiled core Node suite: 601 / 601 PASS
- frontend TypeScript (`tsc -p frontend/tsconfig.json --noEmit`): PASS
- focused tests cover raw-source persistence, library export/import, targeted reparse jobs, replacement semantics and parser-result metadata.

A full Vite bundle could not be executed in the validation container because the available cached dependency tree lacks Rollup's Linux optional native package. Frontend TypeScript compilation completed successfully.
