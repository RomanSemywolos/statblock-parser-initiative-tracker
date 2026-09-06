# Patch 2.74.202 — hard comma/semicolon continuation inside mixed metadata corridors

## Why this patch exists

2.74.198 already made a printed trailing comma/semicolon strong continuation evidence and stopped the following compact row from self-promoting. The live 2.74.201 qwen3:8b corpus showed the remaining weak-model failure mode: Lolth still returned starts on all three wrapped `Condition Immunities` continuation rows even though each candidate already carried `continuation=strong; continuationEvidence=previous_line_trailing_separator`.

The original agreed fallback was: first reduce the chance of a split after a comma; if that still fails, remove that split. This patch performs that escalation only where source geometry makes it safe.

## Behavior change

Added `hardInterleavedMixedMetadataContinuationIndexes()` in `src/mixedMetadataEvidence.ts`.

A candidate becomes a deterministic **non-start** only when all of the following hold:

1. it is a real physical-line start;
2. it lies in an exact BODY-owned gap between accepted Header ownership islands;
3. the continuation chain is rooted in a preceding `header_interleaved_compact_row`;
4. the candidate already carries strong `previous_line_trailing_separator` continuation evidence;
5. the immediately previous physical line actually ends in a comma or semicolon.

The rule deliberately does **not** harden colon continuations. It also does not apply after the final Header ownership island, so ordinary BODY prose remains model-owned.

The BODY model request is unchanged. Candidates remain visible to qwen exactly as in 2.74.201. After the response is parsed, any returned start at one of these proven continuation coordinates is filtered before virtual multiline reconstruction. No new logical start is invented and source text/coordinates are unchanged.

A diagnostic routing signal `mixed_body_metadata_separator_continuation_veto` is emitted only when the model actually returned a vetoed start.

## Corpus replay

The complete 2.74.201 report was replayed through 2.74.202 using the exact stored Header and BODY model responses.

- BODY request parity: **all 9 mixed cases identical** on system prompt, user prompt, JSON schema and generation parameters.
- Multiline cases: unchanged.
- Mixed output annotations: unchanged in Astral Dreadnought, Beledros, ADRAKNID, DRAKOPTERA, Dreamer, Looming Harvest, Mimiking and Orcus.
- Lolth only: three model-returned starts on the wrapped `Condition Immunities` continuation rows are vetoed, collapsing those three false rows back into the source-printed logical metadata row.

This patch intentionally does **not** address:

- `Slashing from Nonmagical Attacks` after a line ending in `... Piercing, and`;
- `Darkfire Abyss`;
- omitted peer features such as Astral legendary `Клешни`, ADRAKNID `Cocoon` / `Hide`.

Those require separate evidence experiments and remain isolated from this safe separator escalation.
