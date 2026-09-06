# Patch 2.74.132 — neutral boundary evidence + minimal structural-role classifier

This patch stays on the 2.74.131 global single-line plan:

`whole source -> boundary detection -> deterministic slicing -> block classification -> compiler`

It does **not** return to `bodyStart`, remainder segmentation, independent start/end spans, language dictionaries, or deterministic D&D semantic hardcodes.

## Why

The 2.74.131 corpus showed that the boundary pass was often following our own `top_level:strong` / synthetic labels too literally. Those labels were useful during candidate auditing but became semantic-looking instructions once embedded beside collapsed source. The second pass also carried the old large taxonomy (`sh/r/f/sc/sup` plus section identity), and Qwen frequently collapsed whole runs into one wrong class/section.

## Changes

1. Boundary inline markers are now neutral addresses: `⟦Cxxx|anchor⟧`.
   - No `top_level`, `body`, section, feature, or synthetic-role label is embedded beside source.
   - Sparse anchor details expose only source-shape evidence and continuation evidence.

2. The boundary system prompt is language-independent at the architecture level.
   - No English statblock field-name list.
   - No natural-language D&D examples such as `Magic Resistance`, `Actions`, `Bite`.
   - Examples use abstract `META_A`, `SECTION_X`, `RULE_A`, `SUB_A` placeholders.

3. The second pass is deliberately reduced to the minimum structural role needed by the current compiler:
   - `h` = standalone structural heading;
   - `f` = named peer rule/unit;
   - `p` = peer prose/content;
   - `u` = metadata or unsafe/unknown.
   - It no longer predicts section identity (`actions`, `legendary`, `description`, etc.).

4. Deterministic transport maps those minimal roles to the existing downstream contract:
   - `h -> unknown_section_heading`
   - `f -> feature`
   - `p -> section_content`
   - `u -> unclassified`

Section semantics are intentionally deferred. Boundaries remain immutable after pass 1.
