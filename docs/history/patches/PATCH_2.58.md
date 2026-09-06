# Patch 2.58 — deterministic translation grammar cleanup

## Goal
Continue M14.2 using the v2.57 five-statblock regression sample without expanding deterministic translation into free prose.

## Changes
- Fixed rule ordering for `Failure or Success:` so the compound label is translated atomically.
- Added safe distance/area frames around protected mechanics: `N feet`, `N-foot`, and `N-foot-radius` while preserving existing `within N feet` behavior.
- Added deterministic translation of trait/action metadata even when the trait name itself is unknown:
  - `Costs N Actions`
  - `Recharges after a Short or Long Rest`
  - `N/day, or N/day in Lair`
- Added safe numeric alternative conjunction `, or <mechanical payload>`.
- Added grammatical normalization for physical-damage resistance qualifiers such as `from Nonmagical Attacks that aren't Silvered`, including the partially translated intermediate form produced by the glossary layer.

## Deliberate boundary
Names of unique traits/actions and ordinary prose remain for MT unless they are already represented by a trusted glossary/structural rule. This avoids returning to unsafe word-by-word mixed-language output.

## Validation
- Targeted TypeScript no-check compile passed.
- Emitted runtime translation suites: 24/24 passed.
- Full dependency-backed npm/Vite build was not run because the worktree has no local node_modules.
