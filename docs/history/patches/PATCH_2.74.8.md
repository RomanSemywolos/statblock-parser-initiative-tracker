# Patch 2.74.8 — source-proven vertical ability tables

## Problem
Clean multiline statblocks can print the six abilities vertically as alternating label/value rows (`STR`, `30 (+10)`, `DEX`, `14 (+2)`, ...). The deterministic header classifier only recognized horizontal six-column layouts. The header-only structural model could therefore leave the vertical block as unresolved text, producing empty product abilities even though the exact source values were preserved below.

## Fix
- Added deterministic recognition of an interleaved six-ability interval.
- Evidence is accepted only when all six canonical labels occur in canonical order and every printed modifier is mathematically consistent with its score.
- Direct candidate transport enforces such a source-proven interval as one `ability_scores` header span, regardless of conflicting/coarse model ownership, without changing source coordinates.
- The existing layout-independent `abilityTableResolver` remains responsible for extracting the six facts and provenance.
- The rule abstains on incomplete or mechanically inconsistent sequences.

This is a mechanical invariant, not a monster-specific or vocabulary-specific parser rule.
