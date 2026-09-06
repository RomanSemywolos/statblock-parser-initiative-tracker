# 2.74.79

> Current status: the physical-line invariant remains authoritative. The sentence below about later LLM classification of multiline section meaning was superseded by 2.74.83/2.74.84: clean multiline BODY does not call an LLM after routing merely to identify sections.


Restores the defining BODY invariant of `multiline` routing.

- `multiline` now treats every non-empty physical BODY line as exactly one logical
  BODY run. Dense candidate coordinates inside the same line are folded together;
  coordinates from distinct non-empty lines are never merged.
- Semantic classification can assign a role to an already-proven multiline line,
  but can no longer alter its span by merging it with neighboring lines.
- Removed regression-test expectations that asked the multiline planner to preserve
  continuation-looking physical rows inside one feature. Such source geometry is
  `mixed` by contract, not `multiline`.
- Added a language-neutral Russian regression proving that unknown localized section
  labels remain independent physical runs instead of being swallowed by adjacent
  features/rules.
- Added `ROUTING_CONTRACT_2.74.79.md` documenting the authoritative multiline/mixed/
  singleline responsibilities and the rule that language-dependent semantics belong
  to the LLM layer, followed by deterministic grounding/structure/number validation.

This patch intentionally does not solve localized section-heading semantics yet.
That is a separate semantic-layer change: first preserve the correct multiline
physical units, then let the LLM classify language-dependent section meaning without
being allowed to change those deterministic spans.

> Superseded by 2.74.83–2.74.85: clean multiline does not run a BODY semantic section pass, and active pre-LLM candidate evidence no longer contains language-profile section anchors.
