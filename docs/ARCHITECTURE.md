# Current architecture

This document describes the current system. Versioned notes under `history/` are archived experiments and may intentionally contradict it.

## Parser ownership

The raw source is immutable. Model responses select source coordinates and limited semantic identities; they do not author final source text or authoritative numbers.

### Header

- Multiline and mixed inputs use coordinate spans over preserved source geometry.
- Single-line input uses the accepted 2.74.208 transport: full scalar/identity spans and six canonical ability-label anchors.
- Deterministic validators resolve coordinates, verify mechanics, derive exact values, and accept ownership.
- Single-line ability-region boundaries are reconstructed from six proven labels and printed numeric cells; the model does not select an outer ability-table span.

### Body

BODY is exactly the source not owned by accepted Header evidence. There is no global `bodyStart` handoff.

- Clean multiline input goes directly to the shared deterministic BODY parser.
- Mixed and single-line input may make one starts-only normalization call.
- The model restores logical line starts only; deterministic code retains line ends and source text.
- All routes converge on the same deterministic multiline BODY interpretation.

### Parser module boundaries

- `pipeline.ts` coordinates routing and the shared Header verification stage.
- `pipelineMultiline.ts`, `pipelineSingleline.ts`, and `pipelineMixed.ts` own their mode-specific BODY stages.
- `pipelineTypes.ts` and `pipelineSupport.ts` contain shared contracts and source-neutral helpers.
- `headerFacts.ts` performs final enrichment orchestration; ability/save resolution, scalar facts, and coordinate primitives live in `headerAbilityFacts.ts`, `headerScalarFacts.ts`, and `headerFactPrimitives.ts`.

## Product data

`SavedStatblock` contains English and optional Ukrainian versioned documents. Each language has `working` autosave state, an explicit `saved` checkpoint, and an immutable parse/translation `backup` baseline.

Manual and automatic saves do not rotate `backup`. Reparsing replaces the English baseline; translating replaces the Ukrainian baseline.

## Persistence

- `IndexedDbStatblockRepository`: local library, returned alphabetically by name.
- `IndexedDbEncounterRepository`: encounter and combat state.
- `IndexedDbSettingsRepository`: non-secret frontend settings.
- JSON file stores: backend parse jobs and diagnostics.

Modern library documents, encounter records, settings, parse jobs, and diagnostic report envelopes are runtime-validated at their persistence boundary. Legacy shapes are admitted only through explicit migration paths.

JSON stores write through process- and operation-unique temporary files before atomic rename, so concurrent backend processes cannot collide on one fixed `.tmp` path.

Autosave coordinators serialize writes per aggregate. An immediate write waits for an older in-flight autosave, preventing stale completion from overwriting newer state.

## Encounter model

A statblock combatant keeps a `statblockId` reference and a snapshot fallback. While the library entry exists, presentation resolves from the current library document/config; the snapshot keeps the combatant usable if its source disappears. Combat state—HP, initiative, overrides, and limited-use counts—is instance-owned and persisted per combatant.

Parse-job polling is single-flight. A second interval tick cannot import or delete the same completed job while the previous synchronization is running.

## HTTP boundary

`webApp.ts` composes model, translation, parse-job, and diagnostic routes. The legacy diagnostic page is isolated in `diagnosticAppHtml.ts`, so HTTP behavior can evolve without editing a large embedded HTML literal. Browser access is guarded centrally and again inside the standalone parse-job handler. Ordinary HTTP failures and failed-job summaries expose stable public messages; upstream details remain in local server logs and explicit diagnostics rather than leaking through error responses. Provider clients and storage modules remain independently testable.

## Frontend boundaries

`App.tsx` is the composition root. Stateful workflows are grouped in `hooks/`: settings, parse jobs, encounter state, and dice. Sidebar/workspace panels live in `panels/`; statblock rendering and editing live in `statblock/`. `AppPanels.tsx` and `StatblockViews.tsx` remain small compatibility barrels so existing imports do not need to know the physical file layout.
