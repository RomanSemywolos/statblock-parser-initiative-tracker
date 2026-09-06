# 2.74.77

Test-contract correction only.

- Re-expressed the `ungrounded_header_ability` regression directly in the current candidate header contract.
- The old quote fixture depended on `sourceQuote`, which no longer exists in the candidate `abilityLabels {a,q}` channel and therefore could not faithfully encode an ungrounded hint.
- The test now sends `{a:"dex", q:"DEX"}` against a source containing only `STR`, so production itself must reject the ungrounded label while preserving deterministic canonical STR recovery.
- No production parser code changed from 2.74.76.
