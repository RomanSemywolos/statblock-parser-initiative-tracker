# Patch 2.74.124 — singleline pre-LLM structural reconstruction

This patch implements the planned singleline pre-LLM reconstruction stage while leaving multiline/mixed parsing, semantic ownership, transport, and product compilation unchanged.

## Changes

- Added `singlelineStructuralReconstruction.ts` as a source-shape-only reconstruction layer.
- The full singleline candidate lattice remains the exact address space. Synthetic reconstruction only marks sparse `top_level` or `internal` geometry.
- Compact collapsed multiword leads are recognized as structural starts without assigning whether they are headings, features, or metadata. Internal token edges inside such leads are retained as weak exact addresses so the LLM can split constructs such as a section heading immediately followed by its first option.
- Short unpunctuated leading label runs before section-wide prose receive exact token edges. The deterministic layer does not choose the semantic end of the heading.
- Source-proven inline ordered lists and compact colon-label sequences are marked `synthetic=internal`, not peer/top-level starts.
- The singleline prompt presentation includes `synthetic=top_level|internal` evidence while keeping the existing semantic prompt and complete Cxxx coordinate space.
- Candidate audit now records synthetic structural origins.

## Safety / non-goals

- No D&D section vocabulary or English heading whitelist was added.
- No header/body semantic rule was added.
- No deterministic title-case => feature ownership rule was added.
- No candidate transport, BODY semantic sanitizer, editable compiler, multiline, or mixed behavior was changed.
- Exact source visibility/losslessness remains unchanged.

## Tests

- Added synthetic reconstruction tests for collapsed heading+rule geometry, heading+section-prose split addresses, negative sentence-shaped prose, ordered-list internals, compact colon-label internals, and coordinate preservation.
- Added prompt test proving synthetic geometry is exposed only as structural role evidence, not semantic section labels.
