# Patch 2.74.150 — conservative singleline BODY normalization

This patch keeps the canonical ownership-first architecture unchanged and narrows only the singleline BODY proposal view.

## What changed

1. **Singleline BODY candidate view is now conservative.**
   - Header verification still keeps the full exact singleline lattice.
   - BODY normalization now exposes structural/mixed candidates only.
   - A small exception preserves exact `address_only` coordinates *inside a source-proven composite title span* as refinement coordinates. This covers collapsed shapes such as `Actions Multiattack.` or `Traits Magic Resistance.` without turning every dense token address into a plausible line start.

2. **Collapsed named-rule shape is promoted as geometry evidence.**
   - Existing language-neutral `collapsedNamedRuleLeadAt(...)` is reused.
   - Numeric leads are not promoted, so compact metadata such as `Speed 30 ft.` does not gain rule-title confidence from this path.
   - Inner word coordinates of an already recognized compact title are not promoted independently.

3. **Standalone heading before compact labelled row.**
   - A collapsed row such as `Legendary Actions Legendary Action Uses: 3.` can preserve `Legendary Actions` as top-level geometry when the prefix itself has standalone-heading shape and the following source text independently has compact `Label:` shape.
   - No section vocabulary is used and no semantic type is assigned.

4. **Runaway-generation ceiling for singleline BODY.**
   - The starts-only BODY call now uses `Math.min(input.numPredict ?? 4096, 1536)`.
   - Caller-supplied smaller limits remain respected.
   - Header calls and other parser modes are unchanged.

## Architecture invariants preserved

- Exactly one Header LLM call and one BODY LLM call for active singleline parsing.
- Header ownership is still deterministic after model proposal.
- BODY LLM output is still only logical line starts.
- No BODY semantic taxonomy was added.
- Source text and source coordinates remain immutable.
- Mixed and multiline paths are unchanged.
- The same deterministic multiline BODY parser still runs after normalization.

## Regression/diagnostic checks

Using the real 2.74.146 singleline report sources, BODY candidate counts are reduced from the full singleline lattice to a much smaller proposal/refinement view:

- Russian Astral: 258 -> 31
- Baphomet: 329 -> 64
- Tarrasque: 273 -> 48
- Aspect of Tiamat: 302 -> 64
- Demogorgon: 247 -> 47

Required rule/title coordinates remain addressable, including `Мультиатака.`, `Multiattack.`, `Gouging Toss.`, and the Tarrasque `Legendary Actions` row.

The full compiled Node test suite passes: **553/553**.
