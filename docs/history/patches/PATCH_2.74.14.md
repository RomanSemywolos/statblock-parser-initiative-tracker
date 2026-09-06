# Patch 2.74.14 — equivalent compact feature-title terminators

## Goal
Treat `.`, `!`, and `?` as equivalent surface terminators for compact feature titles without adding vocabulary-specific rules.

## Changes
- Simplified `surfaceCollapsedTitleLead()` in `src/titleBoundaryShape.ts`.
- Removed the 2.74.13 special condition that required an emphasized parenthetical qualifier after `!` or `?`.
- The shared title-shape primitive now accepts any compact title ending in `.`, `!`, or `?`.
- Existing candidate geometry, title-shape checks, boundary strength, and reconciliation safety remain unchanged.
- No parser vocabulary was added and no source ownership/reconstruction behavior was changed.

## Regression coverage
- Source-candidate test now verifies equivalent candidate proposal for period, exclamation, and question terminators.
- Generic safety-splitter coverage verifies `Tally Ho!` without a qualifier.
- Added `Who Goes There?` safety-splitter regression.

## Validation
The local environment still lacks project `tsx`/dependencies, so the full npm suite cannot run here. Relevant TypeScript emitted successfully apart from the pre-existing missing `zod` dependency, and runtime smoke verified that both `Tally Ho!` and `Who Goes There?` receive strong `title_shape` evidence and split a coarse feature run.
