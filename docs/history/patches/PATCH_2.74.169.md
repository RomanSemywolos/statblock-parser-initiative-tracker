# Patch 2.74.169 — Functional Header equivalence diagnostics

## Scope

This patch changes diagnostics only. It does not change authoritative parsing,
Header ownership, inline coordinate transport, candidate generation, BODY
normalization, deterministic validation, or product compilation.

The transport migration remains shadow/non-authoritative.

## Why

The 2.74.168 corpus showed that exact `JSON.stringify` equality of validated
`StructuredHeader` objects is too strict for A/B transport evaluation. Two parses
can prove the same final Header facts through different candidate/evidence routes,
while exact object equality still reports `false` because source spans,
annotation ids, or evidence bookkeeping differ.

Conversely, some differences are genuinely functional and must remain visible:
printed name/STA text, scalar values, ability cells, saving throws, and whether PB
was actually printed versus derived.

## New diagnostics

`shadowComparison` now records:

- `verifiedHeaderEquivalentToLegacy` — unchanged strict exact-object comparison;
- `functionalHeaderEquivalentToLegacy` — compares the validated Header result
  while ignoring evidence-route bookkeeping;
- `functionalHeaderDifferingFields` — stable field names explaining a functional
  mismatch.

Functional comparison ignores only:

- source annotation ids and exact evidence spans;
- `abilityEvidence` / `savingThrowEvidence` region bookkeeping;
- model-vs-deterministic evidence route when the validated value is identical;
- saving-throw array ordering.

It intentionally preserves:

- exact printed `name` and `sizeTypeAlignment` text;
- AC, initiative, HP, and CR values;
- all six ability scores/modifiers and printed modifier/save cells;
- final saving-throw values;
- PB value, `printed` status, and associated CR.

This means the known 2.74.168 publication/wrapped-STA regressions remain visible
rather than being normalized away.

## Regression fixtures

Added diagnostics-only tests covering:

- evidence-route differences that must still be functionally equivalent;
- printed-vs-derived PB difference;
- publication code leaking into `name` (`BPGG` shape);
- wrapped STA truncation (`Громадный?` without following classification row);
- publication marker misread as STA (`MOT` shape).

These fixtures add no vocabulary to the parser itself and do not classify source.
They test only the comparison layer.

## Validation

See `VALIDATION_2.74.169.txt`.
