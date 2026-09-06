# 2.74.122 — singleline candidate-lattice audit only

Base: 2.74.121.

This patch begins the singleline redesign with an observation-only audit. It does not change candidate creation, routing, prompts, transport, ownership, normalization, or product compilation.

Added `singlelineCandidateAudit.ts`, which classifies already-existing singleline coordinates by the mechanisms that can account for them: base geometry, optional profile header anchors, ability-table anchors, compact table shape, named-title anchors, confirmed list markers, dense-prefix addressability, punctuation addressability, title look-back addressability, and residual address-only coordinates. A coordinate can have multiple origins.

The audit explicitly separates `structural`, `address_only`, and `mixed` coordinates. This is diagnostic vocabulary only; it has no effect on boundary evidence or semantic ownership.

Regression tests prove that running the audit does not mutate candidate ids, starts, previews, reasons, or boundary evidence, and that dense address coordinates and proven structural/list coordinates are distinguishable.
