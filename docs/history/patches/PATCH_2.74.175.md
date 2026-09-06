# Patch 2.74.175 — parser finalization after Header transport experiments

2.74.175 is a consolidation/stabilization patch based on 2.74.174. It is deliberately not another Header transport experiment. The 2.74.163–2.74.174 A/B branch established which parts of the established Header request are behaviorally important; production returns to one authoritative Header call and applies the useful, language-neutral fixes that were deferred while the transport experiment was isolated.

## 1. Retire active Header A/B execution

The parser no longer performs a second shadow Header request in normal execution. The established legacy Header request remains authoritative and is now the only Header model call.

- multiline: one model call (Header)
- mixed: two model calls (Header + BODY normalization)
- singleline: two model calls (Header + BODY normalization)

Historical shadow diagnostic fields/types and experiment helpers may remain for backwards-compatible report reading and research history, but no shadow Header call is made by the active pipeline and no shadow result can affect product output.

This removes the large wall-clock/rate-limit cost that was useful only during A/B measurement.

## 2. Repair deferred model-guided ability-label coordinates

The known Cradle-style control failure retained since 2.74.163 is repaired without adding printed-language semantics.

When an LLM ability-label hint `q` is a candidate coordinate:

1. a compact one-token candidate is still accepted directly as the printed label;
2. if the coordinate instead resolves to a compact mechanically numeric score/modifier cell, the immediately preceding compact nonnumeric candidate may be used as the printed label;
3. canonical ability identity still comes only from the model's `a` mapping;
4. the existing deterministic six-label/ability-table solver must still prove the complete region and all numbers.

No English ability dictionary or language-specific semantic inference is introduced.

## 3. Compress mixed/singleline BODY candidate evidence losslessly

The Groq 27B regression report exposed a different nonlocal-model bottleneck: several mixed BODY requests exceeded the 7000 input-token allowance even though Header requests succeeded.

BODY SOURCE VIEW remains complete and unchanged. Candidate previews remain addressable. Repeated verbose structural/audit metadata is now dictionary-compressed per request:

- each distinct existing metadata signature receives a small `class=N` ID;
- candidate rows carry that class ID;
- `BODY STRUCTURAL CLASSES` contains each full signature exactly once.

This is transport compression only. It does not add, remove, reinterpret, or prioritize structural evidence.

On the three previously failing report requests, deterministic character reconstruction predicts roughly 38–40% smaller BODY request text. A real provider rerun is still required to measure Groq token accounting and prove that all three now fit.

## 4. Numeric BODY start coordinates

Mixed and singleline BODY normalization now return integer candidate indexes instead of `Cxxx` strings:

```json
{"starts":[{"s":17},{"s":42}]}
```

The model still sees the same visible `Cxxx` candidate addresses. The schema constrains `s` to an integer within the candidate range; deterministic parsing additionally enforces the allowed BODY candidate set, rejects Header-owned coordinates, and collapses duplicates.

This changes only coordinate encoding. BODY still returns logical line starts only; it does not classify headings, fields, features, metadata, or rules.

## 5. Usable mixed-mode fallback on BODY provider failure

Previously, if the mixed BODY model call failed (for example Groq HTTP 413), accepted Header facts were preserved but the exact BODY remainder stayed largely unclassified. That preserved source fidelity but produced a visibly poor product.

2.74.175 keeps the failure explicit while adding a deterministic fallback based only on source-proven physical geometry:

- physical line/paragraph/document starts;
- the first allowed BODY candidate after each Header-owned gap.

These starts are passed through the same multiline normalization/shared deterministic BODY parser. Exact source remains preserved. No semantic boundary is guessed. A routing signal `mixed_body_physical_fallback` records use of this degraded path.

The same fallback is used for an invalid mixed BODY response envelope. Singleline model failure remains conservative/unclassified because physical geometry cannot safely reconstruct a collapsed one-line source.

## 6. Final prompt metrics

Active Header prompt metrics now describe the production request only. Historical shadow metric fields remain nullable/false for stored-report compatibility but no hypothetical shadow request is constructed during normal parsing.

## Explicitly not revived

- 2.74.160 singleline Header candidate projection remains paused. Geometry-only pruning can discard semantically coherent but unusual Header regions and therefore is not an acceptable correctness dependency.
- STA-specific neighbor expansion, publication dictionaries, English semantic fallbacks, and other repairs proposed during 167–172 are not adopted.
- The intentionally accepted 2.74.162 repeated-Initiative-number ambiguity is unchanged; fixing it without language-specific interpretation would require a different evidence contract and is not justified by a demonstrated regression in this finalization pass.
- Singleline semantic quality and translation are still separate remaining product tasks; this patch makes their transport/failure behavior cleaner but does not claim those features are complete.

## Invariants

Unchanged:

- raw source is authoritative;
- `reconstruct(document) = rawSource` remains required;
- accepted Header ownership is exact and may be non-contiguous;
- BODY is the exact complement of accepted Header ownership;
- deterministic code remains printed-language neutral;
- LLM semantic identity never authorizes exact printed numbers by itself;
- multiline/mixed/singleline converge on the shared deterministic multiline BODY parser after normalization.
