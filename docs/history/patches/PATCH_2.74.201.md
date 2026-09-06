# Patch 2.74.201 — contextual standalone mixed geometry

## Why this patch exists

The live 2.74.200 qwen3:8b corpus promoted 2.74.200 to the accepted mixed baseline. The ownership-aware metadata overlay retained the useful Dreamer/Beledros improvements while the 2.74.199 prompt-induced Astral/DRAKOPTERA/Looming regressions disappeared.

The next isolated defect class is different: short physical section rows can be omitted by the mixed BODY model even though their printed standalone geometry survives. Examples in the live corpus include one-word or sentence-case rows such as `Actions`, `Действия`, `Reactions`, and `Легендарные действия`. The existing mixed hard-geometry safeguard already preserves source-proven ALL-CAPS and conservative multi-word title-case standalone rows, but it intentionally does not cover these shapes.

This patch extends that existing geometry safeguard without changing the model prompt or adding section vocabulary.

## What changed

### Contextual standalone physical-row proof

`src/deterministicHints.ts` adds `contextual_standalone_heading_row` for mixed normalization only.

A candidate can receive this hard geometry only when all of the following source-shape conditions hold:

1. it is an actually printed standalone physical row (`standalone_block_start` + physical line start);
2. it is not inside the ownership-proven Header-metadata corridor (`header_interleaved_compact_row` / `compact_metadata`);
3. the immediately preceding physical row is not another standalone-looking row, which protects wrapped titles such as `Flying\nSword.`;
4. scanning only a small nearby physical-row window reaches an independently shaped `named_block_start` before returning to metadata or crossing another ambiguous standalone row.

No word such as `Actions`, `Reactions`, `Действия`, `Описание`, etc. is matched. The rule is language-neutral and geometry-only.

### Hard geometry remains non-model-facing

The new hint is deliberately excluded from `mixedNormalizationHints(...)`. Therefore it is not serialized into the mixed BODY prompt.

The mixed BODY model request (system prompt, user prompt, JSON schema and completion budget) remains identical to 2.74.200 for the same Header ownership/candidate lattice.

As with the already established ALL-CAPS/title-case hard safeguard, a proven standalone physical row and the immediately following surviving physical BODY row are kept separate before the shared deterministic multiline BODY parser. This preserves the printed line boundary; it does not assign section identity.

### Ambiguous wrapped-title guard

A pre-existing presentation regression test (`Flying\nSword.`) exposed an over-broad first draft of the contextual rule. The final rule rejects a candidate when the preceding physical row is itself standalone-looking. A dedicated regression test now locks this behavior.

### No `Darkfire Abyss` hard start

`Darkfire Abyss (9th Level Spell, Recharge 5-6).` is not a standalone section row and receives no new deterministic start.

For Lolth, proving the physically standalone `Reactions` row also necessarily preserves the immediately following physical BODY row as separate section content. In this source that row begins `Strands of the Demonweave...`. This separation is a consequence of the proven `Reactions` line geometry, not a `Strands` title-shape hard rule. `Darkfire Abyss` remains model-owned and unresolved by this patch.

## Stored-response replay against the live 2.74.200 corpus

The 2.74.200 live report was replayed through 2.74.201 using the exact stored Header and BODY model responses.

For every mixed case, the BODY model request remained identical to 2.74.200.

Product BODY changed only in the four cases containing the targeted omitted standalone rows:

- **Astral Dreadnought:** `Легендарные действия` becomes an independent heading. The later first legendary `Клешни` is still model-owned and may remain merged with the explanatory rules.
- **Beledros:** `Легендарные действия` is separated from the preceding spell-list row even though that row ends in `;`; the existing first legendary `Коготь` start is preserved.
- **Lolth:** `Reactions` becomes an independent heading and the following physical `Strands of the Demonweave...` row becomes separate section content. `Darkfire Abyss` remains merged with the preceding action because the model omitted its start.
- **Orcus:** omitted `Actions` and `Reactions` become independent headings.

The other mixed controls were product-body equivalent under identical stored model responses:

- ADRAKNID
- DRAKOPTERA
- Dreamer
- Looming Harvest
- Mimiking

This is the intended isolation boundary for the patch.

## Regression coverage

Added/strengthened tests cover:

- one-word standalone section row omitted by the model;
- sentence-case Cyrillic standalone row after a semicolon-terminated prior line;
- metadata-tail rejection (`Slashing from Nonmagical Attacks` before another metadata row);
- adjacent wrapped-title rejection (`Flying\nSword.`);
- the contextual hard hint is not exposed to the model prompt;
- existing presentation normalization still joins the wrapped `Flying Sword.` title correctly.

## Known remaining mixed issues after this patch

This patch intentionally does not solve unrelated classes:

- Lolth: `Darkfire Abyss (...)` remains model-owned and can stay merged with `Insidious Embrace`;
- Lolth/Orcus: `Slashing from Nonmagical Attacks` can still be chosen by qwen as a false logical start;
- Astral Dreadnought: the first legendary `Клешни` can remain merged into legendary-action rules;
- other omitted peer-feature starts (`Cocoon`, `Hide`, etc.) remain a later isolated class;
- Auto Style/presentation defects such as a description sentence being styled as a feature title are downstream work, not mixed geometry.

## Evaluation rule

2.74.200 remains the accepted live baseline until 2.74.201 is run on the same corpus.

Promotion requires the targeted standalone-heading repairs without new BODY-start regressions in the controls. If unrelated model behavior changes despite request parity, the deterministic hard-geometry delta must be inspected rather than compensated with broader prompt changes.
