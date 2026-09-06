# Patch 2.74.145

## Scope

This patch is a corrective pass over the 2.74.144 BODY-normalization rollout. It keeps the canonical architecture unchanged:

`Header verification -> exact Header ownership -> BODY complement -> one geometry-only BODY LLM call -> restored multiline rows -> shared deterministic multiline parser`.

No BODY semantic classification was reintroduced.

## Singleline: BODY address lattice is no longer the Header dense-prefix lattice

2.74.144 reused the full prepared singleline lattice for BODY normalization. That lattice intentionally contains a historical dense-prefix addressability window so the fixed Header verifier can ground unfamiliar compact labels in collapsed input. In practice, qwen3:8b interpreted hundreds of weak token coordinates as hundreds of plausible logical rows.

2.74.145 separates these concerns without changing Header behavior:

- `prepareCandidateLattice(..., "singleline")` remains over-complete and Header-safe;
- `singlelineBodyNormalizationCandidates(...)` derives a BODY-only coordinate view;
- a candidate is removed only when its **sole** audited provenance is `dense_prefix_address`;
- candidates with any independent geometry, punctuation, title-lookback, list, profile, table, or synthetic structural provenance remain available;
- the BODY model still returns only `starts`;
- exact source and Header ownership are unchanged.

On the six singleline reports from the 2.74.144 manual batch, this removes 112-156 pure dense-prefix token addresses per statblock while retaining the independently supported coordinates needed for reconstruction.

## Mixed: revert the prompt-side Legendary Actions experiment

The 2.74.143/144 mixed prompt addition that taught the special `standalone row -> explanatory paragraph -> peer entries` pattern was removed. Manual tests showed that it did not reliably solve the target case and changed unrelated qwen3:8b boundary decisions.

Instead, 2.74.145 uses one narrow source-proven geometry rule:

- when a BODY candidate is a compact standalone physical ALL-CAPS row, its own physical row is preserved as a logical row;
- the following physical BODY row is also preserved as a separate logical row;
- Header gaps stop this rule;
- the rule assigns no section kind, heading identity, or D&D meaning.

This is deterministic preservation of surviving physical geometry, not semantic BODY parsing. All other mixed boundaries remain model-restored.

The Auto Style rescue added previously remains available as presentation fallback; it is not the source of the boundary decision.

## Tests

Added regressions for:

- BODY singleline lattice dropping pure dense-prefix addresses while retaining independently supported starts;
- mixed ALL-CAPS physical row remaining separate even when the BODY model omits the following explanatory-row start;
- mixed prompt no longer containing the reverted Example 8.

Validation:

- `tsc --noEmit`: passed;
- compiled Node suite: **537/537 passed**.
