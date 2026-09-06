# Patch 2.74.199 — ownership-aware mixed metadata geometry

## Scope

This patch is the second mixed-parser pass after the 2.74.198 safe fixes. It targets the recurring QA failure where compact pre-body rows such as Skills / defenses / senses / languages were merged or visually wrapped fragments were promoted as independent rows.

The patch does **not** add a BODY semantic classifier and does **not** create deterministic logical starts. The mixed BODY model remains the authority for restored logical line starts. `Darkfire Abyss`, `Strands of the Demonweave`, omitted peer features and section-heading rescue are deliberately outside this patch.

## 2.74.198 live-corpus checkpoint

The live qwen3:8b replay confirmed the low-risk 2.74.198 changes:

- residual printed `Saving Throws` / `Спасброски` BODY fragments disappeared;
- ADRAKNID's wrapped `Skills ... Perception +17,` / `Stealth +19, Survival +11` became one logical row;
- Dreamer's first `Cantrips (at will):` row joined the same internal spell-list presentation as the numbered spell levels.

The same run also confirmed that the broader metadata-geometry defect remained in Dreamer, Lolth and Orcus, so it is handled separately here.

## Changes

### 1. Mixed-only ownership-aware compact-row overlay

After the fixed Header verifier has been deterministically accepted, mixed mode now applies `strengthenInterleavedMixedMetadataEvidence(...)` to the ordinary generic candidate lattice.

A physical row is eligible only when:

- the whole row is outside accepted Header ownership;
- there is an accepted Header ownership range before it;
- there is an accepted Header ownership range after it;
- the row has bounded compact source shape.

This is a local relationship between exact accepted ownership islands. It is **not** a Header prefix, BODY suffix, `bodyStart`, or semantic metadata range.

Eligible rows receive `header_interleaved_compact_row` advisory evidence. The older narrow `compact_metadata` evidence is retained only when its own existing shape predicate independently matches.

### 2. Continuation evidence still wins

The overlay cannot promote a candidate whose continuation is already strong. Therefore the 2.74.198 trailing-comma/semicolon/colon precedence remains authoritative.

A second language-neutral narrow-column signal handles uppercase continuations after an open short final token on a list-like row. It requires multiple comma/semicolon separators in the previous physical row before a 1–4-letter final lexical token can count as open shape. This supports forms such as:

- `Poison; Bludgeoning, Piercing, and` -> `Slashing from Nonmagical Attacks`;
- `дробящий, колющий, рубящий от` -> `немагических атак`.

The token is never matched against a word list. Requiring the list-like separator shape prevents ordinary short values such as `..., яд` from becoming false continuation signals.

### 3. Same-physical-row punctuation remains soft

When punctuation creates an additional candidate inside a promoted physical row, it gets only `same_physical_interleaved_row` soft continuation evidence. This is important for collapsed forms such as Orcus's `Damage Resistances Cold, Fire, Lightning. Attacks made`: the source row is supported as a row, but the model remains free to split a genuine second logical row inside it.

### 4. Mixed prompt explanation + one geometry example

The mixed starts-only prompt explains the two new evidence classes and contains one example of several compact peer rows with a single wrapped continuation. The example outputs only Cxxx starts and explicitly teaches row geometry, not BODY semantic roles.

## Architecture invariants

- Header request/lattice is unchanged.
- The overlay runs only in the mixed path and only after accepted Header ownership exists.
- Candidate coordinates and legal Cxxx addresses are unchanged.
- BODY JSON schema is unchanged.
- No deterministic logical start is created by this overlay.
- Multiline and singleline routes are unchanged.
- No English/Russian D&D vocabulary is used by the new deterministic evidence code.
- Exact source preservation and Header-gap barriers are unchanged.

## Stored-response corpus replay

The complete 2.74.198 QA store (15 reports, 9 mixed) was replayed through 2.74.199 using the exact stored Header/BODY responses.

Results:

- Header requests: 15/15 unchanged in system prompt, user prompt, schema and generation settings.
- Mixed BODY legal-address schemas: 9/9 unchanged.
- Mixed deterministic output with identical stored model starts: 9/9 unchanged at structured Header + annotation/source-span level.

The changed mixed BODY prompt now exposes the intended evidence in the known failures:

- Dreamer: `Damage Resistances psychic`, `Damage Immunities ...`, `Condition Immunities ...`, `Senses ...`, and `Languages ...` receive strong interleaved-row evidence; the comma-wrapped `and slashing ...` remains continuation.
- ADRAKNID: previously weak one-value rows such as `Condition Immunities ...` and `Languages —` receive row evidence; the corrected Skills continuation remains continuation.
- Lolth: `Slashing from Nonmagical Attacks` receives strong continuation after `..., and`; comma-wrapped Condition Immunities fragments remain continuation; `Languages ...` gains independent row evidence.
- Orcus: `Slashing from Nonmagical Attacks` receives strong continuation; `Attacks made` inside the same physical row receives only soft continuation evidence rather than a forced decision.
- Beledros: a short ordinary final value (`..., яд`) is regression-tested not to trigger the short-open-token continuation rule.

Because this replay reuses old BODY answers, it proves isolation and transport invariants, not model-quality improvement. A new live qwen3:8b run is required to evaluate whether the new evidence improves start selection without regressions.
