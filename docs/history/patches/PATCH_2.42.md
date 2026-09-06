# v2.42.0 — sparse deterministic hints

This patch adds a deliberately narrow collaboration channel between deterministic source-shape analysis and the two LLM passes.

## What changed

- The source and candidate lattice remain unchanged and are still shown first.
- A new `deterministicHints` pass emits only sparse, source-grounded observations:
  - `identity_shape`
  - `named_rule_continuation`
  - `mechanical_continuation`
- Hints are appended after SOURCE and CANDIDATE POSITIONS. The prompt explicitly says they are evidence, not classifications or instructions.
- Structural LLM receives all three hint families.
- Essential verifier receives only `identity_shape`, avoiding body-related attention noise.
- Hints never mutate candidates, spans, reconciliation, or the product document directly.
- Diagnostics persist the exact hints that were shown to the model.

## Intended regressions/tests

The first real A/B set should remain Aspect of Tiamat, Nabassu Fledgling, Aboleth, and Zariel.

Success criteria:
- Tiamat identity improves.
- Nabassu Magic Resistance and Grasping Claws improve or at least do not regress.
- Aboleth and Zariel do not regress.
- Essential card facts do not regress.
- Latency remains close to v2.41 because there is no extra model call.

## Safety boundary

A hint is an observation about source form. It is never a parser verdict. The LLM still reads the complete source in order, reconciliation still owns grounded conflict handling, and the human remains the final authority.
