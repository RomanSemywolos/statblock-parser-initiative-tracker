# Patch 2.74.167 — Header inline transport fidelity

## Scope

This patch does **not** add new parser semantics. It restores the structural information that already exists on Header candidates while continuing the reversible inline-coordinate transport experiment introduced in 2.74.164–166.

The legacy Header call remains authoritative. The inline Header call remains shadow/A-B diagnostics only. BODY parsing, Header ownership, candidate generation, deterministic verification, language-neutrality rules, and source reconstruction are unchanged.

## What changed

### 1. Existing candidate structural evidence now travels with each inline coordinate

The shadow overlay can serialize the candidate's existing:

- candidate reasons;
- boundary scope;
- boundary strength;
- boundary evidence;
- continuation strength;
- continuation evidence.

The serialization is compact and positional. Example:

`⟦C023|lsn;TSlTs;N⟧`

This is only a transport encoding of data already present on the `SourceCandidate`. It does not infer, strengthen, weaken, add, or remove evidence.

The raw source and candidate starts remain unchanged. `stripHeaderCoordinateOverlay()` still reconstructs the exact raw source by removing only recorded service markers.

### 2. Collapsed-singleline presentation roles are preserved

When the authoritative Header path is singleline, the inline shadow request also carries the existing presentation distinction that the legacy singleline Header prompt already had:

- structural proposal;
- address-only coordinate;
- mixed coordinate;
- existing synthetic top-level/internal role when present.

These are encoded as optional marker payload fields. No new role or origin is introduced.

### 3. Inline Header semantic instructions were restored to the established contracts

The general inline Header system prompt again carries the same fixed-Header restrictions as the legacy verifier, including:

- at most one fact per kind;
- `sta` excludes publication/page metadata;
- explicit-vs-derived rules for Initiative/PB;
- complete ability-region and saving-throw rules;
- no BODY classification.

The singleline shadow path now uses a collapsed-singleline inline system prompt that preserves the established singleline Header rules and structural-vs-address distinction instead of using the shorter universal inline prompt.

Ability-label semantics were returned to the existing contract: the model is asked for the **exact printed labels** as semantic hints. The deterministic code remains authoritative for all numeric cells and grounding. The experimental coordinate-per-label requirement from 2.74.166 is therefore not part of this fidelity patch.

### 4. Empty hint side-channel is omitted in the inline request

When there are no `DeterministicHint` entries, the shadow prompt does not emit an empty `SOURCE-SHAPE HINTS` block. This changes no information; it only removes empty transport overhead.

## Deliberately unchanged

- No production switch to inline Header transport.
- No new candidate coordinates.
- No candidate pruning/projection.
- No new deterministic semantic dictionaries.
- No ability resolver redesign.
- No Cradle-specific repair.
- No BODY prompt or classifier changes.
- No source ownership changes.
- No change to the authoritative legacy Header request.

## Validation

- `npm run typecheck` — PASS
- `npm run build` — PASS
- compiled core test suite — **581/581 PASS**

The new tests cover:

- exact reversibility with structural markers;
- lossless compact serialization of existing boundary/continuation evidence;
- preservation of existing singleline structural/address and synthetic roles;
- shadow-only use of the enriched inline markers;
- continued non-authoritative A/B behavior.

## Prompt-size note

Restoring the full structural evidence intentionally gives back part of the very aggressive 2.74.165 character savings. On the 13-report 2.74.166 corpus, deterministic reconstruction of the new request measured roughly **17.3% fewer request characters than the legacy Header requests** while preserving far more of the established structural information. Real model token counts must be measured from a new 2.74.167 run; character counts are not a tokenizer substitute.
