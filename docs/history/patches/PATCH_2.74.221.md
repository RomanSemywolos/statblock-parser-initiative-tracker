# Patch 2.74.221

## User-facing changes

- Natural 20 totals are green and natural 1 totals are red for single-d20 rolls, while the displayed value remains the full result with modifiers.
- Ukrainian `Перезарядка 5–6` mechanics remain clickable after translation, including inside bold-italic authoring markup.
- Ability scores and modifiers can be entered independently; the editor no longer calculates one from the first score digit or invents a score while entering a modifier.
- The formatting toolbar, card menu, and new `Копіювати статблок` action remain pinned while the center statblock scrolls.
- Rich clipboard output preserves headings, bold and italic styling, uses a real ability table, and excludes Evidence.
- The redundant auto-style explanation and model-settings action were removed from the import window.

## Online model status

- A successful OpenAI-compatible connection is no longer reported as unavailable solely because `/models` omitted the configured ID. This state is shown as catalog-unconfirmed and the first parse remains the definitive availability check.
- A Groq key entered for a built-in profile is applied to all built-in Groq profiles for the current server session.
- Truly failed model health checks still prevent saving that selection.

## Validation

- Core and frontend test suites cover translated recharge, natural d20 presentation, independent ability editing, rich clipboard serialization, and catalog-unconfirmed model health.
