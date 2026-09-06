# Patch 2.74.120 — Baphomet final ordered-list item closure

Base: 2.74.119 (the clean 2.74.109 branch plus list support; no rich-style experiment).

## Problem

In real Baphomet mixed/PDF geometry, the generic candidate lattice splits `4. Bisect.` into two coordinates: `4.` and `Bisect.`. The source-proven feature-boundary pass can assign the final marker to a list-item owner and the following title to another owner before introduced-list closure runs. The previous closure required the final marker's *pre-closure* owner to already equal the parent owner, so it closed `1..4.` but left `Bisect.` as a peer feature.

## Fix

When an introduced list is already source-proven, the final marker coordinate may absorb the immediately following eligible owner only when the source slice between the two candidate starts:

- contains no physical newline, and
- consists only of the list marker (`4.`, `A)`, `•`, `—`, etc.) plus spacing.

Thus `4. Bisect.` is closed into the parent list item, while `4.\nNext Feature.` is explicitly not.

No D&D vocabulary, feature names, section names, or semantic inference are used. No changes were made to header parsing, routing, source visibility, fixed facts, or non-list boundaries.

## Regression tests

- production-order test with `enforceSourceProvenFeatureBoundaries: true`, reproducing the Baphomet ownership sequence;
- negative test proving a standalone final marker cannot absorb an independent title on the next physical row.
