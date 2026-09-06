# Patch 2.74.207 — singleline Header full-fact coordinate contract

## Status

Evaluation candidate. The accepted mixed baseline remains **2.74.202**. This patch changes only the active **singleline Header** transport/grounding contract. Singleline BODY, mixed and multiline behavior are intentionally unchanged.

## Why 2.74.206 was rejected

The live 2.74.206 qwen3:8b run showed that inline coordinates solved the detached-address problem only partially. The remaining mismatch was semantic: 2.74.206 asked the model for **label-only** spans, while the established mixed Header task asks for **complete printed fact spans**.

The model repeatedly selected a whole compact fact or its numeric value instead of the label-only span. Examples from the live corpus included `AC 25`, `HP 697`, ability scores instead of ability labels, and CR/PB values. The deterministic verifier correctly rejected these claims; weakening it to reinterpret nearby coordinates would move semantic repair into deterministic code and violate the project authority split.

## 2.74.207 design

### 1. Same semantic contract as mixed

Singleline Header now asks for complete printed facts:

- `n`: complete creature name;
- `sta`: complete adjacent size/type/subtype/alignment phrase;
- `ac`: complete printed Armor Class fact;
- `init`: complete separately printed Initiative fact;
- `hp`: complete printed Hit Points fact;
- `ab`: complete six-ability region;
- `sv`: complete separately printed Saving Throws/Saves fact; omit when saves exist only as the save column inside `ab`;
- `cr`: complete printed Challenge/CR fact;
- `pb`: complete separately printed PB/Proficiency Bonus fact, including PB nested inside a CR parenthetical when it is actually printed.

The model also returns all six mapped ability-label coordinate spans when it returns/proposes the ability region.

This mirrors the mixed Header contract. The singleline-specific specialization is only the coordinate presentation needed when physical row geometry is absent.

### 2. Dense neutral atomic token cards

The source view is now rendered as one ordered stream:

`C000=Creature C001=Large C002=outsider ...`

Every non-whitespace source unit remains addressable. A card contains no semantic class, confidence, ownership, title hint or boundary answer. This avoids both the old dual structural/address transport and the 2.74.206 `[Cxxx]token` prefix-marker association ambiguity.

The model returns only visible `Cxxx` IDs. It never reproduces source text and never returns interpreted numeric values.

### 3. Compact coordinate schema

2.74.206 repeated every valid Cxxx ID in generation-schema enums for every `s/e` field. With 500–800 source units this duplicated tens of thousands of characters into the structured request.

2.74.207 constrains coordinate IDs lexically (`^C[0-9]+$`) in the generation schema. The response parser still validates every returned ID against the real candidate count and rejects reversed/out-of-range spans. Therefore schema compaction changes transport cost, not authority.

On the five live 2.74.206 sources:

| Source | 2.74.206 user prompt | 2.74.207 user prompt | 2.74.206 JSON schema | 2.74.207 JSON schema |
| --- | ---: | ---: | ---: | ---: |
| Astral Dreadnought | 9,505 | 8,812 | 29,981 | 1,174 |
| Aspect of Tiamat | 7,847 | 7,203 | 27,923 | 1,174 |
| Baphomet | 9,907 | 9,089 | 35,231 | 1,174 |
| Demogorgon | 7,132 | 6,563 | 24,773 | 1,174 |
| Tarrasque | 7,310 | 6,717 | 25,781 | 1,174 |

### 4. Deterministic full-fact proof

The deterministic singleline grounder now verifies the selected complete fact rather than treating the selected range as a label and searching for the value after it.

- Scalar fields require a compact printed label prefix and a kind-compatible mechanical value inside the selected fact.
- Directly attached balanced parenthetical material is closed deterministically after the proven value.
- Nested `PB +9)` can be proven without annexing the CR parenthetical closing punctuation into PB ownership.
- Saving Throws requires a compact printed field-label prefix followed by at least one mapped ability + signed bonus pair; deterministic code may close the adjacent comma/semicolon continuation.
- Ability proof supports interleaved `STR 30 (+10) ...`, separate six-label rows, and 2024 `STR 30 +10 +10 ...` cells.
- The optional `ab` model span is checked against the mechanically proven complete ability region. Six independently grounded mapped labels can still prove the region even if the redundant `ab` span is imperfect, matching the established Header-verification philosophy.

No fuzzy quote matching, language dictionary or D&D vocabulary was added.

## Isolation

No singleline BODY changes were made. The path remains:

`accepted Header ownership -> exact BODY complement -> one starts-only singleline BODY geometry call -> shared deterministic multiline BODY parser`

The mixed and multiline Header/BODY prompts and active paths are unchanged.

## Replay validation

The five source texts from the live 2.74.206 report were replayed through 2.74.207 using correct full-fact coordinate selections and the exact stored 2.74.206 BODY starts responses.

All five:

- made exactly two model tasks (Header + BODY);
- produced zero `singleline_header_*` grounding issues;
- reconstructed the raw source exactly;
- recovered the intended closed Header facts;
- preserved the stored BODY response coordinate space.

This is an oracle/contract replay, not a live qwen quality claim. 2.74.207 must still pass the same five-case live qwen3:8b corpus before promotion.
