# Patch 2.74.164 — reversible Header coordinate overlay infrastructure

## Scope

This patch is the second controlled step of the Header transport migration. It does **not** switch the production Header model request to an annotated/shadow source and does not change Header semantics, ownership, BODY normalization, candidate generation, model-call count, or deterministic verification.

## Added

- `src/headerCoordinateOverlay.ts`
  - builds a model-facing shadow representation by inserting one service marker `⟦Cxxx⟧` at each already-existing Header candidate start;
  - never creates, removes, reorders, or semantically classifies candidates;
  - preserves the current inclusive `s/e` range contract (`e` owns through the next candidate start or EOF);
  - provides exact `Cxxx -> raw start/raw candidate span` mapping;
  - can restore the canonical raw source by removing only markers inserted by the overlay instance, so literal marker-looking text in source is preserved;
  - rejects malformed duplicate/unsorted coordinate input instead of silently reindexing it.

- Header prompt diagnostics now compute a **hypothetical** shadow-source comparison while continuing to send the legacy request to the model:
  - `shadowOverlayValid`
  - `shadowSourceCharacters`
  - `shadowCoordinateMarkerCharacters`
  - `shadowCoordinateCount`
  - `coordinateTransportCharacterDelta`

The last value compares only coordinate-transport overhead: `shadow marker chars - current candidate transport chars`. A negative value is the exact character saving available if the duplicated candidate transport is later replaced by the current overlay representation. It is not yet a prediction of total prompt tokens.

## Safety / non-regression rules

- The request passed to the Header LLM is byte-for-byte built by the same legacy prompt functions as 2.74.163.
- The same candidate lattice and candidate indexes are used.
- JSON schema remains unchanged.
- BODY path is unchanged.
- Raw source remains canonical and untouched.
- Overlay measurement is diagnostics-only and fail-closed: if an unexpected malformed lattice prevents overlay construction, the parse still proceeds and the shadow comparison fields become unavailable rather than affecting parsing.
- Known 2.74.162/2.74.163 stochastic baseline defects are not repaired in this patch.

## Tests

Added regression coverage for:

- exact raw-source reconstruction;
- one-to-one candidate/marker preservation;
- Unicode and vertical ability-table geometry;
- literal marker-looking source text;
- exact legacy inclusive coordinate-range semantics;
- duplicate/unsorted candidate rejection;
- diagnostics fail-closed behavior;
- universal and singleline transport measurement.

Full compiled core suite: **576/576 PASS**.
