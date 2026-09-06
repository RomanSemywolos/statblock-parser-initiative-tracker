# Patch 2.74.98 — fixed-header contract freeze

This patch deliberately narrows header semantics instead of expanding recovery heuristics.

## Closed structured header

The machine/card header now has a closed set of source-grounded facts:

- creature name
- printed creature classification/type line (`size_type_alignment`)
- armor class
- printed initiative when present (the product may still explicitly derive initiative from DEX when absent)
- hit points
- six ability scores/modifiers
- printed saving throws
- challenge rating
- proficiency bonus (printed when present; existing CR derivation remains an explicit fallback)

Speed, skills, vulnerabilities/resistances/immunities, senses, languages, habitat and other metadata are not required structured-card facts. They remain lossless source content and are rendered/styled normally.

## Evidence is independent of ownership

The fixed-header verifier may ground the nine facts anywhere in the statblock. A wrong `bodyStart` therefore does not prevent a verified card fact from being used. Verifier evidence never changes body/header ownership, routing, or source geometry.

## Deterministic guards

- A trailing creature-classification candidate that overlaps a model-proposed name is carved out of the name when the overlap shape is unambiguous. This restores the Aspect of Tiamat invariant without relying on another model call.
- Candidate evidence regions are trimmed only at their outer whitespace before exact structural validation. This lets a verifier-proposed vertical ability table end on the actual final value rather than on the separator before the next metadata row.
- Vertical ability/save tables still require the existing six-ability constraint proof; crossing a nominal body boundary is not sufficient by itself.

## Regression coverage

Added/expanded tests for:

- all nine essential-fact schema identities;
- Aspect of Tiamat name/classification overlap;
- the complete fixed header under an intentionally early body boundary;
- Rak Tulkhesh vertical `mod/save` geometry including the final CHA +16;
- lossless preservation of non-fixed metadata and body evidence.

No BODY routing architecture or multiline body contract was changed.
