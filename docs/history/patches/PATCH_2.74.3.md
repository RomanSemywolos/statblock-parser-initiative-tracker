# Patch 2.74.3

Residual wrapped-web statblock fixes.

- Suppress title-shaped feature candidates when the previous physical row has strong grammatical continuation shape (e.g. `or\nMisty Step action.` / `uses its\nNaturalize action.`).
- Add candidate boundaries for a second canonical header label printed on the same physical row, e.g. `Armor Class ... Hit Points ...`.
- Renderer keeps short `DC N` / `СК N` mechanical atoms together with CSS `nowrap`; this is presentation-only and does not mutate document text.
- Added regression tests for the Erlking wrapped action-reference cases and collapsed adjacent header fields.
