# Patch 2.74.126 — accepted source ownership infrastructure

Infrastructure-only stage of the ownership migration. Parser behavior, prompts,
routing, candidate transport, product compilation and presentation are unchanged.

## Added

- `src/sourceOwnership.ts`
  - `resolveAcceptedHeaderOwnership(document)` creates one authoritative map of
    exact source ranges already accepted as semantic Header ownership or grounded
    fixed-header evidence.
  - only compiled `header_field`/`header_content` annotations contribute semantic
    ownership; raw model proposals do not.
  - final `structuredHeader` fact/evidence coordinates contribute only when their
    exact evidence still matches the original raw source.
  - overlapping ownership sources are normalized into ordered disjoint intervals
    while retaining every contributing owner/provenance.
  - no prefix/body boundary is inferred.
- `assertValidSourceOwnershipMap(rawSource, map)` enforces the ownership-layer
  coordinate/partition invariants. Owned intervals plus their implicit gaps sweep
  the exact original source once, without overlap, loss or invention.
- `src/sourceOwnership.test.ts` covers accepted-vs-body ownership, overlapping
  semantic/evidence provenance, stale fact rejection, and partition validation.

## Deliberately not changed

- `bodyStart` lifecycle or any production handoff.
- header or structure prompts/schemas.
- singleline/mixed/multiline routing.
- candidate IDs or renumbering.
- editable compiler ownership.
- any physical `RemainderView` (reserved for 2.74.127).
