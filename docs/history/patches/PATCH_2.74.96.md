# Patch 2.74.96 — boundary-independent critical fact evidence

Base: **2.74.95**. This patch deliberately does not replace the combined header scan, routing contract, or multiline BODY planner.

## What changed

### 1. Essential verifier no longer inherits `bodyStart`
The existing independent verifier now receives the full grounded candidate space / source instead of only the semantic header prefix. Its output remains evidence-only: it cannot create, resize, move, or reclassify source ownership.

The verifier still proposes only `name`, `armor_class`, `hit_points`, `ability_scores`, and `saving_throws` spans. The prompt explicitly forbids treating saving-throw sentences inside traits/actions as a printed `saving_throws` field.

### 2. Verified critical regions are stored separately from ownership
`ParsedModelHeaderFacts` can carry exact `essentialRegions` offsets. These regions are semantic evidence, not annotations. Therefore a verified Saving Throws row may feed structured card facts even when a wrong header boundary left that exact source row in BODY.

Standalone verified saves are accepted only when deterministic validation can explain every signed number in the claimed region as one unique ability-label + signed-bonus pair. Otherwise the claim is rejected and the source stays untouched.

### 3. Ability-table proof may cross a wrong semantic boundary
The source-only ability probe no longer treats a semantic `bodyStart` as an absolute ceiling when a later source-proven section heading exists. It probes content-unit endings only up to that structural heading and accepts a region only when the existing six-ability constraint solver proves it.

This restores the Rak Tulkhesh case where the final CHA save cell is beyond a wrong `bodyStart`. The recovered structured fact does **not** move that source cell back into header ownership.

### 4. Verified ability regions use the same constraint solver
A verifier-proposed `ability_scores` region can also be resolved independently of ownership. It must still prove all six abilities and all accepted printed numeric cells; the model does not supply or repair numbers.

## Preserved invariants
- source remains lossless;
- no language dictionary was added;
- verifier evidence cannot change BODY/header routing or placement;
- unsupported or numerically ambiguous claims remain unresolved;
- existing header-region promotion remains conservative and refuses to overwrite BODY ownership;
- singleline architecture is otherwise unchanged.

## Regressions added
- wrong semantic boundary through the final CHA save cell still yields the complete six-save ability table while the cell remains BODY-owned;
- verified standalone Saving Throws evidence outside header ownership populates structured saves without moving the source row;
- card-fact verifier input contains body source, proving that evidence availability is no longer clipped by `bodyStart`.
