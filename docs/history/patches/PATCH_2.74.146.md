# Patch 2.74.146 — singleline Header adapter

## Goal

Keep the canonical ownership architecture while giving physically collapsed input a Header presentation suited to collapsed geometry. No extra model stage was added.

## Architecture

Singleline remains exactly two model calls:

1. fixed Header fact verification;
2. BODY logical-line start normalization.

The Header call now has a **singleline-specific adapter**. It receives the same exact source and the same immutable candidate coordinate space, but candidates are presented in two channels:

- sparse **STRUCTURAL PROPOSALS** with coarse source-shaped previews;
- denser **EXACT ADDRESS COORDINATES** used only to refine left/right fact edges.

This does not classify source deterministically and does not add Header semantics to the candidate layer. The model still returns only the closed Header fact contract (`n`, `sta`, `ac`, `init`, `hp`, `ab`, `sv`, `cr`, `pb`), and the deterministic verifier still owns grounding, numbers, overlap rejection, and source ownership.

Multiline and mixed keep the existing universal Header verifier prompt.

## Why

2.74.145 fixed the catastrophic singleline BODY fragmentation by hiding pure dense-prefix addresses from BODY normalization, but the Header verifier still saw the dense token lattice as one flat list. Real 2.74.145 reports showed a consistent failure mode: the model generally understood which Header fact it was looking at, but placed token endpoints poorly (name/type overlap, missing alignment tails, reversed classification spans, truncated ability regions).

The new adapter keeps exact addresses available without presenting every address as an equally meaningful structural proposal.

## Prompt contract

`SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT` explicitly states:

- source is collapsed;
- structural proposals are shape evidence only;
- exact addresses refine edges and are not separate facts;
- `name` and `size_type_alignment` are adjacent but distinct spans;
- compact fields include their complete printed parenthetical material but not the next field;
- six repeated ability cells form one `ab` region;
- no BODY semantics or extra Header fields are introduced.

Few-shot examples teach only collapsed Header geometry and exact-edge refinement.

## Deterministic identity safety

Two narrow source-grounded corrections were added to `candidateHeaderFacts`:

- if a classification claim repeats an independently grounded name prefix, that exact name prefix can be carved from the classification claim;
- if `name` and `size_type_alignment` claim the identical source span, both contradictory identity claims are rejected rather than inventing a split.

The existing opposite-direction overlap carve (classification tail repeated inside name) remains unchanged.

## Tests

Added regressions for:

- dedicated singleline Header prompt/view;
- structural proposals plus exact address coordinate completeness;
- singleline pipeline still using only one Header call plus one BODY call;
- deterministic classification-prefix carve;
- rejection of identical name/type spans.

Targeted validation in this environment:

- `prompt.test.ts`: 11/11 passed;
- `candidateTransport.test.ts`: 40/40 passed;
- production `prompt.ts`, `candidateTransport.ts`, and `pipeline.ts` compile under a local dependency stub check.

The full repository suite could not be executed in this container because the archive intentionally excludes `node_modules` and the environment has no npm network access. No claim of a full-suite pass is made for this patch.
