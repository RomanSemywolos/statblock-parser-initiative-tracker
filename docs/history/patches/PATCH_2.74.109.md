# Patch 2.74.109 — PB claim proof symmetry and exact PB Evidence

## Problem

2.74.107 made unverified semantic `proficiency_bonus` proposals pass a deterministic
single-scalar source-shape proof before they could become card facts. The independent
fixed-header verifier still bypassed that proof. A verifier mistake could therefore
turn a Saving Throws row or a spell-attack bonus in body prose into a printed PB.

The product also normalized a standalone printed PB row without preserving that exact
printed row in the Evidence surface.

## Changes

### One structural proof for printed PB

Verifier PB claims no longer receive semantic-authority bypass. A standalone verified
PB region must satisfy the same language-neutral scalar-field shape as a semantic PB
proposal: compact grounded evidence with exactly one signed numeric atom and exactly
one numeric atom overall.

A verified PB region that fails this proof is preserved as source but rejected as a
structured PB fact with `unproven_verified_proficiency_bonus`. Grounded CR derivation
may then provide the fallback PB.

The intentional exception is an inline PB inside the independently selected Challenge
source region. Such a combined CR/PB row is not scalar by construction; spatial overlap
with the selected grounded Challenge field proves the enclosing source field, after
which the signed PB atom may be read from that exact row.

This rejects cases such as:

- `Saving Throws Str +14, Con +12, Wis +9, Cha +12` proposed as PB;
- `spell save DC 17, +9 to hit` proposed as PB.

It still preserves a real printed standalone PB even when it disagrees with the value
normally derived from CR.

### Exact standalone PB Evidence

A printed PB now contributes its complete exact source range to product Evidence. The
card row remains normalized presentation. If PB and Challenge share one source row,
existing overlap merging keeps that source visible once and tags the same Evidence
interval for both fields.

### Provenance

For structurally proven standalone semantic PB fields, the PB value is still parsed
from the one signed scalar atom, but fact provenance now retains the complete exact
printed field rather than only the numeric token. This lets Evidence reproduce the
source row exactly.

## Regression coverage

Added tests for:

- verifier misclassifying a Saving Throws row as PB -> reject and derive from CR;
- verifier misclassifying body spell mechanics as PB -> reject and derive from CR;
- a valid printed homebrew PB that disagrees with CR remains authoritative;
- exact standalone printed PB appears in Evidence and is not duplicated in BODY.

Validation in the Linux container:

- `npm run typecheck`: pass;
- `npm run build`: pass;
- `node --test dist/*.test.js`: 480/480 pass.

The uploaded `node_modules` came from Windows, so direct `npm test` through `tsx`
cannot execute under Linux because its bundled esbuild binary is `win32-x64` rather
than `linux-x64`. Compiling with TypeScript and running the emitted Node tests avoids
that platform mismatch without changing dependencies.
