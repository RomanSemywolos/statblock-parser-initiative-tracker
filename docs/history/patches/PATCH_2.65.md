# 2.65.0 — deterministic Auto routing: multiline / single-line / mixed

Auto no longer uses the universal parser as an ambiguity bucket.

It now deterministically walks the normalized physical-line structure and classifies the source as:

- `multiline` → specialized multiline path (header-only LLM + deterministic body),
- `singleline` → specialized collapsed-text LLM path,
- `mixed` → the existing universal/generic LLM path unchanged.

Mixed detection is local rather than based only on total line length: a line counts as collapsed only when several independent statblock structures (header labels, section anchors, or multiple feature-like anchors) coexist on that physical line. This avoids treating a long ordinary rules paragraph as collapsed text.

Manual `generic` remains exactly the universal parser; its prompt was not changed.
