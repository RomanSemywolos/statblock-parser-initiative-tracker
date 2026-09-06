# Patch 2.74.4

Corrects two over-broad v2.74.3 parser heuristics.

- Removes the English connector-word list used to suppress wrapped title-like continuation rows. The decision is now shape/geometry based: once body prose has started, an unterminated non-heading physical row is evidence that the following title-shaped row is a continuation. Standalone headings such as section labels remain exempt.
- Moves collapsed adjacent canonical header-field boundaries (for example `Armor Class ... Hit Points ...`) out of the universal candidate lattice and into a generic/mixed-only enrichment stage. Clean multiline mode does not receive these inline header candidates.
- Keeps the renderer-level no-wrap treatment for compact DC atoms from v2.74.3 unchanged.
