# Audit: `bodyStart` dependencies — 2.74.125

## Scope

This patch is audit-only. It does **not** change parser behavior, prompts, schemas,
routing, candidate generation, transport, compilation, or presentation.

The audit traces the current active lifecycle of `bodyStart` and separates three
concepts that are currently coupled in the pipeline:

1. **header ownership** — exact source ranges accepted as header/header evidence;
2. **structural remainder** — all exact source not already owned by header/evidence;
3. **legacy global boundary** — one scalar `bodyStart` used as if the document were
   a strict `header prefix | body suffix` partition.

The target architecture for subsequent patches is ownership-based:

`raw source -> accepted header ownership -> exact remainder -> structure evidence -> semantic markup`

No production change is made here.

## Active direct lifecycle

### A. Generation contract

`src/prompt.ts`

- `UNIVERSAL_BOUNDED_HEADER_SCAN_SYSTEM_PROMPT` requires one response containing
  both semantic header blocks and `bodyStart`.
- The contract says returned header blocks must be strictly before `bodyStart`.
- `MORE`/`END` are also encoded in the same field.

`src/modelSchema.ts`

- `createHeaderScanGenerationJsonSchema()` exposes `bodyStart` as `Cxxx|MORE|END`.
- `parseCandidateHeaderScanResponse()` converts it to `bodyStartCandidate`.
- Header runs that reach/cross `bodyStartCandidate` are rejected individually,
  **but the scalar boundary itself is still accepted**. Therefore a self-
  contradictory model response can discard later header runs while preserving an
  erroneously early boundary.

### B. Bounded header window

`src/pipeline.ts`

- The header scan uses candidate-count windows `[32, 64, 128]` plus
  `safeHeaderWindowCount()`.
- `safeHeaderWindowCount()` protects physical multiline rows and weak/internal
  collapsed cuts, but the controlling unit remains candidate count.
- The accepted scan result is converted directly to `bodyStartOffset`.

### C. Parser routing

`src/pipeline.ts`

`bodyStartOffset` controls routing input:

`bodyRawForRouting = rawSource.slice(resolvedBodyStartOffset)`

Therefore routing mode is chosen from the suffix selected by the semantic header
boundary rather than from an ownership complement.

### D. Candidate-space splice and renumbering

`src/pipeline.ts`

The scalar boundary then controls:

- `semanticHeaderCandidates`: all header-scan candidates with `start < bodyStart`;
- the routed BODY candidate set: boundary candidate + routed candidates after it;
- concatenation of those two sets;
- complete renumbering into a new contiguous `sourceCandidates` array;
- `bodyStartCandidate = headerPrefixCandidates.length` in this new space.

Thus `bodyStart` currently determines not only semantic ownership but the exact
coordinate space supplied downstream.

### E. Multiline branch

`src/multilineDeterministic.ts`

- `createMultilineBodyPlan()` receives `bodyStartCandidate` from the universal scan.
- It starts physical-line body runs exactly there.
- It deliberately does not infer a different header/body boundary.

Therefore multiline deterministic structure is also directly boundary-dependent.
This audit does **not** propose changing multiline behavior in the first ownership
migration.

### F. Mixed/singleline structure-model branch

`src/pipeline.ts`

For non-multiline modes:

- `bodyCandidates = sourceCandidates.slice(bodyStartCandidate)`;
- `bodyRawSource = rawSource.slice(sourceCandidates[bodyStartCandidate].start)`;
- deterministic hints are shifted to that slice;
- the structural model receives only this suffix;
- its local response is shifted back by `bodyStartCandidate`.

This is the central legacy dependency for the singleline work: the structure model
cannot inspect exact source before the scalar boundary even when that source was
not actually accepted as header ownership.

## Independent fixed-header evidence

`src/headerFacts.ts` / essential-fact verification in `src/pipeline.ts`

The fixed-header verifier is intentionally independent of `bodyStart` and can find
card-critical facts anywhere in the statblock. Existing patches already establish
that verified evidence must not inherit a wrong boundary.

Important architectural conclusion: this verifier is **not** a replacement
boundary authority. Its accepted exact ranges are potential contributors to the
future ownership map, not a rule saying everything before/after a fact is header.

## Indirect downstream dependencies

These locations do not consume the original scalar directly, but their behavior
can inherit its earlier classification consequences.

### `src/editableCompiler.ts`

`buildHeader()` currently finds the first `SourcePart` for which `isBodyPart()` is
true and restricts `sourceHeaderParts` to the prefix before it. Fixed structured
facts are explicitly allowed to bypass that semantic boundary, but non-fixed
header presentation still assumes prefix geometry.

This is a **later ownership migration target**, not part of the first singleline
handoff switch.

### `src/abilityTableResolver.ts`

`firstBodyStart(document)` derives a nominal header end from compiled annotation
roles. It is not the original pipeline scalar, but wrong early body annotations can
still constrain ability probing. Existing recovery logic already treats this
semantic boundary as non-authoritative when stronger source proof exists.

This is evidence that boundary-derived annotation geometry has already required
local exceptions.

### `src/boundaryEvidence.ts`

The local names `firstBodyLikeIndex`, `preBodyEnd`, and the `bodyStart` parameter of
`verticalAbilitySequenceIndexes()` are **not the pipeline `bodyStart` contract**.
They are internal structural-shape ceilings derived from candidate evidence. They
must not be mechanically removed merely because their names contain `body`.

## Legacy/dead compatibility surface

`src/modelSchema.ts`

- `createHeaderBoundaryGenerationJsonSchema()` and `parseHeaderBoundaryResponse()`
  remain exported legacy boundary-only helpers.

`src/prompt.ts`

- `UNIVERSAL_HEADER_BOUNDARY_SYSTEM_PROMPT` is an older boundary-only prompt.

They are not imported by the active production pipeline in 2.74.124/125. Removal,
if desired, should be a separate cleanup after the ownership migration, not mixed
into behavioral patches.

## Test dependencies

Tests in `pipeline.test.ts`, `multilinePipeline.test.ts`, `headerFacts.test.ts`,
`modelSchema.test.ts`, `multilineDeterministic.test.ts`, and `webApp.test.ts` encode
parts of the current boundary contract. They should be migrated only when the
corresponding production dependency changes.

Fixture-only `__bodyStartQuote` is compatibility/test infrastructure and should not
be confused with production source ownership.

## Dependency graph

Current active path:

`bounded header candidates`
` -> header LLM {blocks, bodyStart}`
` -> parse/filter header runs by bodyStart`
` -> bodyStartOffset`
` -> route suffix`
` -> splice header-prefix + routed-suffix candidates`
` -> renumber coordinate space`
` -> bodyStartCandidate`
` -> multiline deterministic runs OR structural-LLM suffix`
` -> compiled annotations`
` -> product compiler`

Target path for the next staged patches:

`accepted grounded header/evidence ranges`
` -> authoritative SourceOwnershipMap`
` -> exact complement RemainderView`
` -> singleline structure reconstruction over remainder segments`
` -> structural LLM`

The scalar `bodyStart` may remain temporarily for the old header scan and for
multiline compatibility, but it must cease to decide the singleline structural
input before it is removed from schemas/contracts.

## Recommended implementation order confirmed by the audit

1. **2.74.126 — ownership infrastructure only.** Add an authoritative accepted
   header/evidence range resolver and partition invariants. No parser behavior
   changes.
2. **2.74.127 — `RemainderView` only.** Build the exact source complement as
   discontinuous source segments; diagnostics/tests only.
3. **2.74.128 — singleline handoff switch.** Singleline structure parsing consumes
   the remainder rather than `slice(bodyStart)`. Preserve an unambiguous map back
   to original source coordinates. Do not redesign candidate IDs in the same patch.
4. Re-run the real collapsed corpus before changing header or structure semantics.
5. Only after the handoff is proven, redesign the singleline header task toward
   full-source header ownership and retire `bodyStart` from that mode.
6. Consider mixed/multiline migration only later and separately.

## Key constraints for 2.74.126+

- Model claims alone never create ownership; only accepted grounded ranges do.
- One authoritative ownership resolver must be shared by structural handoff and,
  eventually, product compilation.
- Remainder is a source-map view, not a physically concatenated replacement string.
- Owned gaps are hard discontinuities for structure reconstruction.
- `owned + remainder` must partition exact source without loss, duplication, or
  invention.
- Essential fixed-header verification remains independent and does not become a
  global boundary finder.
- Do not modify BODY/singleline semantic prompts until the ownership handoff has
  been evaluated on the same real corpus.
