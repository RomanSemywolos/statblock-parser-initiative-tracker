# Patch 2.74.5

Conservative mixed-parser/header/editor fixes after soft-wrapped web-copy regression testing.

## Mixed identity geometry

`enrichGenericCandidates()` now removes only weak intermediate pre-header line boundaries when the previous printed line is visibly unfinished. The final pre-header boundary remains available to the LLM. This allows a soft-wrapped identity such as:

```
Lolth, Queen of the
Demonweb
Huge fiend (demon), chaotic evil
Armor Class ...
```

to expose `Lolth, Queen of the\nDemonweb` as one generic candidate while retaining `Huge fiend ...` as the next candidate.

This logic is generic/mixed-only. Universal candidate generation, multiline enrichment and singleline enrichment are unchanged.

## Grounded multi-field header ownership

`compileLosslessDocument()` has a narrow `splitGroundedHeaderOwnership` opt-in. The main pipeline enables it only for `generic` routing while keeping `preserveStructuralOwnership: true`.

This reuses the existing deterministic `splitGroundedMultiFieldHeaders()` logic only when a model-owned header span contains multiple independently printed canonical header labels, e.g.:

```
Armor Class 24 (natural armor) Hit Points 1,000 (87d10 + 522)
```

No broad header reconciliation is re-enabled. Multiline and singleline do not opt into this split.

## Editor nowrap for DC atoms

The read-only renderer already wrapped `DC 23` / `СК 23`, but the contentEditable body editor used a separate hydration path. Editor hydration now inserts transparent `.mechanic-nowrap` spans for these atoms. The wrapper is marked as auto-format and serializes back to the exact original plain text.

CSS also explicitly resets `overflow-wrap` and `word-break` inside `.mechanic-nowrap`.

## Regression coverage

Added tests for:
- mixed-only folding of a soft-wrapped identity boundary while multiline geometry remains unchanged;
- opt-in deterministic splitting of a direct model-owned multi-field header span with exact reconstruction.

Manual executable smoke checks additionally confirmed:
- Lolth-like Auto routing remains `generic` / `mixed`;
- Erlking wrapped action references remain continuations;
- inline `Hit Points` candidate exists in generic but not multiline;
- grounded AC/HP split reconstructs the source exactly.
