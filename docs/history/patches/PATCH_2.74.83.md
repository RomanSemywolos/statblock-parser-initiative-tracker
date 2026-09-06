# Patch 2.74.83 — trusted multiline geometry, language-neutral body styling

## Contract

- `multiline`: every non-empty physical BODY row is exactly one logical body unit.
- `mixed`: physical row geometry is not trusted because one logical structure may wrap across rows or multiple structures may be collapsed into one row.
- `singleline`: BODY is predominantly collapsed and requires reconstruction from grounded candidate structure.
- Header parsing is shared and does not decide BODY routing.

## This patch

1. Removes deterministic English section-heading classification from the multiline BODY planner.
2. A standalone heading-shaped multiline row is kept as one `unclassified` lossless unit; no section meaning is invented.
3. Resets local multiline presentation context at such a structural row without assigning `actions`, `legendary_actions`, etc.
4. Removes the UA/RU/EN section-label dictionary from Auto Style.
5. Auto Style may promote a standalone row to a visual heading only when the compiler explicitly supplies trusted multiline geometry. Such a heading has `headingKind: null` unless semantic ownership already came from another trusted layer.
6. Generic/mixed Auto Style does not infer heading meaning or heading presentation from wording alone.

## Responsibility boundary

Language-dependent meaning belongs to an LLM semantic layer when the product actually needs that meaning. Deterministic code owns source geometry, grounding, span integrity, structural validation, exact numbers/mechanics, and placement of already-grounded semantics. Presentation-only structural styling must never invent semantic section identity.
