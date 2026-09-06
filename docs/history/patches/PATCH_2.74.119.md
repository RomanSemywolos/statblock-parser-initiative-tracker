# Patch 2.74.119 — clean list-fix branch

This release is intentionally rebased on **2.74.109**, the last version before the rich-clipboard/bold-style experiment.

It does **not** contain the 2.74.110–2.74.118 source-style capture, `source_bold`, clipboard diagnostics, native clipboard probing, or style-derived candidate changes.

The only parser behavior added on top of 2.74.109 is the generalized source-proven internal-list repair:

- ordered lists: `1.`, `1)`, `A.`, `A)` with sequential markers;
- bullet/dash lists: `-`, `–`, `—`, `+`, `*`, `•`, `◦`, `▪`, `‣`;
- a list must be introduced by a visible trailing colon and contain at least two confirmed items;
- wrapped PDF physical rows may occur between markers within a bounded local window;
- multiple introduced lists remain separate groups;
- a final item whose marker and title were split into separate candidate coordinates is absorbed into the parent feature;
- the next independent feature remains separate.

The rule is vocabulary-free and structural only. It does not assign D&D semantics and does not alter source visibility or fixed-header authority.
