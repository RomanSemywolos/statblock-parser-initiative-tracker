# 2.74.74 — parser quality regression repair

This release repairs the production regressions introduced by the 2.74.69–2.74.73 universal-header refactors.

## Architecture
- Replaces the separate scalar header-boundary locator plus second semantic-header call with one bounded universal semantic header scan.
- The scan returns both the semantic header and the first body candidate. It sees only a starting excerpt on the mode-neutral, source-shape-aware header lattice; it widens 32 → 64 → 128 candidates only when it explicitly returns MORE.
- Multiline input is not exploded into the dense single-line address grid.
- Body routing still happens only after the header boundary is resolved. Header formatting cannot choose the body parser.
- Multiline bodies remain deterministic and make no body structural model call.

## Boundary safety
- MORE discards partial header ownership and recomputes on the wider excerpt.
- A model cannot extend header ownership past the earliest source-proven named-rule start. This guard is source-shape based and language-neutral.
- Header spans crossing bodyStart are rejected independently.
- Header scan instructions explicitly keep compact metadata after the ability table in the header and end the header at the first printed section heading or named prose rule.

## Body quality
- Restores the detailed lossless structural contract from the stable candidate parser for mixed/single-line body parsing: complete coverage, no overlap/duplicate ranges, section-heading vs feature distinction, whole-feature continuation ownership, separate adjacent named rules, section-rule constraints, and boundary/continuation evidence semantics.
- Body generation schema no longer contains the irrelevant abilityLabels channel.

## Scope
- No Russian/Ukrainian vocabulary lists were added.
- This release targets the broad 2.74.69–2.74.73 quality regression first; localized deterministic multiline section semantics remain a separate follow-up concern.
