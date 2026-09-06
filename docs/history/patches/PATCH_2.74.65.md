# Patch 2.74.65

Test/corpus correction only after the 2.74.64 cleanup pass.

- Fixes the product-visibility regression fixture to use the valid `supplementary` annotation role instead of the nonexistent `unclassified` role.
- Makes the Ukrainian synthetic-label assertions presentation-neutral: the test verifies the localized product label independent of Auto Style markdown.
- Strengthens the mixed soft-wrap routing corpus fixture so it actually contains the router contract's required substantive lowercase continuation region.
- No production parser/compiler/routing behavior changed.
