# Patch 2.74.194 — mixed BODY recovery control build

Status: **quality-control recovery build**, not yet the new stable baseline.

This patch starts from **2.74.175** and changes only the model-facing transport of the
successful `mixed` BODY normalization call. The purpose is to isolate the large quality
regression observed between 2.74.173 and 2.74.175 without losing the engineering
stabilization introduced by 2.74.175.

## Kept from 2.74.175

- one authoritative fixed Header call; the Header A/B shadow is not revived;
- deterministic Header validation and exact ownership;
- the language-neutral Cradle ability-coordinate repair;
- mixed provider-failure / invalid-envelope physical-row fallback;
- exact BODY complement and shared deterministic multiline BODY parser;
- all provider/settings/product code already present in 2.74.175.

## Reverted for mixed BODY only

### 1. Structural-class indirection removed

2.74.175 rendered candidates as:

```text
C067 [class=4]: ...
```

with the full evidence signature stored in a separate class dictionary.

2.74.194 restores the 2.74.173 model-facing form:

```text
C067 [line_start,sentence_start,named_block_start;
      boundary=top_level/strong;
      evidence=physical_line+title_shape+sentence_shape;
      continuation=none;
      continuationEvidence=none]: ...
```

The complete BODY SOURCE VIEW remains visible.

### 2. Numeric start output removed

2.74.175 asked mixed BODY to return:

```json
{"starts":[{"s":67}]}
```

2.74.194 restores:

```json
{"starts":[{"s":"C067"}]}
```

The deterministic parser still validates that every returned coordinate belongs to
the legal BODY-owned candidate set.

## Intentionally unchanged

- `singleline` remains exactly as it was in 2.74.175 in this control build.
- No 2.74.177 completion-budget replay yet.
- No singleline retirement / 185–187 cleanup yet.
- No R/A edit protocol.
- No local-card or batching architecture.
- No weights, FORBIDDEN/MANDATORY rules, pruning, or lowercase hard blocker.
- No provider context-policy changes.

This narrow scope is deliberate: real-corpus comparison against 2.74.173 and 2.74.175
must first establish whether restoring local inline evidence and direct `Cxxx` copying
recovers mixed segmentation quality.

## Validation

- `npm run typecheck`: PASS
- `npm run build`: PASS
- compiled Node suite: **597/597 PASS**
- mixed system prompt block equals 2.74.173 byte-for-byte
- mixed user-prompt function equals 2.74.173 byte-for-byte
