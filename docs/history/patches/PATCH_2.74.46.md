# Patch 2.74.46 — language-neutral structural parser audit

## Goal

This patch removes English as a hidden prerequisite from the active structural parser path. Language/profile knowledge is now additive semantic evidence. Source geometry, candidate addressability, ownership and losslessness must remain viable when no English profile matches the source.

This is an architectural multilingual cleanup, not a Russian dictionary patch.

## Core invariant

The active candidate path now follows this division of responsibility:

1. Universal source geometry exposes grounded coordinates without knowing the language.
2. The structural LLM assigns multilingual semantics to grounded candidate spans.
3. Optional language/profile evidence may increase confidence or provide a semantic fallback.
4. Deterministic code may change ownership only from narrow source-proven structural invariants.
5. The compiler validates grounded ownership but does not resize candidate spans with an English lexicon.
6. Unknown source remains source-owned; missing semantic recognition cannot delete printed text.

## Routing: English anchors are no longer required

`parserRouting.ts` now bases automatic mode selection on language-neutral source shape rather than English header/section names.

Useful evidence includes compact metadata geometry, vertical score/modifier sequences, named-rule geometry, list geometry and soft-wrap geometry.

Regression coverage includes:

- a Russian vertical Astral Dreadnought routing automatically to `multiline` without English profile anchors;
- a soft-wrapped Imperial-style statblock remaining `generic`/mixed;
- clean multiline statblocks with numbered internal subeffects remaining `multiline`.

English profile evidence is no longer part of the routing decision.

## Multiline: one full structural pass, no English header/body planner

The old specialized multiline path depended on deterministic English header fields and English section headings to discover the header/body boundary. That made localized multiline input structurally weaker than English input.

The active multiline path now sends the complete source through the same grounded candidate-span structural task as the generic path. Every non-empty physical source row remains available as a candidate coordinate.

A physical line is now presentation geometry, not automatic semantic ownership proof:

- multiline presentation still preserves every non-empty physical source row exactly as a separate row;
- a logical feature may own multiple physical rows;
- blank source rows remain intentionally removed;
- no synthetic line splits are introduced.

The removed historical `multilineDeterministic.ts` planner is no longer part of the project source.

## Shared language-neutral structural evidence

New/shared `surfaceStructure.ts` helpers provide vocabulary-free shape evidence for:

- compact metadata rows;
- vertical score/modifier cells;
- compact standalone headings;
- trusted physical-line named-rule leads;
- collapsed named-rule leads.

Generic and multiline modes now share compact metadata and vertical table evidence.

A six-row pattern such as localized `label score (modifier)` rows can therefore be recognized as one source-visible table sequence without knowing STR/DEX/etc. Semantic ability mapping remains grounded through model-provided ability labels.

## Boundary evidence: coordinate density cannot weaken a proven title

Candidate existence remains separate from boundary confidence.

Dense multilingual token coordinates can occur inside a printed title. `boundaryEvidence.ts` now evaluates a `named_block_start` from its raw source offset rather than truncating at the next candidate coordinate. Adding weak coordinates can therefore no longer turn a previously source-proposed title such as `Maddening Gaze.` into a weak one merely because another coordinate exists at `Gaze.`.

Physical line starts remain weak by themselves. Positive metadata/table/title/profile evidence is required for stronger ownership evidence.

## Singleline: bounded weak multilingual lattice

Collapsed input cannot expose unknown-language field labels from physical newlines because no such newlines exist. The singleline enricher now creates a bounded weak token lattice through the collapsed prefix, independent of any language profile.

This makes localized/header coordinates addressable by the model even when the deterministic layer does not know the printed words. Around strong named-rule proposals, a short weak look-back window exposes possible unfamiliar section-heading coordinates.

These token coordinates are deliberately weak:

- coordinate existence does not mean a new block;
- they do not assign semantics;
- they do not override model ownership;
- source-proven numbered/lettered hierarchy remains internal.

The old exact sparse-lattice parity test was replaced by the correct monotonic invariant: all legacy structural coordinates remain available while additional weak multilingual coordinates are allowed.

Generic/mixed input also receives bounded weak token coordinates on unusually long pre-body physical rows so two localized metadata fields collapsed onto one visual row remain addressable without an English profile.

## Header semantics: the model can finally name localized header fields

Previously candidate `h` blocks could say only “this is a header”. The transport then had to infer the actual field subtype with the English header lexicon. This made localized headers inherently degrade to `other_header`.

Candidate `h` blocks now accept optional compact semantic code `f`:

- `ac` → `armor_class`
- `init` → `initiative`
- `hp` → `hit_points`
- `spd` → `speed`
- `ab` → `ability_scores`
- `sv` → `saving_throws`
- `sk` → `skills`
- `dv` → `damage_vulnerabilities`
- `dr` → `damage_resistances`
- `di` → `damage_immunities`
- `ci` → `condition_immunities`
- `se` → `senses`
- `lang` → `languages`
- `hab` → `habitat`
- `cr` → `challenge`
- `xp` → `experience_points`
- `pb` → `proficiency_bonus`
- `oth` → `other_header`

The model still cannot author source text. `f` only supplies semantics for an already grounded span.

Header field precedence in direct transport is now:

1. independently verified critical fact;
2. structural model `h.f` semantic field;
3. optional deterministic/profile semantic fallback;
4. `other_header`.

Thus English knowledge is a fallback, not the only path to canonical header semantics.

## Direct transport: old English singleline ownership repair removed

The old singleline deterministic interval/identity repair depended on English header classification. It has been removed from the active transport.

Source-proven feature boundary enforcement is now language-neutral and enabled in every routing mode, including singleline.

Dense weak candidate coordinates are supported by bounded bridge logic: strong continuation/list evidence may close backward across only a short chain of weak/unclassified coordinate cells to the nearest compatible owner. Positive independent boundaries stop the bridge.

The `ownerId` invariant remains: adjacent runs never merge merely because their classification is the same.

## Active feature-boundary safety isolated from legacy reconciler

The active transport no longer imports `candidateReconciler.ts`.

Language-neutral feature splitting was extracted to `sourceProvenFeatureBoundaries.ts`. It uses boundary evidence and narrow punctuation/geometry recovery only.

`candidateReconciler.ts` and `sectionStructure.ts` remain legacy compatibility/test code; their English semantics no longer sit in the active candidate transport import path.

## Candidate compiler: no English re-splitting of direct ownership

`compileLosslessDocument()` previously could re-split a model-owned candidate header span using `findDeterministicHeaderStarts()`, which is English-lexicon based.

When `preserveStructuralOwnership` is true (the active candidate path), the compiler now uses grounded candidate spans exactly. It may validate coordinates, overlaps and losslessness but cannot resize or split semantic ownership with a language lexicon.

The old deterministic English splitter remains only for the legacy quote-based compatibility path.

## Deterministic hints

English size/type/alignment vocabulary was removed from the base deterministic structural hint channel.

Current structural hints are vocabulary-free relationship hints such as named-rule continuation and labelled continuation. Identity semantics belong to the multilingual model/grounded verification layer rather than an English structural dictionary.

## Semantic fact parsing

When a header annotation is already semantically known as `challenge` or `proficiency_bonus`, fact extraction now parses the value shape without demanding that the source label repeat the English words `Challenge`, `CR`, or equivalent English aliases.

Canonical ability identities such as STR/DEX remain semantic domain identifiers. Localized printed labels continue to be grounded through model-provided `abilityLabels`.

The intentional product fallback that materializes missing saving throws from ability modifiers is unchanged.

## Localized title shape

Trusted physical-line title proposals allow short sentence-case names, supporting languages where feature names are not English Title Case.

Missing-whitespace recovery such as `Fling.The...` remains stricter than ordinary trusted physical-line handling so prose such as `The creature attacks.It then moves.` is not promoted into a feature title.

## What intentionally remains English-aware

English has not been mechanically deleted from the repository. It remains where language-specific semantics are appropriate:

- `headerLexicon.ts` and `englishCandidateEvidence.ts`: optional English profile semantic evidence;
- `candidateTransport.ts`: final semantic fallback for an already-owned header span only; it cannot resize ownership;
- translation rules/glossaries;
- canonical internal ability/domain names;
- product/editor default English labels;
- legacy quote-based compatibility parsing;
- legacy `candidateReconciler.ts`/`sectionStructure.ts`, which are no longer imported by active candidate transport.

These paths do not make English a prerequisite for active routing or structural ownership.

## Test/harness changes

Legacy tests that located candidates by preview were updated to use exact source offsets because dense weak token lattices intentionally shorten previews.

The old “exact v2.74.18 candidate lattice” assertion was replaced with the correct compatibility invariant: previous structural coordinates remain present while new weak multilingual coordinates may be added.

A legacy reconciler integration expectation that injected English section semantics was moved to active source-proven boundary behavior: section semantics are model-owned; deterministic code only splits at source-proven peer feature boundaries.

## Validation in this environment

The dependency-free emitted focused structural suite passes completely after the audit.

The broad emitted suite is also run; files requiring runtime `zod` cannot start in this sandbox because project dependencies are not installed. This is an environment limitation, not counted as passing.

Normal `npm run typecheck` cannot run here because the local `@types/node` dependency is unavailable. The temporary `noCheck`/`types: []` emit is used only to execute dependency-free tests and is not a substitute for the real Windows typecheck.

The user's normal dependency-backed Windows `npm test` and `npm run typecheck` remain authoritative.

## Final release validation

After the final singleline activation and active-path isolation changes, validation was repeated from a clean emitted tree:

- `npx tsc -p tsconfig.emit.json` completed successfully with the temporary `noCheck` / `types: []` validation configuration.
- `node --test .tmpemit/*.test.js` reported **333 test entries: 325 passed, 8 startup failures, 0 assertion failures among runnable tests**.
- The 8 startup failures are dependency-environment failures only:
  - `zod` unavailable for `headerFacts.test`, `modelSchema.test`, `multilinePipeline.test`, `productParseJobRunner.test`, `quoteAnchor.test`, and `webApp.test`;
  - `undici` unavailable for `pipeline.test` and `productParser.test`.
- Frontend TypeScript syntax/noCheck validation (`npx tsc -p frontend/tsconfig.json --noEmit --noCheck`) completed successfully.
- Normal `npm run typecheck` was attempted and could not start project type-checking because `@types/node` is not installed in this sandbox (`TS2688`). This is not counted as passing.
- Static import-graph inspection from `src/pipeline.ts` confirms that `candidateReconciler.ts`, `sectionStructure.ts`, and the removed `multilineDeterministic.ts` are not reachable from the active candidate parser path. `headerLexicon.ts` / `englishCandidateEvidence.ts` remain reachable only as additive semantic/profile evidence and final header semantic fallback; they do not own routing or resize grounded spans.

The user's dependency-backed Windows `npm test` and `npm run typecheck` remain the authoritative final environment checks.
