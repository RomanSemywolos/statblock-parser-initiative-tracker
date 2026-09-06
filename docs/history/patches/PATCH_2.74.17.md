# v2.74.17 — audit round 1

- Runtime `PACKAGE_VERSION` now matches package metadata, with an invariant test.
- `.`, `!`, and `?` share the same surface title-boundary primitive through routing, deterministic feature recognition, Auto Style, and translated feature-title styling.
- Header localization consumes source-grounded bold label markup first and uses `headerClassifier` only as a legacy fallback; the translation layer no longer owns a duplicate English alias regex table.
- Removed verified-dead pre-candidate generation/transport code while preserving the live quote-envelope compatibility parser/anchor path.
- Updated stale architectural comments around product model settings, Auto Style, deterministic translation, and title terminators.

Deferred by review plan: header-vocabulary consolidation + candidate type-cycle (round 2); singleline language-aware enrichment + IndexedDB infrastructure (round 3); App.tsx decomposition (round 4).

Validation:
- Targeted audit suite: 71/71 passed (title/classifier/router/multiline/Auto Style/translation/version).
- Direct transport + annotation compiler checks: 24/24 passed.
- Full `src/*.ts` no-check emit succeeds.
- Two prompt tests remain pre-existing baseline failures from v2.74.16 because they still expect the old `CANDIDATE POSITIONS` label while the live prompt uses `STRUCTURAL PROPOSALS`; this round did not alter that behavior.
- Full local `npm test` is unavailable in this worktree because `node_modules`/`tsx` are not installed.
