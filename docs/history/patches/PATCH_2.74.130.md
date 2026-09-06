# Patch 2.74.130 — whole-source transition segmentation for single-line input

## Scope

This patch changes only the **single-line/collapsed structural handoff**. Multiline
and mixed/generic parsing keep their existing body-span path. Header/card-fact
extraction and independent essential verification remain separate.

## Change

Single-line structural parsing no longer receives Header-subtracted remainder
segments. One structural model call now sees the complete collapsed source and
returns only ordered **transition starts**:

- `sh` — printed section heading;
- `f` — named feature/rule/action/option;
- `r` — section-wide introductory/rules prose;
- `sc` — uncertain body content;
- `sup` — trailing supplementary content.

The model never returns end coordinates. Deterministic code sorts accepted
transitions and assigns each transition through immediately before the next one.
This makes gaps/overlaps between model-owned body spans impossible by construction.

## Context vs ownership

The structure model can read the complete source, including Header metadata, for
semantic context. Accepted Header ownership remains independent and is not used as
a source cutoff. A model transition whose start falls inside already accepted
Header ownership is rejected deterministically.

`bodyStart` remains in the legacy universal Header scan for now, but single-line
structure does not use it as a cutoff or source boundary.

## Model view

The single-line prompt receives an annotated whole-source view. Sparse out-of-band
`⟦Cxxx|...⟧` markers are inserted beside source-shape-interesting coordinates. The
markers are explicitly declared non-source. A compact exact-address table remains
available so the model can choose any grounded candidate, not only hinted starts.
Confirmed/internal list evidence is described as hierarchy evidence against
top-level promotion.

## Deliberately unchanged

- Header semantic scan/schema;
- independent essential verifier;
- Header ownership resolver;
- exact fact extraction;
- mixed/multiline structure paths;
- candidate generation and source-losslessness invariants;
- product compiler and Auto Style.

## Tests

Added regression coverage for:

- transition schema containing only `at` + semantic kind (no end coordinate);
- deterministic transition-to-span partition;
- duplicate transition-start rejection;
- inline sparse anchor model view;
- single-line pipeline reading the whole source even when legacy `bodyStart` points
  much later;
- one single-line structural call instead of multiple remainder-segment calls.

`npm run typecheck` and `npm run build` pass. Compiled test suite: **519/519**.
