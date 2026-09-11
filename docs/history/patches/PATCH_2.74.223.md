# Patch 2.74.223

## Online model selection

- Saving a known model profile no longer depends on the advisory result of the provider's model-catalog endpoint. A selected profile remains selected even when catalog diagnostics fail; the actual parsing request remains the definitive model check.
- HTTP 4xx responses other than an explicit 401 or 429 from `/models` are treated as an inconclusive catalog check instead of proof that the selected model is unavailable.
- A successful `/models` response with an unsupported payload shape is also treated as catalog-unconfirmed rather than as a network failure.
- The built-in Groq model identifiers were checked against the current Groq model catalog.

## Statblock header

- Editing format controls, `Копіювати статблок`, and the card menu now render inside one real toolbar row instead of two overlapping sticky elements.
- The center workspace now has its own viewport-height scroll container, so the statblock toolbar stays pinned at the top while the document scrolls beneath it.
- The embedded card controls share the toolbar's alignment, height, background, and sticky stacking context.

## Regression coverage

- Provider tests cover forbidden and structurally unsupported `/models` catalogs.
- Frontend tests cover saving a selected profile despite negative advisory catalog diagnostics.
- Editor tests verify that card actions are rendered inside the formatting toolbar.
