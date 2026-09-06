# Patch 2.74.87 — Preserve multiline structure without inventing section semantics

## Why

2.74.86 correctly introduced `unknown_section_heading` as a language-neutral structural boundary, but the generic candidate transport treated an unknown semantic section as a reason to discard all following `feature` / `section_rules` / `section_content` annotations until a known section appeared. That is correct for model-reconstructed `mixed` / `singleline` structure, but wrong for `multiline`, where physical-row structure is already trusted and deterministic.

The result was a regression: multiline features after an unknown localized heading remained lossless, but stopped being structural annotations.

## Contract

### Multiline

- one non-empty physical BODY row = one structural unit;
- no BODY semantic LLM pass;
- a standalone structurally heading-shaped row may be represented as `section_heading` with `section: null`;
- a proven feature/rules/content row after that boundary keeps its structural role with `section: null`;
- `section: null` means exactly: structural role known, language-dependent canonical section identity unknown;
- no previous section ownership is inherited across an unknown heading.

### Mixed / singleline

- their body structure is reconstructed semantically;
- after `unknown_section_heading`, following section-owned content remains unresolved until a semantically identified heading appears;
- they do not inherit or guess the previous section.

## Implementation

- body annotation schemas now allow nullable section identity for structural body roles;
- `candidateResponseToDirectResponse()` gained the explicit `preserveUnknownSectionStructure` transport option;
- pipeline enables that option only for routed `multiline` mode;
- multiline unknown headings are preserved as `section_heading, section:null`;
- multiline feature/rules/content rows after an unknown heading remain annotations with `section:null`;
- mixed/singleline behavior stays conservative and unresolved after an unknown semantic boundary.

## Test corrections

- stale multiline tests now expect `unknown_section_heading`, not plain `unclassified`;
- multiline pipeline tests verify structural heading annotations with `section:null`, not language-derived section ownership;
- the defensive editable-compiler test strips presentation markup before checking physical-row preservation, because its deliberately malformed wrapped-feature fixture is `mixed` by routing contract and must not prescribe Auto Style semantics;
- web integration expects the structurally proven multiline body rows to remain annotations instead of unresolved gaps.
