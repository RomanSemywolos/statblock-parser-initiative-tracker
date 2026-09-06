# Patch 2.74.106 — exact CR projection, evidence bounds, and presentation recovery

## Scope

This patch stays inside the v2.74.105 source-placement architecture. It does not add a new parser boundary heuristic and does not give semantic ownership any ability to hide source text.

## Challenge Rating

- The product field now has the stable label `Challenge Rating`.
- When CR is printed, the deterministic projection keeps the first rating token and every source character after it in that grounded field. The original source range is shown in Evidence.
- When PB is printed inside the same compact CR row, the CR row is rendered once and PB is materialized as its own deterministic `Proficiency Bonus +N` row. Tarrasque/Aboleth-style combined rows therefore cannot duplicate CR.
- A verifier region that truncates an open trailing parenthetical is extended only far enough to close that parenthetical, bounded by the next essential field. This repairs collapsed Demogorgon `Challenge 26 (90,000` -> `Challenge 26 (90,000 XP)` without semantic guessing.

## Evidence placement

- Evidence fallback ranges are no longer widened to the full semantic annotation. Fact/verifier coordinates are authoritative. This prevents a bad Baphomet `challenge` annotation from moving `Reckless Follow-Through` into Evidence.
- Overlapping Evidence ranges are merged into one exact source interval with the union of their field tags. Hythonia/Astral Dreadnought ability/save overlaps therefore display the source only once.

## Proficiency bonus hardening

- Independently verified CR is authoritative for deterministic PB derivation; unrelated semantic annotations labelled `challenge` cannot veto it.
- A standalone semantic `proficiency_bonus` proposal without verifier support is accepted only when it agrees with independently grounded CR. This rejects Balor/Mimiking saving-throw rows and Baphomet `Speed 40 ft.` when they were misclassified as PB.
- Inline PB fallback is accepted only from the same source field that supplied the selected CR.
- Derived PB always renders from the deterministic numeric fact, never by reusing an unrelated source row.

## Auto Style

- Exact canonical English section rows such as `TRAITS` may be promoted from paragraph to an untyped heading by Auto Style. This is presentation-only and does not change parser section ownership.
- A short feature name followed by one balanced parenthetical may now use a long parenthetical containing punctuation such as semicolons. Example: `Сбрасывание кожи (Мифическая особенность; Перезарядка после короткого или продолжительного отдыха).`

## UTTERANCE OF DAMNATION

The mixed-input header scan selected `ACTIONS` as body start and therefore the BODY semantic parser never received the preceding TRAITS material. v2.74.105 already guarantees that this wrong semantic boundary cannot hide the source. This patch deliberately does not add a deterministic boundary override: the coarse block remains a semantic-model error, while Auto Style now restores the visible `TRAITS` heading.

## Verification

- Focused strict TypeScript compile for editable compiler/document paths: green.
- Compiled `editableCompiler.test` + `editableDocument.test`: 82/82 green.
- Replayed v2.74.105 lossless corpus through the new product compiler for Tarrasque, Aboleth, Baphomet, UTTERANCE, Hythonia and Astral Dreadnought; source placement stayed visible and the targeted projection/evidence regressions were corrected.
- `headerFacts.ts` compiles in isolation with dependency stubs; targeted replay of Balor, Mimiking, UTTERANCE and collapsed Demogorgon confirms PB rejection/derivation and CR parenthetical completion.
- Full project `npm test` remains user-side authoritative because this container could not complete dependency installation (`zod`/`undici` were unavailable locally).
