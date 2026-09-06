# Patch 2.74.128 — single-line remainder handoff

This patch performs the first production switch from the legacy `bodyStart` source suffix to accepted Header ownership for **single-line** structural parsing only.

## What changed

- Single-line parsing keeps the complete collapsed candidate address space instead of dropping all candidates before `bodyStart`.
- Before the single-line structure call, accepted Header claims are compiled into a provisional lossless document, enriched with the current deterministic Header facts, and passed through the authoritative `resolveAcceptedHeaderOwnership()` resolver introduced in 2.74.126.
- `buildRemainderView()` from 2.74.127 constructs the exact complement. Accepted Header ranges are hard discontinuities and are never concatenated away.
- Each substantive contiguous remainder segment is parsed independently. Whitespace-only or candidate-less remainder stays losslessly unclassified.
- Local remainder candidate responses are mapped back to the original complete source coordinate space by exact candidate starts.
- The collapsed structure prompt now states the truthful contract: it sees an exact remainder segment, not guaranteed-pure BODY, and unresolved metadata may be returned as `u`.
- `sanitizeBodyModelResponse()` accepts an explicit source end so its last local candidate cannot inspect text across an ownership discontinuity.
- `bodyStart` still exists in the Header scan and still participates in legacy routing/diagnostics; it no longer decides the single-line structure source cutoff. Multiline and generic/mixed behavior are unchanged.

## Safety invariants

- No Header semantic claim alone can hide source: only accepted compiled Header ownership is subtracted.
- Ownership gaps are hard source boundaries.
- Exact source coordinates are retained; no synthetic concatenated remainder string is created.
- Material not parsed from a remainder segment remains visible as unclassified source.

## Tests

- Added an integration regression where the Header model returns a deliberately late legacy `bodyStart`; earlier unresolved metadata is still present in the single-line structure request because it belongs to the exact remainder.
- Added a sanitizer regression proving an explicit remainder-segment end prevents source inspection across an ownership gap.
