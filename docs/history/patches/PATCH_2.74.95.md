# Patch 2.74.95 — Auto Style convergence on the 2.74.87 baseline

This patch is intentionally based on **2.74.87**, not on 2.74.94.
No header-boundary, routing, body-LLM, candidate-transport, or parser semantics from 2.74.88+ are carried forward except the small presentation/editor fixes listed here.

## Changes

1. Parse-time styling and manual Auto Style now call the exact same transform:
   `applyEditableAutoStyle(document)`.
   The hidden `trustedPhysicalBodyRows` option was removed.

2. Auto Style no longer promotes a paragraph to a heading from text/shape alone.
   It only preserves an existing heading node when that node still has standalone-heading shape.
   Typed and untyped (`headingKind: null`) headings use the same rule.

3. The body editor no longer infers `headingKind` from English/Ukrainian/Russian words while serializing DOM.
   It preserves the existing `data-heading-kind` when canonical, otherwise keeps `null`.
   This prevents the manual Auto Style path from receiving a semantically different document from parse-time styling.

4. `surfaceStandaloneHeadingRow()` now rejects comma-containing rows.
   A comma-separated list is strong language-independent evidence against a standalone section heading.
   This prevents rows such as:
   - `Condition Immunities Charmed, Deafened, Frightened, Paralyzed, Stunned`
   - `Languages Common, Draconic`
   from being treated as heading-shaped, while rows such as `Traits`, `Legendary Actions`, and localized equivalents remain eligible.

5. Added regression coverage for:
   - untyped localized headings staying headings;
   - plain paragraphs never being promoted by Auto Style;
   - comma-list rows typed as headings being demoted to paragraphs;
   - `Traits` remaining a heading.

## Deliberately unchanged from 2.74.87

- universal header scan architecture;
- header/body boundary ownership;
- multiline BODY planner;
- mixed/singleline BODY model calls;
- candidate transport and reconciliation;
- essential verifier;
- header facts / ability-table recovery;
- parser routing.

## Validation

The assistant environment does not contain `node_modules`, so full project tests were not executed here.
Run locally:

```bash
npm run typecheck
npm test
```
