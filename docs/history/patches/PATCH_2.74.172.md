# Patch 2.74.172 — suffix span-label Header transport experiment

## Scope

Shadow Header transport only. The authoritative legacy Header request, deterministic
Header validation, candidate lattice, BODY pipeline, source ownership, and product
output remain unchanged.

## Change

The model-facing shadow Header source no longer renders candidate coordinates as
prefix/boundary service lines. Each existing candidate ID now labels the exact
source span that begins at that candidate and ends at the next candidate (or EOF)
by appearing as a compact suffix after that span's visible text:

`source span⟦Cxxx|N⟧`

`Cxxx` is the span ID. `N` is the same per-request structural class already used in
2.74.168–2.74.171. Its decoded payload remains attached to the span's *starting*
candidate; moving the marker does not move, add, remove, strengthen, or weaken any
structural evidence.

The shadow range contract now matches the established legacy contract directly:
`s` and `e` are the first and last **included** span IDs. No half-open right-edge
adapter and no transport-only EOF sentinel are needed.

Example:

- `BBB⟦C011⟧` alone -> `s=C011,e=C011`
- `BBB⟦C011⟧ CCC⟦C012⟧` as one fact -> `s=C011,e=C012`

## Structural-hint parity

The structural class dictionary is unchanged in meaning and remains lossless for:

- candidate reasons;
- boundary scope, strength, and evidence;
- continuation strength and evidence;
- collapsed-singleline structural/address-only/mixed role;
- collapsed-singleline synthetic top-level/internal role.

A regression fixture verifies that suffix presentation preserves the exact decoded
class signatures for both generic evidence and singleline-only roles.

## Guardrails

- No candidate pruning.
- No publication-code dictionary.
- No STA expansion heuristic.
- No language-specific deterministic semantics.
- No validator changes.
- No BODY changes.
- Legacy Header call remains authoritative.
- Shadow remains diagnostics-only.
- `stripHeaderCoordinateOverlay()` still reconstructs the canonical raw source exactly.
