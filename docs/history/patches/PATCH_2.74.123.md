# 2.74.123 — singleline coordinate/proposal separation

This patch is stage 2 of the collapsed/single-line parser redesign. It deliberately does **not** change candidate generation, source offsets, semantic ownership, deterministic reconciliation, or multiline/mixed behavior.

## What changed

- `PreparedCandidateLattice` now exposes the diagnostic singleline audit alongside the unchanged candidate arrays.
- For genuinely collapsed input, LLM prompt presentation now separates:
  - sparse `STRUCTURAL PROPOSALS` (structural or mixed audit role), and
  - dense `EXACT ADDRESS COORDINATES` (address-only audit role).
- Candidate IDs, order, offsets, previews, JSON schema coordinate space, and total candidate count remain unchanged.
- Address-only coordinates are still visible to the model for exact span edges, but they no longer carry full proposal/boundary framing.
- The same presentation split is used by the bounded header scan when the physical source is collapsed; ordinary multiline/mixed header prompts are unchanged.

## Intentionally not changed

- no new singleline structural reconstruction yet;
- no candidate removal or renumbering;
- no new header semantics or body semantics;
- no D&D/English vocabulary rules;
- no deterministic body-boundary rule;
- no changes to candidate transport, lossless compilation, or product document behavior.

## Validation

- `npm run typecheck`: PASS
- `npm run build`: PASS
- compiled test suite: 496/496 PASS
- regression tests verify that every original Cxxx coordinate remains visible exactly in the same complete coordinate space while address-only coordinates are presented separately.
