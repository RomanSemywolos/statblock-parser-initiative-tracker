# Patch 2.74.39 — Mixed boundary evidence audit and authority cleanup

## Why this patch exists

Repeated mixed-source regressions survived earlier local fixes because boundary confidence was not a single authority. Candidate proposal, language/profile anchors, table/title shape, the model prompt, post-model reconciliation, and product compilation could each independently strengthen or reinterpret ownership. The result was asymmetric: several layers could manufacture a stronger split while weak/continuation evidence was mostly advisory and sometimes never reached the model.

The Fraz-Urb'luu regression exposed the conflict clearly: wrapped header values such as `Slashing from Nonmagical Attacks` and `Poisoned` could look stronger than the actual `Damage Immunities` / `Condition Immunities` header starts, and wrapped body prose could survive as separate editable paragraphs.

## Architectural invariant

Candidate coordinate != logical boundary.

For generic/mixed input:
- every non-empty physical row remains available as a coordinate;
- a physical newline alone is weak evidence;
- positive block-start evidence and continuation evidence are separate axes;
- optional locale/profile evidence may strengthen recognized anchors but its absence never weakens unfamiliar/localized text into impossibility;
- ordinary deterministic post-model splitting must consume the centralized boundary evidence rather than recomputing feature confidence independently;
- continuation evidence remains advisory unless the source supplies independently hard ownership proof.

Trusted multiline retains its existing strict physical-row contract.

## Changes

### 1. Boundary evidence now has an explicit continuation axis

`CandidateBoundaryEvidence` now carries:
- `continuationStrength`: `none | soft | strong`
- `continuationEvidence`

Vocabulary-free mixed continuation signals include:
- unfinished previous physical line;
- trailing separator on previous line;
- lowercase cased line start;
- numeric line start;
- compact `Label:` row immediately after a named-rule-shaped start.

These signals do not assign semantics and do not delete candidate coordinates.

### 2. Language/profile anchors are real positive evidence

`attachBoundaryEvidence()` now receives the active structural profile. Recognized profile header starts become `top_level/strong`; recognized section starts become `top_level/hard`.

This fixes the previous inversion where an English `Damage Immunities` start could remain weak while its visual continuation `Slashing ...` was independently promoted.

The profile is additive only. Unknown/localized/homebrew labels still remain available to the LLM through universal coordinates.

### 3. Mixed compact standalone rows no longer become strong boundaries by themselves

`standalone_block_start` still exists as a proposal reason, but only collapsed single-line mode promotes that reason to `compact_block/strong`.

In generic/mixed input, a short capitalized visual wrap such as `Poisoned` or `Slashing from Nonmagical Attacks` is not positive top-level evidence merely because it is compact.

### 4. Table-shape promotion is stricter and vocabulary-free

The previous detector could mark rows such as `Armor Class 18` or `Saving Throws DEX +8, ...` as `table_row_start/hard` merely because the following row contained enough numeric-looking cells.

A table-label row must now itself have table-label shape: multiple lexical cells, no numeric-like cell, and no prose punctuation. The ordinary six-label ability row remains valid; incidental metadata rows no longer get false hard table boundaries.

### 5. Parenthetical metadata no longer breaks title evidence

Feature-title word/case checks now evaluate the title outside parenthetical metadata. Long but valid printed titles such as `Shroud of the Hidden Hand (Mythic Trait, 1/Day).` can therefore receive normal title evidence without knowing any of the words inside the qualifier.

### 6. Generic prompt now receives both evidence axes

Each candidate shown to the structural model includes:
- boundary scope/strength;
- positive boundary evidence;
- continuation strength;
- continuation evidence.

The system prompt explicitly says:
- physical newline alone is not a mixed top-level proof;
- strong continuation is evidence against a split, not an absolute prohibition;
- localized/homebrew/uncased text may still form a real boundary even without profile/title evidence;
- optional locale/profile anchors are additive evidence rather than a language requirement.

### 7. Ordinary post-model feature splitting uses centralized boundary authority

The generic deterministic feature splitter no longer has a second ordinary `looksLikeStrongNamedFeature()` bypass. A normal deterministic split now requires centralized non-weak top-level `title_shape` evidence.

One narrow source-shape recovery remains for a physically wrapped, unmatched parenthetical title, because ordinary title extraction cannot produce evidence for that malformed surface form.

### 8. Localized/model-owned headers are no longer rewritten into features by English fallback

Active direct transport previously reclassified a model `header_field` with no recognized deterministic English subtype into `feature` when its surface text looked like a strong named feature.

That was unsafe for multilingual and homebrew statblocks. Structural header ownership is now preserved; critical header semantics are still verified separately and grounded before receiving a specific product field.

### 9. Mixed paragraph boundaries are strong, not hard

A blank line in mixed PDF/web text is useful positive geometry but can still occur inside a multi-paragraph feature. Generic paragraph starts are now `top_level/strong` rather than `hard`.

Trusted multiline paragraph geometry remains hard.

### 10. Removed dead generic pre-header coordinate pruning

The earlier generic enrichment deleted some weak pre-header physical starts and later re-added every physical start, so the pruning no longer changed the final lattice. It has been removed. Candidate existence and boundary confidence are now explicitly separate responsibilities.

### 11. Diagnostics expose model overrides of strong continuation evidence

If the model starts an owned span at `weak + strong continuation`, transport preserves the model decision for multilingual flexibility but emits `candidate_strong_continuation_started_block`.

This makes future regressions diagnosable without silently changing ownership.

## Exact Fraz-Urb'luu evidence after the patch

- `Damage Immunities ...` -> `top_level/strong`, `profile_header_anchor`
- `Slashing from Nonmagical Attacks` -> `unknown/weak`, continuation from open previous line
- `Condition Immunities ...` -> `top_level/strong`, `profile_header_anchor`
- `Poisoned` -> `unknown/weak`, `strong` continuation from trailing separator
- `Shroud of the Hidden Hand (...)` -> `top_level/strong`, `title_shape`
- `Ephemeral Resistance (...)` -> `top_level/strong`, `title_shape`
- `targeted ...`, `to teleport ...`, `30 feet ...`, `illusory trick.` -> `unknown/weak` with strong continuation evidence where applicable

The same mechanism contains no `Hit`, `Reach`, attack-name, damage-type, feature-name, or other D&D vocabulary.

## Product derivations observed during the audit

Two values in the reported rendered result are not parser-boundary hallucinations:
- missing saving throws are currently filled in the editable product header with the corresponding ability modifiers when the source has no Save column;
- Proficiency Bonus may be derived from a grounded Challenge value.

Those are explicit product/compiler policies and were not changed in this parser-structure patch. Whether source-faithful display should visually distinguish these derived values is a separate product decision.

## Verification in the current sandbox

The dependency-backed project `npm test` / `npm run typecheck` cannot be run here because the installed project dependencies are absent (`zod`, `@types/node`).

Using a temporary TypeScript `noCheck` emit with no ambient Node types:
- focused boundary/source/reconciler/transport/prompt/routing/editor compiler suite: 95/95 passed after the final changes;
- wider emitted suite: 319 test entries, 311 passed; 8 test files failed to start because runtime `zod` is unavailable; there were no assertion failures among runnable tests.

The temporary emit config/output is not part of the distributable archive.
