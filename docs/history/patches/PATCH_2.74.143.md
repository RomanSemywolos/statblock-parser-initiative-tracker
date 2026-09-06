# Patch 2.74.143 — standalone heading + explanatory prose normalization

## Scope

This patch fixes one systematic mixed-mode geometry case observed in the 2.74.142 manual report set: a standalone section-shaped line such as `LEGENDARY ACTIONS` was returned as a logical-line start, but the immediately following explanatory paragraph was not. The virtual multiline row therefore became `LEGENDARY ACTIONS + explanatory prose`, which the shared deterministic multiline classifier correctly refused to treat as a standalone heading.

No BODY semantic classification was added to the LLM contract.

## Mixed normalization prompt

Added one geometry-only rule and one few-shot example for the shape:

1. standalone heading-shaped row;
2. complete explanatory paragraph;
3. one or more independent title-shaped peer entries.

The expected output contains starts for all three structural levels. The prompt explicitly says not to merge the explanatory prose into the standalone row merely because that row has no terminal punctuation.

The output schema remains starts-only: `{"starts":[{"s":"Cxxx"}]}`.

## Auto Style

Extended the existing presentation-only standalone-heading rescue. A paragraph with standalone heading shape may now be visually restored as a heading when either:

- the next paragraph begins with a named-rule shape; or
- one ordinary explanatory paragraph intervenes and the following paragraph begins with a named-rule shape.

The rescue remains vocabulary-independent and assigns `headingKind: null`. It rejects an intervening node that is itself heading-shaped or has printed metadata label + value shape.

This makes manual separation of `Legendary Actions` + its explanatory rules paragraph behave the same way as normal imported section presentation.

## Architecture invariants preserved

- Header ownership unchanged.
- Mixed BODY LLM still restores only logical line starts.
- No `feature`, `heading`, `section`, `metadata`, or other BODY semantic labels were added to model output.
- Same deterministic multiline classifier remains downstream of mixed normalization.
- Source text and candidate coordinates remain immutable/lossless.
- Singleline pipeline is unchanged.

## Validation

- `tsc --noEmit`: pass.
- Compiled Node test suite: **535/535 passed**.
- Added regressions for:
  - Auto Style rescue with one explanatory paragraph before named peer entries;
  - negative case with ordinary prose only;
  - mixed prompt contract for the standalone-row + explanatory-prose few-shot.
