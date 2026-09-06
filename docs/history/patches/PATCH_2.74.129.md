# Patch 2.74.129 — single-line remainder semantic contract

This patch changes only the semantic contract presented to the collapsed/single-line structure model. The 2.74.128 remainder handoff, Header ownership resolver, routing, candidate construction, transport, compiler, and presentation behavior are otherwise unchanged.

## Why

2.74.128 correctly stopped using legacy `bodyStart` as the single-line structure-source cutoff, but the active rich single-line system prompt still described each input segment as pure BODY with all metadata already removed. Real diagnostics showed exact remainder segments such as `Speed 50 ft., Swim 50 ft.` reaching that prompt, making the model structurally obligated to reinterpret unresolved metadata as body structure.

## Change

`RICH_SINGLELINE_BODY_ONLY_CANDIDATE_STRUCTURE_SYSTEM_PROMPT` now describes its actual input contract: one exact contiguous remainder segment after accepted Header ownership was excluded. It explicitly states that unresolved metadata may remain, that Header ownership is not reconstructed in this stage, and that metadata-like remainder must use `u` unless there is positive support for a body role.

The output schema and kinds are unchanged (`sh`, `f`, `r`, `sc`, `sup`, `u`). No new metadata class was introduced. Examples cover unresolved Speed/Skills metadata, an explicit Traits heading plus feature, and a heading-less named feature.

Generic/mixed BODY prompts remain unchanged; this patch is intentionally limited to the single-line remainder path.

## Regression coverage

Prompt tests now assert that the active rich collapsed prompt:
- identifies itself as remainder structure mode;
- permits unresolved metadata;
- directs unsupported metadata-like source to `u`;
- retains correct feature/heading distinctions;
- no longer claims that the source begins at the first BODY candidate or that metadata has already been fully parsed away.
