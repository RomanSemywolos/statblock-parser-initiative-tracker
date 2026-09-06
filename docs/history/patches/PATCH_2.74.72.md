# 2.74.72 — body routing trusts lines only when logical structures stay on them

- Restores `mixed` routing when body structures are visually wrapped across multiple physical rows.
- Keeps the 2.74.71 separation invariant: routing runs on body-only source after the LLM header boundary is known, so wrapped header fields cannot force mixed mode.
- Adds a strong language-neutral signal when a trusted named-rule row ends open and its prose continues on the following non-structural row.
- Strong soft-wrap regions again route body input to `generic`/mixed.
- Collapsed peers on one row continue to route as mixed/singleline as before.
- Adds regressions for a single wrapped feature and wrapped-column body sources.

No header semantic parsing behavior is intentionally changed.
