# Body routing contract — 2.74.79

This contract is an architectural invariant, not a heuristic preference.

## Header

Header interpretation is shared across modes and does not participate in BODY routing.
Language-dependent header semantics belong to the semantic model layer. Deterministic
code validates grounding, structure, exact printed mechanics/numbers, and placement.

## multiline

BODY physical-line geometry is trusted.

- Every non-empty physical BODY line is exactly one logical BODY unit.
- Candidate-lattice granularity may be denser than a line; all candidate coordinates
  on the same physical line are folded into that one unit.
- Distinct non-empty physical lines are never merged by the multiline BODY planner.
- The multiline BODY path performs no structural BODY LLM call. The source has
  already supplied the logical unit boundaries through trusted physical geometry.
- Deterministic body processing may assign only language-independent structural roles
  to an already-proven line unit; it may not change the physical-line span.
- A standalone heading-shaped row may receive presentation-only heading styling later,
  but this does not imply semantic section identity such as `actions` or
  `legendary_actions`.
- If one logical structure is visually wrapped across multiple physical lines, the
  source is not pure multiline and must route to mixed.

## mixed

BODY physical-line geometry is not trusted in either direction.

- One logical structure may be wrapped across multiple physical lines.
- Multiple logical structures may be collapsed onto one physical line.
- Semantic/structural interpretation may therefore merge or split physical lines,
  subject to grounding and lossless structural validation.

## singleline

BODY input is largely collapsed and uses the dense collapsed candidate strategy.
Semantic/structural interpretation reconstructs logical units from grounded source
coordinates, subject to lossless validation.

## Language responsibility

Anything whose correct interpretation requires understanding the printed language
belongs to an LLM semantic layer only when the product actually requires that semantic
meaning. Deterministic code must not make correctness depend on a language vocabulary.
It may validate source geometry, grounding, invariants, exact printed numbers/mechanics,
and place already-grounded semantics into the product model.

For clean `multiline` BODY, semantic section identity is not required for parsing or
presentation. A standalone heading-shaped row is a structural `unknown_section_heading`
(boundary known, subtype unknown). Auto Style may use trusted row shape to render an untyped visual heading
(`headingKind: null`) without calling an LLM and without claiming that the text means
`actions`, `traits`, `legendary_actions`, or another canonical section.

## Section semantic ownership (2.74.85 clarification)

- Pre-LLM candidate/profile evidence has no section-label or section-anchor channel.
- In `mixed` / `singleline`, canonical section identity is supplied only by the BODY
  semantic model on grounded candidate spans; deterministic transport validates and
  places that already-returned identity but does not translate or repair it from text.
- `unknown_section_heading` is a real uncertainty boundary. It resets section ownership;
  following rules/features remain unresolved until a later semantically identified
  section heading. They must not inherit the preceding section or default to another one.
- Implicit traits before the first printed section heading remain allowed as the initial
  BODY region; this is positional structure, not language interpretation.
- Historical language dictionaries may remain in quarantined legacy modules, but no
  active parser import may make BODY section correctness depend on them.


## End-to-end multiline product guard (2.74.86)

Lossless block storage may coalesce adjacent unresolved rows into one unclassified gap because no annotation owns them. That storage representation does not weaken the routing contract. The editable compiler must split multiline BODY content by trusted physical non-empty rows before creating product nodes. Header content is excluded from this guard.

## Clarification added in 2.74.87: structural role may exist without section semantics

In `multiline`, the parser may know that a physical BODY row is a `section_heading`, `feature`, `section_rules`, or `section_content` while not knowing the language-dependent canonical section. Such annotations use `section: null`. This preserves source-proven structure without inventing `traits`, `actions`, `legendary_actions`, etc. An unknown heading resets prior section ownership.

In `mixed` and `singleline`, `unknown_section_heading` instead creates a semantic uncertainty barrier: subsequent section-owned content remains unresolved until semantic section identity is restored.
