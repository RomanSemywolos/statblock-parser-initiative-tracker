# Patch 2.74.127 — exact remainder view infrastructure

Infrastructure-only continuation of the ownership migration. Parser behavior,
prompts, routing, LLM transport and product compilation are unchanged.

## Added

- `src/sourceRemainder.ts`
  - `buildRemainderView(rawSource, ownership)` computes the exact complement of
    `SourceOwnershipMap` in original source coordinates.
  - unowned source is represented as ordered `RemainderSegment`s; separated
    fragments are never concatenated into synthetic source text.
  - every accepted ownership interval is exposed as an explicit
    `RemainderDiscontinuity`, making the future structural handoff able to treat
    owned gaps as hard boundaries rather than accidental adjacency.
  - segment flags `precededByOwnership` / `followedByOwnership` record those hard
    source discontinuities directly.
- `assertValidRemainderView(rawSource, ownership, view)` verifies:
  - exact raw-source text for every remainder/discontinuity interval;
  - one-to-one correspondence between discontinuities and accepted ownership;
  - ordered source coordinates and contiguous segment indices;
  - accepted ownership + remainder partition the complete raw source exactly once;
  - hard-boundary flags agree with the actual ownership gaps.
- `src/sourceRemainder.test.ts` covers multiple discontinuous ranges, prevention of
  synthetic adjacency, empty/full ownership, mutated text, and missing-coordinate
  partition failures.
- Public exports for `RemainderView`, `RemainderSegment`,
  `RemainderDiscontinuity`, `buildRemainderView`, and
  `assertValidRemainderView`.

## Deliberately not changed

- `bodyStart` lifecycle or production handoff.
- parser routing or candidate renumbering.
- header/structure prompts and schemas.
- singleline structural reconstruction input.
- product compiler ownership/presentation.

The new view is currently infrastructure/diagnostic state only. Switching
singleline structure parsing from `bodyStart` suffixes to this exact remainder is
reserved for the next production stage.
