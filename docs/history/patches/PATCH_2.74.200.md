# Patch 2.74.200 — mixed metadata prompt isolation

## Why this patch exists

2.74.199 combined two changes in the mixed BODY normalization task:

1. candidate-local, ownership-aware evidence for compact physical BODY rows between accepted Header ownership islands;
2. global mixed-prompt changes explaining that evidence, adding a metadata-oriented few-shot, and exposing a short-open lexical continuation hint.

The live qwen3:8b corpus showed useful metadata gains, but the combined change was not safe enough to promote as the new baseline.

Observed gains included Dreamer metadata rows being restored separately and improved boundaries in Beledros. Observed regressions included major unrelated start omissions in Astral Dreadnought, over-splitting in DRAKOPTERA, and extra peer splitting in Looming Harvest. Lolth/Orcus also showed that the model-facing short-open lexical continuation hint did not reliably prevent `... and` / `Slashing ...` style false starts.

Therefore 2.74.200 is an isolation experiment, not a claim of parser-quality improvement.

## Changes

### Mixed system prompt restored to 2.74.198

`src/prompt.ts` is byte-identical to 2.74.198.

This removes the 2.74.199 global additions:

- explanations of `header_interleaved_compact_row`, `same_physical_interleaved_row`, and `previous_interleaved_row_open`;
- the metadata-specific additional few-shot.

The purpose is to restore the previously observed global model behavior while testing the ownership-aware candidate evidence independently.

### Ownership-aware compact-row promotion retained

After deterministic Header acceptance, mixed BODY candidates may still receive `header_interleaved_compact_row` when a complete short physical row:

- is BODY-owned rather than Header-owned;
- lies in an exact gap between independently accepted Header ownership islands;
- has conservative compact-row shape;
- is not already contradicted by strong source-proven continuation evidence.

This remains advisory model input only. It does not create/remove coordinates and never chooses a logical start.

### Short-open lexical hint removed from model-facing evidence

`previous_interleaved_row_open` is removed from candidate evidence and from the prompt contract.

The narrow shape check survives only as an internal safety veto against false promotion of an uppercase wrapped fragment after a list-like row such as `..., Piercing, and` or `..., рубящий от`. It does not make the continuation stronger and is never sent to the model as a named hint.

The veto requires multiple visible list separators, so a completed value such as `..., яд` does not qualify merely because the final word is short.

## Intentionally not changed

- no deterministic mixed logical starts were added;
- no semantic BODY taxonomy was added;
- no D&D/English/Russian field-name dictionary was added;
- no `Darkfire Abyss` / `Strands of the Demonweave` hard-start rule was added;
- no section-heading rescue was added;
- no peer-feature hard-start rescue (`Cocoon`, `Hide`, `Клешни`, etc.) was added;
- Header, multiline, and singleline contracts are unchanged.

## Acceptance test for the next live corpus

2.74.200 should be evaluated on exactly the same qwen3:8b corpus before promotion.

Success means:

1. retain the useful Dreamer/Beledros metadata separation seen in 2.74.199 where possible;
2. recover Astral Dreadnought toward the 2.74.198 start pattern, especially the unrelated section/paragraph starts lost in 2.74.199;
3. remove the new DRAKOPTERA/Looming Harvest over-splitting seen in 2.74.199;
4. retain the 2.74.198 safe fixes for Saving Throws ownership, ADRAKNID comma continuation, Cantrips list presentation, and dice nowrap;
5. do not treat unresolved Lolth/Orcus narrow-column wraps as justification for deterministic forced starts.

If these conditions are not met, the ownership-aware overlay should be reverted or redesigned rather than compensated with more global prompt complexity.

## Post-evaluation result (live qwen3:8b corpus)

The user reran the same fixed corpus after this package was produced. The isolation succeeded and 2.74.200 is now the accepted mixed baseline:

- Dreamer retained the 2.74.199 metadata-row separation (`Skills`, defenses, senses, languages) without the global prompt experiment;
- Beledros retained the useful metadata/feature boundary improvements;
- Astral Dreadnought recovered the unrelated starts lost in 2.74.199, including `Действия`;
- DRAKOPTERA returned from the 2.74.199 bullet-list over-splitting to the stable grouping while retaining the useful `Languages —` separation;
- Looming Harvest returned to the 2.74.198 BODY grouping;
- Orcus improved metadata continuation by no longer materializing `Attacks made` / `Poisoned` as false headings;
- the known `... and / Slashing from Nonmagical Attacks` false start remained in Lolth/Orcus, so the removed model-facing short-open hint was not needed for the successful parts of the patch.

Therefore the candidate-local ownership-aware metadata geometry is retained and 2.74.200 replaces 2.74.198 as the accepted live mixed checkpoint.
