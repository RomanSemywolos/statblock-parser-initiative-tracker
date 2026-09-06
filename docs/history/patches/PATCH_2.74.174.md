# Patch 2.74.174 — numeric-coordinate Header shadow transport

## Scope

This patch is a transport-only A/B experiment. It does not change authoritative Header ownership, BODY normalization/classification, deterministic validation, source coordinates, or product compilation.

The authoritative Header request remains the established legacy request with string candidate IDs (`C000`, `C001`, ...), per-request enum schema, and the existing SOURCE EXCERPT / STRUCTURAL PROPOSALS presentation.

The shadow Header request now keeps the same source and proposal presentation but changes only the output coordinate encoding:

- visible proposal addresses remain `Cxxx`;
- shadow `s` / `e` are integer candidate indexes (`2` means `C002`);
- ranges remain inclusive, exactly like the established legacy candidate-range contract;
- the JSON schema constrains `s` / `e` as integers with `minimum: 0` and `maximum: candidateCount - 1`;
- deterministic code adapts those integers back to the existing `Cxxx` inclusive contract before the established Header parser/validator.

The shadow system prompt differs from legacy only where necessary to explain the numeric coordinate output contract. The shadow user prompt — including clean SOURCE EXCERPT, STRUCTURAL PROPOSALS, SOURCE-SHAPE HINTS, and singleline structural/address channels — remains unchanged from legacy.

## Why

2.74.173 showed that replacing the per-candidate enum with a regex string schema restored legacy semantic presentation but allowed one real protocol failure: the model returned source text in `s/e` instead of candidate IDs. Numeric structured fields test whether we can remove the large ID enum while retaining strong constrained generation.

## Safety

- Legacy Header remains authoritative.
- Shadow failures and divergences are diagnostics-only.
- No semantic dictionaries or STA-specific repair were added.
- No candidate pruning or projection was added.
- No BODY behavior changed.
- Raw source remains authoritative and reconstructable.
