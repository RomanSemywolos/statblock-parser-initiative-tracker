# Patch 2.74.53

## Scope

This release fixes three remaining ownership/presentation regressions without restoring the retired English-first structural parser logic.

### 1. Source-proven introduced bullet lists no longer depend on candidate distance

Hybrid source such as:

```text
Breath Weapons ...: • Antimagic Bomb. ...long option prose...
• Force Breath. ...
```

already had source-proven `list_sequence` evidence, but transport still searched for the parent feature through a short candidate-count window. Dense multilingual candidate lattices can place many coordinate-only candidates inside the first option, so later options could escape into peer features and receive different formatting.

`listSequence.ts` now exposes the exact groups of confirmed introduced bullet marker starts. `candidateTransport.ts` uses those groups directly: each confirmed option owner is kept inside the parent feature regardless of candidate density, while hard independent top-level boundaries still stop closure. No D&D feature names are used.

Regression coverage includes a long hybrid inline-first list where the two bullet markers are separated by more than four candidate coordinates.

### 2. Name-owned source cannot be duplicated as subtitle/type identity

The editable compiler now enforces a source-evidence identity invariant:

- if a subtitle/type identity annotation is fully covered by source already owned by `name`, that duplicate annotation is omitted because its source is already represented exactly by the name;
- if an identity annotation only partially overlaps the name and therefore contains unique source material, it is demoted to visible unresolved content instead of being discarded.

This removes cases where a mixed parse displayed the creature name again as its type while preserving the zero-loss rule. The compiler does not guess what the real subtitle/type should have been.

### 3. Weak single-line fragments bounded by two grounded header anchors stay in the header interval

A collapsed one-line header could leave text such as:

```text
Damage Immunities ... Slashing from Nonmagical Attacks Condition Immunities ...
```

with `from Nonmagical Attacks` model-labelled as a body/feature fragment even though its candidate start had only weak coordinate evidence.

When such a model-owned body fragment:

- lies between two independently profile-grounded header anchors,
- begins only at a weak/unknown candidate coordinate,
- and has no positive source boundary of its own,

transport now keeps it inside the preceding header interval. This rule does not apply after the final header anchor and does not cross strong/hard source boundaries. It is candidate-geometry reconciliation, not vocabulary repair.

## Intentionally unchanged

- `MPMM`-style short all-caps sourcebook codes are **not** deterministically reclassified. A rule such as `ALL CAPS = source metadata` is not universal enough for homebrew/localized input.
- An unresolved `Chaotic Evil` identity tail is **not** force-merged. There is not yet a sufficiently strong language-neutral source invariant to justify it.
- No source-visible text is removed unless exact equivalent source ownership is already proven.

## Validation

Temporary no-check TypeScript emit succeeded with sandbox type libraries disabled only for the emit harness (`types: []`).

Targeted transport/compiler regression suite:
- 44/44 passed.

Broad emitted suite after the production changes:
- 353 test entries
- 345 passed
- 8 startup failures
- 0 assertion failures among runnable tests

The 8 startup failures are the same sandbox dependency class as previous releases (`zod` / `undici` unavailable). Normal dependency-backed `npm test` and `npm run typecheck` remain to be run in the user's Windows environment.
