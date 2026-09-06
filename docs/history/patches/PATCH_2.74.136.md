# Patch 2.74.136 — mixed BODY quality regression repair

## Why 2.74.135 regressed

The ownership-first architecture was correct, but the mixed BODY request changed more than the ownership handoff. It replaced the mature BODY structural prompt with a shorter exclusion-oriented prompt, reused a generic user-prompt tail containing instructions irrelevant to the BODY schema, and left deterministic hints that could cross accepted Header ownership.

For a small local model this created three avoidable burdens at once:

1. the model had to relearn feature/heading/rules distinctions that the previous mature BODY prompt already explained with explicit examples;
2. the prompt simultaneously said to cover every candidate and later said that Header-owned candidates must not be returned;
3. source-shape hints could imply continuation from an eligible BODY coordinate into a forbidden Header coordinate.

The Mimiking report shows the characteristic failure: the BODY model returned malformed reversed spans, returned Header-owned coordinates as `u`, omitted valid feature/heading blocks, and left large structural gaps even though the exact source remained lossless.

## Fix

Mixed keeps the v2.74.135 ownership-first architecture unchanged:

`whole source -> fixed Header locator -> deterministic validation -> accepted Header ownership -> complement BODY -> one BODY LLM`

The repair is only in the BODY transport contract:

- restore the mature pre-2.74.135 mixed BODY structural distinctions and abstract examples;
- mark every visible coordinate inline as either `BODY_ELIGIBLE` or `HEADER_OWNED_FORBIDDEN`;
- remove stale generic instructions about `abilityLabels`, `h` spans, and unconditional coverage of every source candidate;
- state one non-contradictory coverage rule: cover every meaningful BODY-eligible coordinate exactly once and never return Header-owned coordinates;
- filter deterministic BODY hints so no hint references accepted Header ownership;
- retain deterministic rejection of any model span that nevertheless intersects Header ownership.

No `bodyStart` was restored. No Header prefix/suffix assumption was restored. Singleline is unchanged.

## Verification

- TypeScript typecheck passes.
- Full compiled Node test suite: 527/527 pass.
- Added prompt-contract regression assertions preventing the contradictory/stale generic instructions from returning to the mixed BODY prompt.
