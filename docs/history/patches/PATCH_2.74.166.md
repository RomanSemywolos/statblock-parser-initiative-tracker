# Patch 2.74.166 — non-authoritative Header A/B execution

This patch activates the first real A/B run of the Header transport migration.

- The legacy Header request remains the only production authority for Header ownership and product output.
- A second, diagnostics-only Header call sends the v2.74.165 inline-coordinate shadow request to the same configured model.
- The shadow response is parsed with the same candidate-coordinate validity rules and passed through the same deterministic essential Header enrichment probe.
- Diagnostics record the shadow request, raw output, elapsed/performance metrics, parsed facts/ability mappings, verified structured Header, and exact verified-Header equivalence to the legacy probe.
- Shadow request construction, model failure, invalid JSON, or invalid envelope cannot alter or fail the authoritative parse.
- BODY architecture is unchanged. Multiline therefore makes two Header calls and no BODY call; mixed/singleline make legacy Header + shadow Header + their existing one BODY-normalization call.
- Model timing now exposes `shadowHeaderModelCallSeconds` and `shadowHeaderOllama`; aggregate `modelCallSeconds` includes the diagnostic A/B call while authoritative document model request counts remain production-only.

This is intentionally a migration/test version. It doubles Header inference work so that real tokenizer counts and semantic equivalence can be measured before any production switch.
