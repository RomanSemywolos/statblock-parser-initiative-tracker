# PATCH 2.74.43 — language-neutral mixed-header recovery

This patch fixes a multilingual regression exposed by a Russian Astral Dreadnought import.

## Root cause

2.74.39 correctly demoted bare physical newlines in mixed input, but English header rows were then re-promoted by `profile_header_anchor` while localized header rows had no equivalent positive evidence. The generic continuation layer also treated almost every compact localized header row as `previous_line_open`, so a normal metadata column looked like one long soft-wrapped continuation chain.

## Changes

- Added vocabulary-free `compact_metadata` boundary evidence for pre-body rows with compact metadata shape (early numeric value, compact parenthetical classification, or compact list punctuation).
- Compact metadata promotion suppresses the misleading `previous_line_open` continuation because the candidate is no longer weak.
- Added source-shape detection for a six-row vertical ability table (`label score (modifier)`). The first row is a hard table start and the following five rows are hard internal table rows. No ability-label vocabulary is used.
- Direct transport closes source-proven internal vertical-table rows into the already-open header owner if the model mirrors each physical row into a separate `header_field`. Semantic ability identity remains grounded through `abilityLabels` and the existing header enrichment.
- Relaxed candidate title proposal / Auto Style presentation for short (<=4-word) sentence-case localized feature titles such as `Разорвать серебряную нить.`. The stricter generic header classifier and parser routing were deliberately left unchanged after a trial routing relaxation caused regressions.
- Added regression tests for the Russian mixed header, vertical localized ability table, sentence-case feature title, and preservation of weak `Slashing...` / `Poisoned` wraps from the Fraz-Urb'luu case.

## Safety / architecture

- No Russian field dictionary was added to structural parsing.
- English profile evidence remains additive, not required.
- The new metadata evidence only applies before the first source-visible named body feature in generic/mixed mode.
- Bare wrapped words remain weak, so this does not restore the old `standalone_block_start -> strong` behavior.
- Parser routing was not changed.

## Local verification

- Focused parser/presentation suite: 111/111 passed.
- Wider emitted JS suite: 331 tests seen; 323 passed; 8 test files failed to start because runtime `zod` is unavailable in the sandbox. No runnable assertion failures.
- `tsc --noCheck` source emit succeeded.
- Full dependency-backed `npm test` / normal `npm run typecheck` were not run in this sandbox.
