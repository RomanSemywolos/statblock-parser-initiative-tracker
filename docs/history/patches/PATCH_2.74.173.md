# Patch 2.74.173 — compact legacy Header transport experiment

## Scope

This patch changes only the non-authoritative Header A/B request. The authoritative
legacy Header request, Header contract, validators, BODY paths, source ownership,
and product compilation remain unchanged.

The 2.74.172 suffix-span transport is not promoted. Instead, the shadow Header call
now preserves the exact legacy model-facing presentation:

- the same Header system prompt;
- the same SOURCE EXCERPT;
- the same STRUCTURAL PROPOSALS;
- the same SOURCE-SHAPE HINTS;
- for singleline, the same structural-proposal and exact-address channels;
- the same inclusive candidate-range semantics.

The only shadow-request change is JSON-schema encoding. The authoritative request
still enumerates every legal candidate ID in `s.enum` and `e.enum`. The compact
shadow uses the fixed coordinate syntax `^C\\d{3,}$`; candidate existence and range
order are checked by the existing deterministic response parser after generation.

## Why

2.74.170–2.74.172 showed that embedding coordinate markers into source changes the
model's semantic reading. Suffix span labels were substantially better than boundary
markers, but the 2.74.172 regression run still did not establish a reliability win
over legacy presentation and produced only modest aggregate token savings.

2.74.173 isolates the remaining transport cost question: how much can be saved by
removing schema ID enumeration without changing what the model reads?

## Invariants

- Legacy Header remains authoritative.
- Shadow failure cannot affect parsing or source ownership.
- No Header field or validator semantics changed.
- No deterministic language vocabulary was added.
- No candidate pruning or semantic chunking was added.
- BODY is unchanged.
- Raw source is unchanged and remains authoritative.
- The fixed schema does not authorize arbitrary coordinates: the existing parser
  rejects IDs outside the supplied candidate lattice and rejects invalid ranges.

## Diagnostics

`HeaderPromptMetrics` now models the actual 2.74.173 shadow request: system and user
prompt lengths are identical to legacy and the shadow delta is entirely the JSON
schema delta. Historical overlay metric fields are retained for diagnostics-format
compatibility but are null / false because this experiment constructs no overlay.

## Validation

- `tsc --noEmit`: PASS
- `tsc`: PASS
- full compiled Node test suite: 591/591 PASS
