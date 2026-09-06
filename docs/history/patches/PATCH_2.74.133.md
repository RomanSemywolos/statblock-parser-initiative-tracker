# v2.74.133 — Multiline ownership-first Header/BODY split

This patch intentionally migrates **multiline only**. Mixed and singleline keep their previous staged implementations until the next patches.

## Architectural correction

The multiline parser no longer asks an LLM for a global Header/BODY boundary. `bodyStart` is not used by the new multiline production path.

The normal multiline flow is now:

`whole source -> one fixed-header locator LLM -> deterministic fixed-fact validation -> accepted Header ownership -> physical Header presentation rows -> deterministic complement BODY`

The LLM proposes only the closed fixed-header facts. Deterministic code validates exact source evidence and exact printed mechanics. Accepted evidence creates Header ownership. Any non-owned source remains BODY and is parsed by physical line structure.

## Safety changes

- Header locator failure is non-critical: source remains lossless and deterministic BODY parsing still runs.
- Optional ability-label hints are accepted only when grounded inside a model-proposed complete ability region.
- Strict ownership validation does not extend a truncated ability region into neighboring source. The proposal is rejected instead.
- Multiline BODY physical-line runs are trusted as the structural unit; downstream feature-boundary repair is disabled for this path so it cannot split one proven physical row at an internal sentence.

## Intentionally unchanged

- Mixed/generic architecture still contains the legacy Header scan / `bodyStart` flow for now.
- Singleline still uses the v2.74.132 whole-source boundary pass followed by frozen-block h/f/p/u classification.
- The old `createMultilineBodyPlan(..., bodyStartCandidate)` helper remains temporarily because legacy staged modes/tests still reference it. It is not the production multiline architecture.

See `ARCHITECTURE_HEADER_OWNERSHIP.md` for the canonical rules and the next two migration stages.
