# Patch 2.74.104 — evidence ownership cleanup and standardized AC/HP

## Scope

Narrow product/header cleanup based on the 2.74.103 corpus report. Parser routing and the decision to keep `size_type_alignment` in the header remain unchanged.

## Changes

- Exact AC and HP source rows now move into the collapsible Evidence panel when structured facts are verified.
- Product AC/HP rows use standardized labels (`Armor Class`, `Hit Points`) while preserving the verified number and every source qualifier after that number, e.g. `(natural armor)`.
- Challenge/CR source evidence is now owned by the Evidence panel, so a source CR row cannot also remain duplicated in BODY. A derived/synthetic value has no invented evidence.
- Structured ability-table evidence now preserves the complete constraint-proven table region, not only the individual score/save cells. This removes residual column labels such as `mod` / `save` from BODY for Rak-Tulkhesh-style layouts.
- When printed saves are proven inside the same ability-table region, the single exact source fragment is tagged for both abilities and saving throws instead of being split into overlapping evidence fragments.
- A source span already used as the structured name/type identity is suppressed from BODY even if structural ownership drifted, preventing duplicate type/alignment display such as the Hythonia case. `size_type_alignment` itself is still rendered in the header in this patch.
- Evidence UI labels now support AC, HP, abilities, saving throws, and CR.

## Tests

Added/updated regressions for:

- standardized AC/HP rendering with exact source evidence preserved;
- full Rak-style `mod/save + six rows` evidence ownership with no residual table fragments in BODY;
- Challenge/CR evidence ownership with no BODY duplication;
- type/alignment source not being duplicated in BODY after structural-role drift.

Local validation:

- `npm run typecheck` — pass;
- `npm run build` — pass;
- compiled Node suite — 463/463 pass;
- frontend TypeScript check — pass using the current source package directly (the transferred Windows dependency tree remains unsuitable for a normal Linux Vite build).

## 2.74.105 architectural erratum

The 2.74.104 Evidence work exposed an older product-boundary defect: semantic header ownership could still suppress source from BODY even when that source was not represented by the final header. `UTTERANCE OF DAMNATION` demonstrated silent product loss of a large TRAITS region after a false header/challenge annotation.

2.74.105 removes semantic omission authority from the editable product compiler. See `PATCH_2.74.105.md` and `AUDIT_SOURCE_PLACEMENT_2.74.105.md`.
