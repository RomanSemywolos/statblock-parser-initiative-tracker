# v2.44.0 — structural ownership reset

This patch restores the parser's original trust boundary: the structural LLM reads the statblock top-to-bottom and owns text order and block boundaries. Candidate coordinates are immutable source anchors; downstream heuristics no longer re-search those spans as quotes or reshape body/header ownership on the candidate path.

## Structural document

- The structural prompt now requires an ordered, non-overlapping partition of every meaningful candidate.
- Uncertainty is explicit `u`, not a silent gap.
- Any accidental model gap is preserved as `unclassified`; it is never attached to a nearby feature/header by a semantic repair heuristic.
- Candidate spans are converted directly to source-unit ranges. `quoteAnchor` remains only for legacy quote-based fixtures/compatibility.
- Candidate-path annotation compilation skips legacy multi-field/header-continuation reconciliation that can resize structural ownership.

## Header/card exception

The separate short verifier remains for card-critical facts only: name, AC, HP, abilities and printed saves. Its evidence may refine the semantic label of an already-owned header span, but cannot create, resize or move structural spans. A `saving_throws` verifier claim is not accepted as a field label unless local deterministic grammar also supports a printed save field; prose such as “saving throws against spells” therefore remains visible source text.

Ability modifiers continue to be used as save bonuses when no printed saving throws/Save column exists. This is intentional product behavior.

## Product compilation

- Header fallback `other_header` is no longer grouped globally by field. Each source-owned fragment remains a separate row in source order.
- A falsely-labelled Saving Throws fragment is not silently suppressed when structured save extraction found no printed saves; its raw text remains visible.
- AC/HP repair slots and derived PB behavior remain unchanged.

## Safety invariants

Candidate path now aims for: ordered ownership, no overlap, complete candidate coverage, explicit uncertainty, direct coordinate grounding, verifier evidence without structural ownership, and no concatenation of non-contiguous unknown header fragments.
