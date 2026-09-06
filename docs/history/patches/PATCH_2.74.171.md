# Patch 2.74.171 — split semantic-span transport experiment

## Scope

Shadow Header transport only. The authoritative legacy Header request, deterministic
Header validation, candidate lattice, BODY pipeline, ownership rules, and product
output are unchanged.

## Change

The generic inline Header prompt now states explicitly that a service coordinate may
fall *inside* one semantic fact. The existing abstract BBB/CCC half-open example now
uses a fact that is physically split across two source spans and requires the right
edge to be the first boundary after the complete semantic fact.

The prompt therefore distinguishes:

- a one-span fact: `BBB -> s=C011,e=C012`;
- one semantic fact split across two source spans: `BBB+CCC -> s=C011,e=C013`.

It also says explicitly that an internal coordinate does not terminate the semantic
fact. This is presentation/instruction only: no language dictionary, STA heuristic,
neighbor expansion, candidate pruning, or new deterministic semantic rule is added.

## Why

2.74.170 established that the model follows the `[s,e)` boundary convention and
stopped publication-code leakage into names, but the shadow model still frequently
selected only one physical fragment of a wrapped `sta` field. 2.74.171 tests whether
that residual behavior is an attention/presentation effect caused by treating each
visible coordinate-delimited span as a complete fact.

## Authority guardrails

- Legacy Header call remains authoritative.
- Shadow remains diagnostics-only.
- No parser functionality is added.
- No changes to source ownership or reconstruction.
- No BODY changes.
- No language-specific deterministic semantics.
